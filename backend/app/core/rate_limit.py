# app/core/rate_limit.py
"""
Rate limiting configuration for SeqPulse API.

Protects endpoints from abuse, DDoS attacks, and buggy clients.
Uses slowapi (FastAPI wrapper for flask-limiter).
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request


def get_api_key_or_ip(request: Request) -> str:
    """
    Key function for rate limiting.
    
    Priority:
    1. API Key (from X-API-Key header) - for authenticated endpoints
    2. IP Address - fallback for public endpoints
    
    This allows different rate limits per API key vs per IP.
    """
    api_key = request.headers.get("X-API-Key")
    if api_key:
        return f"apikey:{api_key}"
    return f"ip:{get_remote_address(request)}"


# Global limiter instance
limiter = Limiter(
    key_func=get_api_key_or_ip,
    default_limits=["1000/hour"],  # Default: 1000 req/hour for all endpoints
    storage_uri="memory://",  # In-memory storage (simple, no Redis needed for MVP)
    strategy="fixed-window",  # Simple fixed window strategy
    headers_enabled=True,  # Enable X-RateLimit-* headers
    swallow_errors=False,  # Raise errors instead of swallowing them
)


# Rate limit configurations for different endpoint types
RATE_LIMITS = {
    # Public metrics endpoint - most restrictive
    "metrics_public": "10/minute",
    
    # Deployment endpoints - moderate (authenticated via API key)
    "deployments": "100/minute",
    
    # Dashboard/UI endpoints - permissive (human users)
    "dashboard": "1000/minute",
    
    # Auth endpoints - restrictive to prevent brute force
    "auth": "5/minute",
}
