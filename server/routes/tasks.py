import certifi
from flask import Blueprint, request, jsonify
from pymongo import MongoClient
from bson import ObjectId
from config import MONGO_URI
from middleware.auth_middleware import token_required
from datetime import datetime

tasks_bp = Blueprint("tasks", __name__)

client = MongoClient(MONGO_URI, tls=True, tlsCAFile=certifi.where(), tlsAllowInvalidCertificates=True)
db = client["securedesk"]
tasks_collection = db["tasks"]

@tasks_bp.route("/tasks", methods=["GET"])
@token_required
def get_tasks():
    channel = request.args.get("channel", "")
    filters = {}
    if channel:
        filters["channel"] = channel
    tasks = list(tasks_collection.find(filters).sort("created_at", -1))
    for t in tasks:
        t["_id"] = str(t["_id"])
    return jsonify(tasks), 200

@tasks_bp.route("/tasks", methods=["POST"])
@token_required
def create_task():
    data = request.get_json()
    task = {
        "title": data.get("title", "").strip(),
        "description": data.get("description", "").strip(),
        "assigned_to": data.get("assigned_to", ""),
        "assigned_email": data.get("assigned_email", ""),
        "priority": data.get("priority", "normal"),
        "status": "open",
        "channel": data.get("channel", "general"),
        "due_date": data.get("due_date", ""),
        "created_by": request.user.get("name"),
        "created_by_email": request.user.get("email"),
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "comments": []
    }
    if not task["title"]:
        return jsonify({"error": "Title required"}), 400
    result = tasks_collection.insert_one(task)
    task["_id"] = str(result.inserted_id)
    return jsonify(task), 201

@tasks_bp.route("/tasks/<task_id>", methods=["PATCH"])
@token_required
def update_task(task_id):
    data = request.get_json()
    allowed = ["status", "priority", "assigned_to", "assigned_email", "due_date", "description", "title"]
    updates = {k: v for k, v in data.items() if k in allowed}
    updates["updated_at"] = datetime.utcnow().isoformat()
    tasks_collection.update_one({"_id": ObjectId(task_id)}, {"$set": updates})
    return jsonify({"success": True}), 200

@tasks_bp.route("/tasks/<task_id>/comment", methods=["POST"])
@token_required
def add_comment(task_id):
    data = request.get_json()
    comment = {
        "text": data.get("text", "").strip(),
        "author": request.user.get("name"),
        "time": datetime.utcnow().isoformat()
    }
    if not comment["text"]:
        return jsonify({"error": "Comment text required"}), 400
    tasks_collection.update_one(
        {"_id": ObjectId(task_id)},
        {"$push": {"comments": comment}, "$set": {"updated_at": datetime.utcnow().isoformat()}}
    )
    return jsonify({"success": True}), 200

@tasks_bp.route("/tasks/<task_id>", methods=["DELETE"])
@token_required
def delete_task(task_id):
    tasks_collection.delete_one({"_id": ObjectId(task_id)})
    return jsonify({"success": True}), 200