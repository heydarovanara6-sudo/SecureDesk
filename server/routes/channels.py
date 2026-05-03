from flask import Blueprint, jsonify
from pymongo import MongoClient
from config import MONGO_URI
from middleware.auth_middleware import token_required

channels_bp = Blueprint("channels", __name__)

client = MongoClient(MONGO_URI, tlsAllowInvalidCertificates=True)
db = client["securedesk"]
channels_collection = db["channels"]

@channels_bp.route("/channels", methods=["GET"])
@token_required
def get_channels():
    channels = list(channels_collection.find({}, {"_id": 0}))
    return jsonify(channels), 200