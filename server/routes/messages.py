import certifi
from flask import Blueprint, request, jsonify
from pymongo import MongoClient
from bson import ObjectId
from config import MONGO_URI
from middleware.auth_middleware import token_required
from datetime import datetime

messages_bp = Blueprint("messages", __name__)

client = MongoClient(MONGO_URI, tls=True, tlsCAFile=certifi.where(), tlsAllowInvalidCertificates=True)
db = client["securedesk"]
messages_collection = db["messages"]
acknowledgements_collection = db["acknowledgements"]

@messages_bp.route("/messages/<channel_name>", methods=["GET"])
@token_required
def get_messages(channel_name):
    messages = list(messages_collection.find(
        {"channel": channel_name},
        {"_id": 1, "content": 1, "channel": 1, "sender_name": 1,
         "sender_email": 1, "department": 1, "priority": 1,
         "timestamp": 1, "requires_ack": 1}
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