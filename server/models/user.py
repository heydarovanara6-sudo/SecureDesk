from datetime import datetime

def create_user(name, email, password_hash, department, role="employee"):
    return {
        "name":        name,
        "email":       email,
        "password":    password_hash,
        "department":  department,
        "role":        role,
        "phone":       "",
        "totp_secret": "",
        "mfa_enabled": False,
        "is_active":   True,
        "created_at":  datetime.utcnow()
    }