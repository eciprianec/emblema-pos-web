from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..schemas import UserLogin, UserCreate, UserOut, TokenOut
from ..auth import verify_password, get_password_hash, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=TokenOut)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        (User.username == payload.username_or_email) | (User.email == payload.username_or_email)
    ).first()
    
    if not user or not verify_password(payload.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario o contraseña incorrectos"
        )
        
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Esta cuenta de usuario está desactivada")
        
    token = create_access_token(data={"user_id": user.id, "username": user.username, "role": user.role})
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/users", response_model=list[UserOut])
def get_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(User).order_by(User.full_name.asc()).all()

@router.post("/users", response_model=UserOut)
def create_user(
    payload: UserCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Solo los administradores pueden crear usuarios")
        
    existing = db.query(User).filter(
        (User.username == payload.username) | (User.email == payload.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="El nombre de usuario o correo ya está registrado")
        
    new_user = User(
        username=payload.username,
        email=payload.email,
        password=get_password_hash(payload.password),
        full_name=payload.full_name,
        role=payload.role or "cajero",
        can_discount=payload.can_discount,
        can_view_costs=payload.can_view_costs,
        can_modify_inventory=payload.can_modify_inventory,
        can_corte=payload.can_corte,
        can_cancel_sales=payload.can_cancel_sales
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user
