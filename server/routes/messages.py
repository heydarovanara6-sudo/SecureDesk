import certifi
import os
import hashlib
import hmac
from flask import Blueprint, request, jsonify, send_from_directory, abort
from pymongo import MongoClient
from bson import ObjectId
from config import MONGO_URI
from middleware.auth_middleware import token_required
from datetime import datetime
from werkzeug.utils import secure_filename
import jwt

messages_bp = Blueprint("messages", __name__)

client = MongoClient(MONGO_URI, tls=True, tlsCAFile=certifi.where(), tlsAllowInvalidCertificates=True)
db = client["securedesk"]
messages_collection = db["messages"]
acknowledgements_collection = db["acknowledgements"]

# Absolute upload folder path
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {
    'png', 'jpg', 'jpeg', 'gif', 'webp',
    'mp4', 'mov', 'avi',
    'pdf', 'doc', 'docx', 'txt', 'xlsx'
}

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

JWT_SECRET = os.environ.get('JWT_SECRET', 'bp-securedesk-secret-2025')


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def hash_filename(original_filename, user_email):
    """Generate a SHA-256 hashed filename so stored files are not guessable."""
    timestamp = str(datetime.utcnow().timestamp())
    raw = f"{user_email}:{original_filename}:{timestamp}"
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    ext = original_filename.rsplit('.', 1)[-1].lower() if '.' in original_filename else 'bin'
    return f"{hashed}.{ext}"


def generate_file_token(filename, user_email):
    """Generate a short-lived signed token for file access."""
    payload = {
        "file": filename,
        "sub": user_email,
        "exp": datetime.utcnow().timestamp() + 3600  # 1 hour expiry
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def verify_file_token(token, filename):
    """Verify that the file access token is valid and matches the filename."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload.get("file") == filename
    except Exception:
        return False


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


@messages_bp.route("/upload", methods=["POST"])
@token_required
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({"error": "Empty filename"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "File type not allowed"}), 400

    # Check file size
    file.seek(0, 2)  # Seek to end
    size = file.tell()
    file.seek(0)     # Reset
    if size > MAX_FILE_SIZE:
        return jsonify({"error": "File too large (max 20MB)"}), 400

    user_email = request.user.get("email")
    original_name = secure_filename(file.filename)

    # SHA-256 hashed filename — not guessable
    hashed_name = hash_filename(original_name, user_email)
    filepath = os.path.join(UPLOAD_FOLDER, hashed_name)
    file.save(filepath)

    # Generate signed access token for this file
    file_token = generate_file_token(hashed_name, user_email)

    return jsonify({
        "url": f"/api/files/{hashed_name}",
        "file_token": file_token,
        "name": original_name
    }), 201


@messages_bp.route("/files/<filename>", methods=["GET"])
def get_file(filename):
    """
    Serve files securely using a signed file_token in query params.
    Using query param instead of header because <img src> can't send headers.
    """
    file_token = request.args.get("token")
    if not file_token:
        abort(401)

    if not verify_file_token(file_token, filename):
        abort(403)

    filepath = os.path.join(UPLOAD_FOLDER, filename)
    if not os.path.exists(filepath):
        abort(404)

    return send_from_directory(UPLOAD_FOLDER, filename)