from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session
from app.db.deps import get_db
from app.auth.schemas import (
    UserCreate,
    UserLogin,
    UserResponse,
    UserUpdateProfile,
    ChangePasswordRequest,
    MessageResponse,
)
from app.auth.service import create_access_token

from app.core.security import get_password_hash, verify_password
from app.db.models.user import User
from app.auth.deps import get_current_user
from app.core.rate_limit import limiter, RATE_LIMITS

router = APIRouter()


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(RATE_LIMITS["auth"])
def signup(request: Request, response: Response, user_in: UserCreate, db: Session = Depends(get_db)):
    # Vérifier l'email
    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email déjà utilisé.",
        )

    # Créer l'utilisateur
    new_user = User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user  # FastAPI le convertit en UserResponse



@router.post("/login")
@limiter.limit(RATE_LIMITS["auth"])
def login(request: Request, response: Response, user: UserLogin, db: Session = Depends(get_db)):

    db_user = db.query(User).filter(User.email == user.email).first()

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )

    if not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )

    # génération token
    access_token = create_access_token({"sub": db_user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {"email": current_user.email, "name": current_user.name}


@router.patch("/me", response_model=UserResponse)
@limiter.limit(RATE_LIMITS["dashboard"])
def update_me(
    request: Request,
    response: Response,
    payload: UserUpdateProfile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.name = payload.name
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password", response_model=MessageResponse)
@limiter.limit(RATE_LIMITS["auth"])
def change_password(
    request: Request,
    response: Response,
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    if verify_password(payload.new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password.",
        )

    current_user.hashed_password = get_password_hash(payload.new_password)
    db.add(current_user)
    db.commit()

    return {"message": "Password updated successfully."}
