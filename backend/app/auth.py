import os
from datetime import datetime, timedelta, timezone
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from sqlalchemy.orm import Session
from .database import get_db
from .models import User

password_hash = PasswordHash.recommended()
security = HTTPBearer()
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
ALGORITHM = "HS256"

def hash_password(password: str) -> str:
    return password_hash.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    return password_hash.verify(password, hashed)

def create_access_token(user_id: int) -> str:
    payload = {"sub": str(user_id), "exp": datetime.now(timezone.utc) + timedelta(minutes=60)}
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)) -> User:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
