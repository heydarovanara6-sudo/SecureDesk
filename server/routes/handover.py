import certifi
from flask import Blueprint, request, jsonify
from pymongo import MongoClient
from config import MONGO_URI 
from middleware.auth_middleware import token_required 
from datetime import datetime

handover_bp = Blueprint("handover", __name__)

client = MongoClient(MONGO_URI, tls=True, tlsCAFile=certifi.where(), tlsAllowInvalidCertificates=True)
db = client["securedesk"]
handovers_collection = db["handovers"]

@handover_bp.route("/handover", methods=["POST"])
@token_required
def create_handover():
    data = request.get_json()
    handover = {
        "shift_time": data.get("shift_time"),
        "engineer_name": request.user.get("name"),
        "platform_status": data.get("platform_status"),
        "issues_flagged": data.get("issues_flagged"),
        "action_needed": data.get("action_needed"),
        "next_engineer": data.get("next_engineer"),
        "channel": "acg-operations",
        "timestamp": datetime.utcnow().isoformat()
    }
    result = handovers_collection.insert_one(handover)
    handover["_id"] = str(result.inserted_id)
    return jsonify(handover), 201


@handover_bp.route("/handover/latest", methods=["GET"])
@token_required
def get_latest_handover():
    handover = handovers_collection.find_one(
        {}, sort=[("timestamp", -1)]
    )
    if handover:
        handover["_id"] = str(handover["_id"])
        return jsonify(handover), 200
    return jsonify(None), 200


@handover_bp.route("/handover/history", methods=["GET"])
@token_required
def get_handover_history():
    handovers = list(handovers_collection.find(
        {}, {"_id": 1, "shift_time": 1, "engineer_name": 1,
             "platform_status": 1, "timestamp": 1}
    ).sort("timestamp", -1).limit(10))
    for h in handovers:
        h["_id"] = str(h["_id"])
    return jsonify(handovers), 200