import certifi
from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from pymongo import MongoClient
from config import MONGO_URI

app = Flask(__name__)
CORS(app, origins=["https://securedesk.xyz", "http://securedesk.xyz", "http://localhost:3000"], supports_credentials=True)
socketio = SocketIO(app, cors_allowed_origins="http://localhost:3000")

client = MongoClient(MONGO_URI, tlsCAFile=certifi.where(), tlsAllowInvalidCertificates=True)

db = client["securedesk"]
users_collection = db["users"]
messages_collection = db["messages"]
channels_collection = db["channels"]

from routes.auth import auth_bp
from routes.channels import channels_bp
from routes.messages import messages_bp
from routes.handover import handover_bp
from routes.admin import admin_bp
from routes.ai import ai_bp
from routes.tasks import tasks_bp
from routes.incidents import incidents_bp

app.register_blueprint(auth_bp, url_prefix="/api")
app.register_blueprint(channels_bp, url_prefix="/api")
app.register_blueprint(messages_bp, url_prefix="/api")
app.register_blueprint(handover_bp, url_prefix="/api")
app.register_blueprint(admin_bp, url_prefix="/api")
app.register_blueprint(ai_bp, url_prefix="/api")
app.register_blueprint(tasks_bp, url_prefix="/api")
app.register_blueprint(incidents_bp, url_prefix="/api")

from sockets.events import register_socket_events
register_socket_events(socketio)

def create_default_channels():
    channels = [
        {"name": "general", "description": "All Employees", "icon": "🌐", "type": "public", "department": None},
        {"name": "acg-operations", "description": "ACG Offshore Platform", "icon": "🛢️", "type": "department", "department": "ACG Operations"},
        {"name": "shah-deniz", "description": "Shah Deniz Pipeline", "icon": "⚙️", "type": "department", "department": "Shah Deniz"},
        {"name": "hr-confidential", "description": "HR Department", "icon": "👥", "type": "department", "department": "HR"},
        {"name": "legal", "description": "Legal Team", "icon": "⚖️", "type": "department", "department": "Legal"},
        {"name": "finance", "description": "Finance Team", "icon": "💰", "type": "department", "department": "Finance"},
        {"name": "executive", "description": "Executive Team", "icon": "🏢", "type": "restricted", "department": "Executive"},
        {"name": "it-security", "description": "IT & Security", "icon": "🔒", "type": "department", "department": "IT Security"},
    ]
    for channel in channels:
        existing = channels_collection.find_one({"name": channel["name"]})
        if not existing:
            channels_collection.insert_one(channel)
        else:
            channels_collection.update_one(
                {"name": channel["name"]},
                {"$set": {
                    "type": channel["type"],
                    "department": channel["department"]
                }}
            )
    print("✅ BP Azerbaijan channels ready")

if __name__ == "__main__":
    create_default_channels()
    print("🚀 SecureDesk server starting...")
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)