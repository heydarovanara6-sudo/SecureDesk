import certifi
from flask import Blueprint, request, jsonify
from pymongo import MongoClient
from config import MONGO_URI
from middleware.auth_middleware import token_required
from datetime import datetime

channels_bp = Blueprint("channels", __name__)

client = MongoClient(MONGO_URI, tlsCAFile=certifi.where(), tlsAllowInvalidCertificates=True)
db = client["securedesk"]
channels_collection = db["channels"]
access_requests_collection = db["access_requests"]

@channels_bp.route("/channels", methods=["GET"])
@token_required
def get_channels():
    channels = list(channels_collection.find({}, {"_id": 0, "password": 0}))
    return jsonify(channels), 200

@channels_bp.route("/channels/request", methods=["POST"])
@token_required
def request_access():
    data = request.get_json()
    channel_name = data.get("channel_name")
    user_name = request.user.get("name")
    user_email = request.user.get("email")
    department = request.user.get("department")

    # Check if request already exists
    existing = access_requests_collection.find_one({
        "user_email": user_email,
        "channel_name": channel_name,
        "status": "pending"
    })
    if existing:
        return jsonify({"message": "Request already pending"}), 200

    access_requests_collection.insert_one({
        "user_name": user_name,
        "user_email": user_email,
        "department": department,
        "channel_name": channel_name,
        "status": "pending",
        "created_at": datetime.utcnow().isoformat()
    })
    return jsonify({"message": "Access request sent to admin"}), 201

@channels_bp.route("/channels/my-access", methods=["GET"])
@token_required
def get_my_access():
    user_email = request.user.get("email")
    approved = list(access_requests_collection.find(
        {"user_email": user_email, "status": "approved"},
        {"_id": 0, "channel_name": 1}
    ))
    return jsonify([r["channel_name"] for r in approved]), 200