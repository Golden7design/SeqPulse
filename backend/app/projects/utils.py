# app/projects/utils.py
import secrets
import uuid

def generate_api_key() -> str:
    """
    Génère une clé API unique qui commence par SP_
    """
    return f"SP_{uuid.uuid4().hex}"

def generate_hmac_secret() -> str:
    """Secret HMAC pour signer les requêtes sortantes (SeqPulse → App)"""
    return f"spm_{secrets.token_urlsafe(32)}"