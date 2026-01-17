# app/projects/utils.py
import uuid

def generate_api_key() -> str:
    """
    Génère une clé API unique qui commence par SP_
    """
    return f"SP_{uuid.uuid4().hex}"
