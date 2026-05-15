import certifi
import pyotp
import qrcode
import io
import base64
import random
import os
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

# ── Twilio ────────────────────────────────────────────────────────────────────
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN  = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER", "")

def _twilio_available():
    return bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER)

def _send_sms(to_number: str, code: str) -> bool:
    if not _twilio_available():
        return False
    try:
        from twilio.rest import Client as TwilioClient
        tc = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        tc.messages.create(
            body=f"Your SecureDesk verification code: {code}. Valid for 10 minutes.",
            from_=TWILIO_FROM_NUMBER,
            to=to_number
        )
        return True
    except Exception as e:
        print(f"[Twilio] SMS send failed: {e}")
        return False

def _generate_sms_otp() -> str:
    return str(random.randint(100000, 999999))


# ── REGISTER ──────────────────────────────────────────────────────────────────

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
        password.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")

    totp_secret = pyotp.random_base32()
    user = create_user(name, email, password_hash, department)
    user["phone"]       = phone
    user["totp_secret"] = totp_secret
    user["mfa_enabled"] = False
    users_collection.insert_one(user)

    totp_uri = pyotp.totp.TOTP(totp_secret).provisioning_uri(
        name=email, issuer_name="SecureDesk BP Azerbaijan"
    )
    img = qrcode.make(totp_uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_data_uri = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

    return jsonify({
        "message":       "Registration successful. Set up two-factor authentication.",
        "totp_uri":      totp_uri,
        "qr_code":       qr_data_uri,
        "email":         email,
        "phone_masked":  _mask_phone(phone),
        "sms_available": _twilio_available()
    }), 201


# ── SEND SMS OTP ──────────────────────────────────────────────────────────────

@auth_bp.route("/mfa/send-sms", methods=["POST"])
def send_sms_otp():
    """Send a 6-digit SMS code. Used at registration setup AND at login."""
    data  = request.get_json()
    email = data.get("email", "").strip().lower()

    user = users_collection.find_one({"email": email})
    if not user:
        return jsonify({"error": "User not found"}), 404
    if not _twilio_available():
        return jsonify({"error": "SMS service not configured on this server"}), 503

    phone = user.get("phone", "")
    if not phone:
        return jsonify({"error": "No phone number on file"}), 400

    code    = _generate_sms_otp()
    expires = datetime.utcnow() + timedelta(minutes=10)
    users_collection.update_one(
        {"email": email},
        {"$set": {"sms_otp": code, "sms_otp_expires": expires.isoformat()}}
    )

    if not _send_sms(phone, code):
        return jsonify({"error": "Failed to send SMS. Please try the authenticator app."}), 500

    return jsonify({
        "message":      f"Code sent to {_mask_phone(phone)}",
        "phone_masked": _mask_phone(phone)
    }), 200


# ── CONFIRM MFA SETUP — authenticator app ────────────────────────────────────

@auth_bp.route("/mfa/confirm", methods=["POST"])
def confirm_mfa():
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
        {"$set": {"mfa_enabled": True, "mfa_method": "totp"}}
    )
    return jsonify({"message": "MFA enabled successfully. You can now sign in."}), 200


# ── CONFIRM MFA SETUP — SMS ───────────────────────────────────────────────────

@auth_bp.route("/mfa/confirm-sms", methods=["POST"])
def confirm_mfa_sms():
    data  = request.get_json()
    email = data.get("email", "").strip().lower()
    otp   = data.get("otp", "").strip()

    user = users_collection.find_one({"email": email})
    if not user:
        return jsonify({"error": "User not found"}), 404
    if not _verify_sms_otp(user, otp):
        return jsonify({"error": "Invalid or expired code."}), 401

    users_collection.update_one(
        {"email": email},
        {"$set": {
            "mfa_enabled":     True,
            "mfa_method":      "sms",
            "sms_otp":         None,
            "sms_otp_expires": None
        }}
    )
    return jsonify({"message": "MFA enabled via SMS. You can now sign in."}), 200


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

    if user.get("mfa_enabled"):
        return jsonify({
            "mfa_required":  True,
            "email":         email,
            "mfa_method":    user.get("mfa_method", "totp"),
            "phone_masked":  _mask_phone(user.get("phone", "")),
            "sms_available": _twilio_available()
        }), 200

    token = _issue_token(user)
    return jsonify({"token": token, "user": _user_payload(user)}), 200


# ── VERIFY MFA ON LOGIN — authenticator app ───────────────────────────────────

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
    return jsonify({"token": token, "user": _user_payload(user)}), 200


# ── VERIFY MFA ON LOGIN — SMS ─────────────────────────────────────────────────

@auth_bp.route("/mfa/verify-sms", methods=["POST"])
def verify_mfa_sms():
    data  = request.get_json()
    email = data.get("email", "").strip().lower()
    otp   = data.get("otp", "").strip()

    user = users_collection.find_one({"email": email})
    if not user:
        return jsonify({"error": "User not found"}), 404
    if not _verify_sms_otp(user, otp):
        return jsonify({"error": "Invalid or expired code"}), 401

    users_collection.update_one(
        {"email": email},
        {"$set": {"sms_otp": None, "sms_otp_expires": None}}
    )
    token = _issue_token(user)
    return jsonify({"token": token, "user": _user_payload(user)}), 200


# ── HELPERS ───────────────────────────────────────────────────────────────────

def _verify_sms_otp(user: dict, otp: str) -> bool:
    stored     = user.get("sms_otp")
    expires_at = user.get("sms_otp_expires")
    if not stored or not expires_at:
        return False
    if datetime.utcnow() > datetime.fromisoformat(expires_at):
        return False
    return stored == otp

def _mask_phone(phone: str) -> str:
    if not phone or len(phone) < 6:
        return phone
    return phone[:3] + " ** *** " + phone[-4:]

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