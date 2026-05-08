import certifi
from flask import Blueprint, request, jsonify
from pymongo import MongoClient
from config import MONGO_URI
from middleware.auth_middleware import token_required
from datetime import datetime

admin_bp = Blueprint("admin", __name__)

client = MongoClient(MONGO_URI, tlsCAFile=certifi.where(), tlsAllowInvalidCertificates=True)
db = client["securedesk"]
users_collection = db["users"]
access_requests_collection = db["access_requests"]
audit_collection = db["audit_logs"]

def require_admin(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.user.get("role") != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated

# GET all users
@admin_bp.route("/admin/users", methods=["GET"])
@token_required
@require_admin
def get_users():
    users = list(users_collection.find(
        {},
        {"_id": 0, "password": 0}
    ))
    return jsonify(users), 200

# Deactivate/activate user
@admin_bp.route("/admin/users/<email>/toggle", methods=["POST"])
@token_required
@require_admin
def toggle_user(email):
    user = users_collection.find_one({"email": email})
    if not user:
        return jsonify({"error": "User not found"}), 404
    new_status = not user.get("is_active", True)
    users_collection.update_one(
        {"email": email},
        {"$set": {"is_active": new_status}}
    )
    action = "activated" if new_status else "deactivated"
    audit_collection.insert_one({
        "action": f"User {action}",
        "target": email,
        "by": request.user.get("email"),
        "timestamp": datetime.utcnow().isoformat()
    })
    return jsonify({"message": f"User {action}"}), 200

# GET all access requests
@admin_bp.route("/admin/requests", methods=["GET"])
@token_required
@require_admin
def get_requests():
    requests_list = list(access_requests_collection.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1))
    return jsonify(requests_list), 200

# Approve/deny access request
@admin_bp.route("/admin/requests/<user_email>/<channel_name>/<action>", methods=["POST"])
@token_required
@require_admin
def handle_request(user_email, channel_name, action):
    if action not in ["approve", "deny"]:
        return jsonify({"error": "Invalid action"}), 400

    status = "approved" if action == "approve" else "denied"
    access_requests_collection.update_one(
        {"user_email": user_email, "channel_name": channel_name, "status": "pending"},
        {"$set": {"status": status, "resolved_at": datetime.utcnow().isoformat()}}
    )
    audit_collection.insert_one({
        "action": f"Access {status}",
        "target": f"{user_email} → #{channel_name}",
        "by": request.user.get("email"),
        "timestamp": datetime.utcnow().isoformat()
    })
    return jsonify({"message": f"Request {status}"}), 200

# GET audit logs
@admin_bp.route("/admin/audit", methods=["GET"])
@token_required
@require_admin
def get_audit():
    logs = list(audit_collection.find(
        {},
        {"_id": 0}
    ).sort("timestamp", -1).limit(50))
    return jsonify(logs), 200