"""Аутентификация запросов: front-end подписывает их общим токеном API_TOKEN."""

import secrets

from fastapi import Header, HTTPException, status

from .config import get_settings


def require_token(authorization: str | None = Header(default=None)) -> None:
    expected = get_settings().api_token
    if not expected:
        return
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not secrets.compare_digest(token, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Нужен заголовок Authorization: Bearer <API_TOKEN>")
