import certifi
from flask import Blueprint, request, jsonify
from pymongo import MongoClient
from bson import ObjectId
from config import MONGO_URI
from middleware.auth_middleware import token_required
from datetime import datetime

incidents_bp = Blueprint("incidents", __name__)

client = MongoClient(MONGO_URI, tls=True, tlsCAFile=certifi.where(), tlsAllowInvalidCertificates=True)
db = client["securedesk"]
incidents_col = db["incidents"]
audit_col     = db["audit_logs"]

@incidents_bp.route("/incidents", methods=["GET"])
@token_required
def get_incidents():
    incidents = list(incidents_col.find({}, {"_id": 1, "title": 1, "type": 1,
        "severity": 1, "location": 1, "status": 1, "reported_by": 1,
        "reported_at": 1, "description": 1, "injuries": 1, "actions_taken": 1,
        "follow_up": 1}).sort("reported_at", -1).limit(50))
    for i in incidents:
        i["_id"] = str(i["_id"])
    return jsonify(incidents), 200

@incidents_bp.route("/incidents", methods=["POST"])
@token_required
def create_incident():
    data = request.get_json()
    incident = {
        "title":         data.get("title", "").strip(),
        "type":          data.get("type", ""),
        "severity":      data.get("severity", "low"),
        "location":      data.get("location", ""),
        "platform":      data.get("platform", ""),
        "description":   data.get("description", "").strip(),
        "injuries":      data.get("injuries", "none"),
        "injuries_desc": data.get("injuries_desc", ""),
        "actions_taken": data.get("actions_taken", "").strip(),
        "follow_up":     data.get("follow_up", "").strip(),
        "witnesses":     data.get("witnesses", ""),
        "status":        "open",
        "reported_by":   request.user.get("name"),
        "reported_email":request.user.get("email"),
        "department":    request.user.get("department"),
        "reported_at":   datetime.utcnow().isoformat(),
        "updated_at":    datetime.utcnow().isoformat(),
    }
    if not incident["title"]:
        return jsonify({"error": "Title required"}), 400

    result = incidents_col.insert_one(incident)
    incident["_id"] = str(result.inserted_id)

    # Log to audit
    audit_col.insert_one({
        "action": f"Incident reported: [{incident['severity'].upper()}] {incident['title']}",
        "target": incident["location"],
        "by": request.user.get("email"),
        "timestamp": datetime.utcnow().isoformat()
    })
    return jsonify(incident), 201

@incidents_bp.route("/incidents/<incident_id>/status", methods=["PATCH"])
@token_required
def update_status(incident_id):
    data = request.get_json()
    status = data.get("status")
    if status not in ["open", "investigating", "resolved", "closed"]:
        return jsonify({"error": "Invalid status"}), 400
    incidents_col.update_one(
        {"_id": ObjectId(incident_id)},
        {"$set": {"status": status, "updated_at": datetime.utcnow().isoformat()}}
    )
    return jsonify({"success": True}), 200