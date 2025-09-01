from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os
import json
import time
from typing import Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime, timedelta
import asyncio

ORIGIN_API_BASE = os.getenv("ORIGIN_API_BASE", "http://hkapi.tchjjc.com")
ORIGIN_CTRL_BASE = os.getenv("ORIGIN_CTRL_BASE", "http://hk.tchjjc.com")
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://root:root@127.0.0.1:3306/iot_backend?charset=utf8mb4",
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class ProxyLog(BaseModel):
    method: str
    path: str
    target_url: str
    status_code: int
    client_ip: str | None = None
    error_message: str | None = None


class TokenManager:
    """Token管理器，处理token的获取、缓存和刷新"""
    
    def __init__(self):
        self.token: Optional[str] = None
        self.expires_at: Optional[datetime] = None
        self.lock = asyncio.Lock()  # 防止并发请求时重复获取token
        
    def is_token_expired(self) -> bool:
        """检查token是否已过期（提前30秒判断为过期）"""
        if not self.token or not self.expires_at:
            return True
        return datetime.now() >= (self.expires_at - timedelta(seconds=30))
    
    async def get_token_from_api(self) -> Dict[str, Any]:
        """从原始API获取token"""
        token_url = f"{ORIGIN_API_BASE}/api/token"
        
        # 这里需要根据实际的token获取接口调整请求参数
        # 假设需要用户名密码或其他认证信息
        auth_data = {
            "username": os.getenv("API_USERNAME", "YH18129635675"),
            "password": os.getenv("API_PASSWORD", "18129635675"),
            # 根据实际API调整字段
        }
        
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                token_url,
                json=auth_data,
                headers={"Content-Type": "application/json"}
            )
            
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=500, 
                    detail=f"Failed to get token: {resp.status_code} {resp.text}"
                )
            
            return resp.json()
    
    async def ensure_valid_token(self) -> str:
        """确保获取到有效的token"""
        async with self.lock:
            if not self.is_token_expired():
                return self.token
            
            # 获取新token
            token_data = await self.get_token_from_api()
            
            # 根据实际API响应格式调整
            self.token = token_data.get("access_token") or token_data.get("token")
            
            # 设置过期时间，如果API返回了expires_in
            expires_in = token_data.get("expires_in", 3600)  # 默认1小时
            self.expires_at = datetime.now() + timedelta(seconds=expires_in)
            
            return self.token


# 全局token管理器实例
token_manager = TokenManager()


def log_operation(db, log: ProxyLog):
    """记录操作日志"""
    db.execute(
        text(
            """
            INSERT INTO operation_logs(method, path, target_url, status_code, client_ip, error_message, created_at)
            VALUES (:method, :path, :target_url, :status_code, :client_ip, :error_message, NOW())
            """
        ),
        {
            "method": log.method,
            "path": log.path,
            "target_url": log.target_url,
            "status_code": log.status_code,
            "client_ip": log.client_ip,
            "error_message": log.error_message,
        },
    )
    db.commit()


app = FastAPI(title="Mini Program Backend Proxy")

allowed_origins = os.getenv("ALLOWED_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in allowed_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def forward_post_with_auth(
    request: Request, 
    base: str, 
    path: str, 
    max_retries: int = 2
) -> tuple[str, httpx.Response]:
    """
    带认证的POST请求转发，自动处理token
    """
    query = request.url.query
    target = f"{base}{path}"
    if query:
        target = f"{target}?{query}"
    
    body = await request.body()
    
    for attempt in range(max_retries + 1):
        try:
            # 获取有效token
            token = await token_manager.ensure_valid_token()
            
            headers = {
                "Content-Type": request.headers.get("Content-Type", "application/json"),
                "Authorization": f"Bearer {token}",  # 根据实际API调整认证头格式
            }
            
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post(target, content=body, headers=headers)
                
                # 如果是401错误，说明token可能无效，清空缓存重试
                if resp.status_code == 401 and attempt < max_retries:
                    token_manager.token = None
                    token_manager.expires_at = None
                    continue
                
                return target, resp
                
        except Exception as e:
            if attempt == max_retries:
                raise HTTPException(status_code=500, detail=f"Request failed: {str(e)}")
            continue
    
    raise HTTPException(status_code=500, detail="Max retries exceeded")


async def forward_post_no_auth(request: Request, base: str, path: str) -> tuple[str, httpx.Response]:
    """
    不需要认证的POST请求转发（如控制类接口）
    """
    query = request.url.query
    target = f"{base}{path}"
    if query:
        target = f"{target}?{query}"
    
    body = await request.body()
    headers = {"Content-Type": request.headers.get("Content-Type", "application/json")}
    
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(target, content=body, headers=headers)
    
    return target, resp


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.post("/api/thing/info")
async def thing_info(request: Request, db=Depends(get_db)):
    try:
        target, resp = await forward_post_with_auth(request, ORIGIN_API_BASE, "/api/thing/info")
        log_operation(
            db,
            ProxyLog(
                method="POST",
                path="/api/thing/info",
                target_url=target,
                status_code=resp.status_code,
                client_ip=request.client.host if request.client else None,
            ),
        )
        return resp.json()
    except Exception as e:
        log_operation(
            db,
            ProxyLog(
                method="POST",
                path="/api/thing/info",
                target_url="",
                status_code=500,
                client_ip=request.client.host if request.client else None,
                error_message=str(e),
            ),
        )
        raise


@app.post("/api/thing/properties")
async def thing_properties(request: Request, db=Depends(get_db)):
    try:
        target, resp = await forward_post_with_auth(request, ORIGIN_API_BASE, "/api/thing/properties")
        log_operation(
            db,
            ProxyLog(
                method="POST",
                path="/api/thing/properties",
                target_url=target,
                status_code=resp.status_code,
                client_ip=request.client.host if request.client else None,
            ),
        )
        return resp.json()
    except Exception as e:
        log_operation(
            db,
            ProxyLog(
                method="POST",
                path="/api/thing/properties",
                target_url="",
                status_code=500,
                client_ip=request.client.host if request.client else None,
                error_message=str(e),
            ),
        )
        raise


@app.post("/api/thing/tsl")
async def thing_tsl(request: Request, db=Depends(get_db)):
    try:
        target, resp = await forward_post_with_auth(request, ORIGIN_API_BASE, "/api/thing/tsl")
        log_operation(
            db,
            ProxyLog(
                method="POST",
                path="/api/thing/tsl",
                target_url=target,
                status_code=resp.status_code,
                client_ip=request.client.host if request.client else None,
            ),
        )
        return resp.json()
    except Exception as e:
        log_operation(
            db,
            ProxyLog(
                method="POST",
                path="/api/thing/tsl",
                target_url="",
                status_code=500,
                client_ip=request.client.host if request.client else None,
                error_message=str(e),
            ),
        )
        raise


@app.post("/api/thing/properties/set")
async def thing_properties_set(request: Request, db=Depends(get_db)):
    try:
        target, resp = await forward_post_with_auth(request, ORIGIN_API_BASE, "/api/thing/properties/set")
        log_operation(
            db,
            ProxyLog(
                method="POST",
                path="/api/thing/properties/set",
                target_url=target,
                status_code=resp.status_code,
                client_ip=request.client.host if request.client else None,
            ),
        )
        return resp.json()
    except Exception as e:
        log_operation(
            db,
            ProxyLog(
                method="POST",
                path="/api/thing/properties/set",
                target_url="",
                status_code=500,
                client_ip=request.client.host if request.client else None,
                error_message=str(e),
            ),
        )
        raise


@app.post("/api/thing/status")
async def thing_status(request: Request, db=Depends(get_db)):
    try:
        target, resp = await forward_post_with_auth(request, ORIGIN_API_BASE, "/api/thing/status")
        log_operation(
            db,
            ProxyLog(
                method="POST",
                path="/api/thing/status",
                target_url=target,
                status_code=resp.status_code,
                client_ip=request.client.host if request.client else None,
            ),
        )
        return resp.json()
    except Exception as e:
        log_operation(
            db,
            ProxyLog(
                method="POST",
                path="/api/thing/status",
                target_url="",
                status_code=500,
                client_ip=request.client.host if request.client else None,
                error_message=str(e),
            ),
        )
        raise


@app.post("/api/things/info")
async def things_info(request: Request, db=Depends(get_db)):
    try:
        target, resp = await forward_post_with_auth(request, ORIGIN_API_BASE, "/api/things/info")
        log_operation(
            db,
            ProxyLog(
                method="POST",
                path="/api/things/info",
                target_url=target,
                status_code=resp.status_code,
                client_ip=request.client.host if request.client else None,
            ),
        )
        return resp.json()
    except Exception as e:
        log_operation(
            db,
            ProxyLog(
                method="POST",
                path="/api/things/info",
                target_url="",
                status_code=500,
                client_ip=request.client.host if request.client else None,
                error_message=str(e),
            ),
        )
        raise


@app.post("/api/thing/property/timeline")
async def thing_property_timeline(request: Request, db=Depends(get_db)):
    try:
        target, resp = await forward_post_with_auth(request, ORIGIN_API_BASE, "/api/thing/property/timeline")
        log_operation(
            db,
            ProxyLog(
                method="POST",
                path="/api/thing/property/timeline",
                target_url=target,
                status_code=resp.status_code,
                client_ip=request.client.host if request.client else None,
            ),
        )
        return resp.json()
    except Exception as e:
        log_operation(
            db,
            ProxyLog(
                method="POST",
                path="/api/thing/property/timeline",
                target_url="",
                status_code=500,
                client_ip=request.client.host if request.client else None,
                error_message=str(e),
            ),
        )
        raise


@app.post("/admin/alidevrealdata/controldev.html")
async def control_dev(request: Request, db=Depends(get_db)):
    """控制设备接口，通常不需要token认证"""
    try:
        target, resp = await forward_post_no_auth(request, ORIGIN_CTRL_BASE, "/admin/alidevrealdata/controldev.html")
        log_operation(
            db,
            ProxyLog(
                method="POST",
                path="/admin/alidevrealdata/controldev.html",
                target_url=target,
                status_code=resp.status_code,
                client_ip=request.client.host if request.client else None,
            ),
        )
        
        # 尝试返回JSON，如果失败则返回文本
        try:
            return resp.json()
        except Exception:
            return {"status": resp.status_code, "text": resp.text}
            
    except Exception as e:
        log_operation(
            db,
            ProxyLog(
                method="POST",
                path="/admin/alidevrealdata/controldev.html",
                target_url="",
                status_code=500,
                client_ip=request.client.host if request.client else None,
                error_message=str(e),
            ),
        )
        raise


# 健康检查接口
@app.get("/health")
async def health_check():
    """健康检查接口"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "token_status": "valid" if not token_manager.is_token_expired() else "expired"
    }


# 手动刷新token接口（可选，用于调试）
@app.post("/admin/refresh-token")
async def refresh_token():
    """手动刷新token（管理接口）"""
    token_manager.token = None
    token_manager.expires_at = None
    new_token = await token_manager.ensure_valid_token()
    return {
        "message": "Token refreshed successfully",
        "expires_at": token_manager.expires_at.isoformat() if token_manager.expires_at else None
    }