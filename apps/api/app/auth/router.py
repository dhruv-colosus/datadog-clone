from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.auth.schemas import LoginRequest, RegisterRequest, UserOut
from app.auth.service import (
    EmailAlreadyRegisteredError,
    authenticate_user,
    register_user,
)
from app.core.config import get_settings
from app.core.security import create_access_token

settings = get_settings()

router = APIRouter(prefix="/auth", tags=["auth"])

TEST_USER_PASSWORD = "password123"


def _set_auth_cookie(response: Response, user_id: int) -> None:
    token = create_access_token(subject=user_id)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,  # type: ignore[arg-type]
        domain=settings.cookie_domain,
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    payload: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        user = await register_user(
            db,
            email=payload.email,
            password=payload.password,
            name=payload.name,
        )
    except EmailAlreadyRegisteredError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    _set_auth_cookie(response, user.id)
    return user


@router.post("/login", response_model=UserOut)
async def login(
    payload: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> User:
    user = await authenticate_user(
        db, email=payload.email, password=payload.password
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    _set_auth_cookie(response, user.id)
    return user


@router.get("/config")
def auth_config() -> dict:
    """Public auth surface — lets the frontend conditionally render the
    test-login button when running against a local docker stack."""
    return {"test_auth_enabled": settings.test_auth_enabled}


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/logout")
def logout(response: Response) -> dict:
    response.delete_cookie(
        key="access_token",
        path="/",
        domain=settings.cookie_domain,
    )
    return {"message": "Logged out"}


@router.post("/test-login", response_model=UserOut)
async def test_login(
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> User:
    if not settings.test_auth_enabled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )

    user = await authenticate_user(
        db, email=settings.test_auth_email, password=TEST_USER_PASSWORD
    )
    if user is None:
        try:
            user = await register_user(
                db,
                email=settings.test_auth_email,
                password=TEST_USER_PASSWORD,
                name=settings.test_auth_name,
            )
        except EmailAlreadyRegisteredError:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Test user exists with a different password",
            )

    _set_auth_cookie(response, user.id)
    return user
