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
        if request.user.get("role") not in ["admin", "super_admin"]:
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

    # Notify the user in real-time if they are currently connected
    if action == "approve":
        try:
            from app import socketio
            from sockets.events import connected_users
            for sid, u in connected_users.items():
                if u.get("email") == user_email:
                    socketio.emit("access_granted", {"channel_name": channel_name}, to=sid)
                    break
        except Exception as e:
            print(f"Socket notify failed: {e}")

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

# Security Dashboard stats
@admin_bp.route("/admin/security-stats", methods=["GET"])
@token_required
@require_admin
def security_stats():
    from pymongo import MongoClient
    import certifi
    from config import MONGO_URI

    # Reuse existing collections
    messages_col = db["messages"]
    tasks_col    = db.get_collection("tasks") if "tasks" in db.list_collection_names() else None

    now = datetime.utcnow()
    day_ago   = (now.replace(hour=0, minute=0, second=0)).isoformat()
    week_ago  = now.replace(day=max(1, now.day - 7)).isoformat()

    total_users      = users_collection.count_documents({})
    active_users     = users_collection.count_documents({"is_active": {"$ne": False}})
    deactivated      = total_users - active_users
    pending_requests = access_requests_collection.count_documents({"status": "pending"})
    total_messages   = messages_col.count_documents({})
    msgs_today       = messages_col.count_documents({"timestamp": {"$gte": day_ago}})
    urgent_msgs      = messages_col.count_documents({"priority": "urgent"})
    confidential     = messages_col.count_documents({"priority": "confidential"})
    expiring_msgs    = messages_col.count_documents({"expires_at": {"$ne": None}})
    audit_today      = audit_collection.count_documents({"timestamp": {"$gte": day_ago}})
    recent_audit     = list(audit_collection.find({}, {"_id": 0}).sort("timestamp", -1).limit(8))
    # Channel activity
    pipeline = [{"$group": {"_id": "$channel", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}}, {"$limit": 8}]
    channel_activity = list(messages_col.aggregate(pipeline))
    # Urgent messages (recent)
    recent_urgent = list(messages_col.find(
        {"priority": "urgent"},
        {"_id": 0, "sender_name": 1, "channel": 1, "timestamp": 1}
    ).sort("timestamp", -1).limit(5))

    return jsonify({
        "users": {
            "total": total_users,
            "active": active_users,
            "deactivated": deactivated,
            "pending_requests": pending_requests,
        },
        "messages": {
            "total": total_messages,
            "today": msgs_today,
            "urgent": urgent_msgs,
            "confidential": confidential,
            "self_destruct": expiring_msgs,
        },
        "audit": {
            "today": audit_today,
            "recent": recent_audit,
        },
        "channel_activity": channel_activity,
        "recent_urgent": recent_urgent,
        "encryption": {
            "algorithm": "AES-256",
            "key_location": "Client browser only",
            "server_sees": "Ciphertext only",
            "tls": "TLS 1.2+",
            "file_hashing": "SHA-256",
            "token_expiry": "1 hour",
        }
    }), 200