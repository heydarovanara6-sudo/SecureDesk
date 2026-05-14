import certifi
import pyotp
import qrcode
import io
import base64
from flask import Blueprint, request, jsonify
from pymongo import MongoClient
import bcrypt
import jwt
from datetime import datetime, timedelta
from config import MONGO_URI, JWT_SECRET
from models.user import create_user
from middleware.auth_middleware import token_required

auth_bp = Blueprint("auth", __name__)

client = MongoClient(MONGO_URI, tls=True, tlsCAFile=certifi.where(), tlsAllowInvalidCertificates=True)
db = client["securedesk"]
users_collection = db["users"]


# ── REGISTER ─────────────────────────────────────────────────────────────────

@auth_bp.route("/register", methods=["POST"])
def register():
    data       = request.get_json()
    name       = data.get("name", "").strip()
    email      = data.get("email", "").strip().lower()
    password   = data.get("password", "")
    department = data.get("department", "")
    phone      = data.get("phone", "").strip()

    if not email.endswith("@bp.com"):
        return jsonify({"error": "Only @bp.com emails are allowed"}), 403

    if not phone:
        return jsonify({"error": "Phone number is required"}), 400

    if users_collection.find_one({"email": email}):
        return jsonify({"error": "Email already registered"}), 409

    password_hash = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")

    # Generate TOTP secret for this user
    totp_secret = pyotp.random_base32()

    user = create_user(name, email, password_hash, department)
    user["phone"]       = phone
    user["totp_secret"] = totp_secret
    user["mfa_enabled"] = False   # becomes True after user confirms first OTP
    users_collection.insert_one(user)

    # Build QR code data URI
    totp_uri = pyotp.totp.TOTP(totp_secret).provisioning_uri(
        name=email,
        issuer_name="SecureDesk BP Azerbaijan"
    )
    img = qrcode.make(totp_uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    qr_data_uri = f"data:image/png;base64,{qr_b64}"

    return jsonify({
        "message": "Registration successful. Scan the QR code with your authenticator app.",
        "totp_uri": totp_uri,
        "qr_code":  qr_data_uri,
        "email":    email
    }), 201


# ── CONFIRM MFA SETUP (first OTP after registration) ─────────────────────────

@auth_bp.route("/mfa/confirm", methods=["POST"])
def confirm_mfa():
    """Called right after registration — user scans QR and enters first code."""
    data  = request.get_json()
    email = data.get("email", "").strip().lower()
    otp   = data.get("otp", "").strip()

    user = users_collection.find_one({"email": email})
    if not user:
        return jsonify({"error": "User not found"}), 404

    totp = pyotp.TOTP(user["totp_secret"])
    if not totp.verify(otp, valid_window=1):
        return jsonify({"error": "Invalid code. Please try again."}), 401

    users_collection.update_one(
        {"email": email},
        {"$set": {"mfa_enabled": True}}
    )
    return jsonify({"message": "MFA enabled successfully. You can now sign in."}), 200


# ── LOGIN ─────────────────────────────────────────────────────────────────────

@auth_bp.route("/login", methods=["POST"])
def login():
    data     = request.get_json()
    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    user = users_collection.find_one({"email": email})
    if not user:
        return jsonify({"error": "Invalid email or password"}), 401

    if not bcrypt.checkpw(password.encode("utf-8"), user["password"].encode("utf-8")):
        return jsonify({"error": "Invalid email or password"}), 401

    if not user.get("is_active", True):
        return jsonify({"error": "Account deactivated. Contact your administrator."}), 403

    # If MFA is enabled, require OTP before issuing token
    if user.get("mfa_enabled"):
        return jsonify({"mfa_required": True, "email": email}), 200

    # MFA not yet set up (edge case: old account) — issue token directly
    token = _issue_token(user)
    return jsonify({
        "token": token,
        "user":  _user_payload(user)
    }), 200


# ── VERIFY MFA ON LOGIN ───────────────────────────────────────────────────────

@auth_bp.route("/mfa/verify", methods=["POST"])
def verify_mfa():
    data  = request.get_json()
    email = data.get("email", "").strip().lower()
    otp   = data.get("otp", "").strip()

    user = users_collection.find_one({"email": email})
    if not user:
        return jsonify({"error": "User not found"}), 404

    totp = pyotp.TOTP(user["totp_secret"])
    if not totp.verify(otp, valid_window=1):
        return jsonify({"error": "Invalid or expired code"}), 401

    token = _issue_token(user)
    return jsonify({
        "token": token,
        "user":  _user_payload(user)
    }), 200


# ── HELPERS ───────────────────────────────────────────────────────────────────

def _issue_token(user):
    return jwt.encode({
        "user_id":    str(user["_id"]),
        "email":      user["email"],
        "name":       user["name"],
        "role":       user["role"],
        "department": user["department"],
        "exp":        datetime.utcnow() + timedelta(hours=24)
    }, JWT_SECRET, algorithm="HS256")


def _user_payload(user):
    return {
        "name":       user["name"],
        "email":      user["email"],
        "role":       user["role"],
        "department": user["department"],
        "phone":      user.get("phone", "")
    }


# ── LIST USERS ────────────────────────────────────────────────────────────────

@auth_bp.route("/users", methods=["GET"])
@token_required
def get_users():
    users = list(users_collection.find(
        {"is_active": True},
        {"_id": 0, "name": 1, "email": 1, "department": 1}
    ))
    return jsonify(users), 200