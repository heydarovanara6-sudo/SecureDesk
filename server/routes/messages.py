import certifi
from flask import Blueprint, request, jsonify
from pymongo import MongoClient
from bson import ObjectId
from config import MONGO_URI
from middleware.auth_middleware import token_required
from datetime import datetime

try:
    from safetext import SafeText
    st_en = SafeText(language='en')
    st_ru = SafeText(language='ru')
    st_az = SafeText(language='az')
    safetext_available = True
except:
    safetext_available = False

messages_bp = Blueprint("messages", __name__)

client = MongoClient(MONGO_URI, tls=True, tlsCAFile=certifi.where(), tlsAllowInvalidCertificates=True)
db = client["securedesk"]
messages_collection = db["messages"]
acknowledgements_collection = db["acknowledgements"]


@messages_bp.route("/messages/search", methods=["GET"])
@token_required
def search_messages():
    query = request.args.get("q", "").strip()
    channel = request.args.get("channel", "")
    sender = request.args.get("sender", "")
    priority = request.args.get("priority", "")
    date_from = request.args.get("date_from", "")
    date_to = request.args.get("date_to", "")

    filters = {}

    if channel:
        filters["channel"] = channel
    if sender:
        filters["sender_name"] = {"$regex": sender, "$options": "i"}
    if priority:
        filters["priority"] = priority
    if date_from or date_to:
        filters["timestamp"] = {}
        if date_from:
            filters["timestamp"]["$gte"] = date_from
        if date_to:
            filters["timestamp"]["$lte"] = date_to + "T23:59:59"

    messages = list(messages_collection.find(
        filters,
        {"_id": 1, "content": 1, "channel": 1, "sender_name": 1,
         "sender_email": 1, "department": 1, "priority": 1, "timestamp": 1}
    ).sort("timestamp", -1).limit(100))

    for msg in messages:
        msg["_id"] = str(msg["_id"])

    return jsonify(messages), 200

@messages_bp.route("/messages/<channel_name>", methods=["GET"])
@token_required
def get_messages(channel_name):
    # Clean expired self-destruct messages from DB
    messages_collection.delete_many({
        "channel": channel_name,
        "expires_at": {"$ne": None, "$lt": datetime.utcnow().isoformat()}
    })

    messages = list(messages_collection.find(
        {"channel": channel_name,
         "$or": [{"expires_at": None}, {"expires_at": {"$gt": datetime.utcnow().isoformat()}}]},
        {"_id": 1, "content": 1, "channel": 1, "sender_name": 1,
         "sender_email": 1, "department": 1, "priority": 1,
         "timestamp": 1, "requires_ack": 1, "expires_at": 1}
    ).sort("timestamp", 1).limit(50))

    for msg in messages:
        msg["_id"] = str(msg["_id"])
        acks = list(acknowledgements_collection.find(
            {"message_id": msg["_id"]},
            {"_id": 0, "user_name": 1, "timestamp": 1}
        ))
        msg["acknowledgements"] = acks

    return jsonify(messages), 200


@messages_bp.route("/messages", methods=["POST"])
@token_required
def send_message():
    data = request.get_json()
    message = {
        "content": data.get("content"),
        "channel": data.get("channel"),
        "sender_name": request.user.get("name"),
        "sender_email": request.user.get("email"),
        "department": request.user.get("department"),
        "priority": data.get("priority", "normal"),
        "requires_ack": data.get("requires_ack", False),
        "expires_at": data.get("expires_at", None),
        "timestamp": datetime.utcnow().isoformat()
    }
    result = messages_collection.insert_one(message)
    message["_id"] = str(result.inserted_id)
    return jsonify(message), 201


@messages_bp.route("/messages/<message_id>/acknowledge", methods=["POST"])
@token_required
def acknowledge_message(message_id):
    user_name = request.user.get("name")
    user_email = request.user.get("email")

    existing = acknowledgements_collection.find_one({
        "message_id": message_id,
        "user_email": user_email
    })

    if existing:
        return jsonify({"message": "Already acknowledged"}), 200

    acknowledgements_collection.insert_one({
        "message_id": message_id,
        "user_name": user_name,
        "user_email": user_email,
        "timestamp": datetime.utcnow().isoformat()
    })

    return jsonify({"message": "Acknowledged"}), 201

import os
from werkzeug.utils import secure_filename

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@messages_bp.route("/upload", methods=["POST"])
@token_required
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400
    file = request.files['file']
    filename = secure_filename(file.filename)
    unique_name = f"{datetime.utcnow().timestamp()}_{filename}"
    filepath = os.path.join(UPLOAD_FOLDER, unique_name)
    file.save(filepath)
    return jsonify({
        "url": f"/api/files/{unique_name}",
        "name": filename
    }), 201

@messages_bp.route("/files/<filename>", methods=["GET"])
@token_required
def get_file(filename):
    from flask import send_from_directory
    return send_from_directory(UPLOAD_FOLDER, filename)