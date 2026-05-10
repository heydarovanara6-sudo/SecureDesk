import certifi
import os
import hashlib
import io
import jwt as pyjwt
from flask import Blueprint, request, jsonify, redirect, send_from_directory
from pymongo import MongoClient
from bson import ObjectId
from config import MONGO_URI
from middleware.auth_middleware import token_required
from datetime import datetime
from werkzeug.utils import secure_filename
from minio import Minio
from minio.error import S3Error

messages_bp = Blueprint("messages", __name__)

client = MongoClient(MONGO_URI, tls=True, tlsCAFile=certifi.where(), tlsAllowInvalidCertificates=True)
db = client["securedesk"]
messages_collection = db["messages"]
acknowledgements_collection = db["acknowledgements"]

JWT_SECRET = os.environ.get('JWT_SECRET', 'bp-securedesk-secret-2025')
MAX_FILE_SIZE = 20 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    'png', 'jpg', 'jpeg', 'gif', 'webp',
    'mp4', 'mov', 'avi',
    'pdf', 'doc', 'docx', 'txt', 'xlsx'
}

# Local fallback
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# MinIO config
MINIO_ENDPOINT_RAW = os.environ.get('MINIO_ENDPOINT', '')
MINIO_ENDPOINT = MINIO_ENDPOINT_RAW.replace('https://', '').replace('http://', '')
MINIO_ACCESS_KEY = os.environ.get('MINIO_ACCESS_KEY', '')
MINIO_SECRET_KEY = os.environ.get('MINIO_SECRET_KEY', '')
MINIO_BUCKET = os.environ.get('MINIO_BUCKET', 'securedesk-files')
MINIO_SECURE = os.environ.get('MINIO_SECURE', 'false').lower() == 'true'

minio_client = None
if MINIO_ENDPOINT and MINIO_ACCESS_KEY and MINIO_SECRET_KEY:
    try:
        minio_client = Minio(
            MINIO_ENDPOINT,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=MINIO_SECURE
        )
        if not minio_client.bucket_exists(MINIO_BUCKET):
            minio_client.make_bucket(MINIO_BUCKET)
        print(f"✅ MinIO connected: {MINIO_ENDPOINT}/{MINIO_BUCKET}")
    except Exception as e:
        print(f"⚠️ MinIO connection failed: {e}")
        minio_client = None
else:
    print("⚠️ MinIO env vars not set — using local storage")


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def hash_filename(original_filename, user_email):
    timestamp = str(datetime.utcnow().timestamp())
    raw = f"{user_email}:{original_filename}:{timestamp}"
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    ext = original_filename.rsplit('.', 1)[-1].lower() if '.' in original_filename else 'bin'
    return f"{hashed}.{ext}"

def generate_file_token(object_name, user_email):
    # No expiry — files stay accessible forever in chat
    payload = {"file": object_name, "sub": user_email}
    return pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verify_file_token(token, object_name):
    try:
        # Disable expiry verification for permanent file access
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"],
                               options={"verify_exp": False})
        return payload.get("file") == object_name
    except Exception:
        return False


@messages_bp.route("/messages/<channel_name>", methods=["GET"])
@token_required
def get_messages(channel_name):
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
            {"message_id": msg["_id"]}, {"_id": 0, "user_name": 1, "timestamp": 1}
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
    existing = acknowledgements_collection.find_one({"message_id": message_id, "user_email": user_email})
    if existing:
        return jsonify({"message": "Already acknowledged"}), 200
    acknowledgements_collection.insert_one({
        "message_id": message_id, "user_name": user_name,
        "user_email": user_email, "timestamp": datetime.utcnow().isoformat()
    })
    return jsonify({"message": "Acknowledged"}), 201


@messages_bp.route("/messages/search", methods=["GET"])
@token_required
def search_messages():
    channel = request.args.get("channel", "")
    sender = request.args.get("sender", "")
    priority = request.args.get("priority", "")
    date_from = request.args.get("date_from", "")
    date_to = request.args.get("date_to", "")
    filters = {}
    if channel: filters["channel"] = channel
    if sender: filters["sender_name"] = {"$regex": sender, "$options": "i"}
    if priority: filters["priority"] = priority
    if date_from or date_to:
        filters["timestamp"] = {}
        if date_from: filters["timestamp"]["$gte"] = date_from
        if date_to: filters["timestamp"]["$lte"] = date_to + "T23:59:59"
    messages = list(messages_collection.find(
        filters, {"_id": 1, "content": 1, "channel": 1, "sender_name": 1,
                  "sender_email": 1, "department": 1, "priority": 1, "timestamp": 1}
    ).sort("timestamp", -1).limit(100))
    for msg in messages:
        msg["_id"] = str(msg["_id"])
    return jsonify(messages), 200


@messages_bp.route("/upload", methods=["POST"])
@token_required
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": "File type not allowed"}), 400
    file_data = file.read()
    if len(file_data) > MAX_FILE_SIZE:
        return jsonify({"error": "File too large (max 20MB)"}), 400

    user_email = request.user.get("email")
    original_name = secure_filename(file.filename)
    object_name = hash_filename(original_name, user_email)
    content_type = file.content_type or 'application/octet-stream'
    use_minio = False

    if minio_client:
        try:
            minio_client.put_object(
                MINIO_BUCKET, object_name,
                io.BytesIO(file_data), length=len(file_data),
                content_type=content_type
            )
            use_minio = True
            print(f"✅ Uploaded to MinIO: {object_name}")
        except Exception as e:
            print(f"⚠️ MinIO upload failed, using local: {e}")

    if not use_minio:
        filepath = os.path.join(UPLOAD_FOLDER, object_name)
        with open(filepath, 'wb') as f:
            f.write(file_data)
        print(f"✅ Uploaded locally: {object_name}")

    file_token = generate_file_token(object_name, user_email)
    return jsonify({
        "url": f"/api/files/{object_name}",
        "file_token": file_token,
        "name": original_name,
        "storage": "minio" if use_minio else "local"
    }), 201


@messages_bp.route("/files/<object_name>", methods=["GET"])
def get_file(object_name):
    file_token = request.args.get("token")
    if not file_token or not verify_file_token(file_token, object_name):
        return jsonify({"error": "Unauthorized"}), 401

    if minio_client:
        try:
            from flask import Response
            response = minio_client.get_object(MINIO_BUCKET, object_name)
            content_type = response.headers.get('Content-Type', 'application/octet-stream')
            data = response.read()
            response.close()
            return Response(data, content_type=content_type,
                          headers={"Content-Disposition": f"inline; filename={object_name.split('.')[-2] if '.' in object_name else object_name}"})
        except Exception as e:
            print(f"⚠️ MinIO get failed: {e}")

    # Fallback to local
    filepath = os.path.join(UPLOAD_FOLDER, object_name)
    if os.path.exists(filepath):
        return send_from_directory(UPLOAD_FOLDER, object_name)

    return jsonify({"error": "File not found"}), 404