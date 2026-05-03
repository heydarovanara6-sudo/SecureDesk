from flask import Blueprint, request, jsonify
from pymongo import MongoClient
import bcrypt
import jwt
from datetime import datetime, timedelta
from config import MONGO_URI, JWT_SECRET
from models.user import create_user

auth_bp = Blueprint("auth", __name__)

client = MongoClient(MONGO_URI, tlsAllowInvalidCertificates=True)
db = client["securedesk"]
users_collection = db["users"]

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    department = data.get("department")

    if not email.endswith("@bp.com"):
        return jsonify({"error": "Only @bp.com emails are allowed"}), 403

    if users_collection.find_one({"email": email}):
        return jsonify({"error": "Email already registered"}), 409

    password_hash = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")

    user = create_user(name, email, password_hash, department)
    users_collection.insert_one(user)

    return jsonify({"message": "Registration successful"}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    user = users_collection.find_one({"email": email})
    if not user:
        return jsonify({"error": "Invalid email or password"}), 401

    if not bcrypt.checkpw(
        password.encode("utf-8"),
        user["password"].encode("utf-8")
    ):
        return jsonify({"error": "Invalid email or password"}), 401

    if not user.get("is_active", True):
        return jsonify({"error": "Account deactivated"}), 403

    token = jwt.encode({
        "user_id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "department": user["department"],
        "exp": datetime.utcnow() + timedelta(hours=24)
    }, JWT_SECRET, algorithm="HS256")

    return jsonify({
        "token": token,
        "user": {
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "department": user["department"]
        }
    }), 200