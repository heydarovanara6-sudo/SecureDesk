import certifi
from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from pymongo import MongoClient
from config import MONGO_URI

app = Flask(__name__)
CORS(app, origins="http://localhost:3000")
socketio = SocketIO(app, cors_allowed_origins="http://localhost:3000")

client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())

db = client["securedesk"]
users_collection = db["users"]
messages_collection = db["messages"]
channels_collection = db["channels"]

from routes.auth import auth_bp
from routes.channels import channels_bp
from routes.messages import messages_bp
from routes.handover import handover_bp

app.register_blueprint(auth_bp, url_prefix="/api")
app.register_blueprint(channels_bp, url_prefix="/api")
app.register_blueprint(messages_bp, url_prefix="/api")
app.register_blueprint(handover_bp, url_prefix="/api")

from sockets.events import register_socket_events
register_socket_events(socketio)

def create_default_channels():
    channels = [
        {"name": "general", "description": "All Employees", "icon": "🌐"},
        {"name": "acg-operations", "description": "ACG Offshore Platform", "icon": "🛢️"},
        {"name": "shah-deniz", "description": "Shah Deniz Pipeline", "icon": "⚙️"},
        {"name": "hr-confidential", "description": "HR Department", "icon": "👥"},
        {"name": "legal", "description": "Legal Team", "icon": "⚖️"},
        {"name": "finance", "description": "Finance Team", "icon": "💰"},
        {"name": "executive", "description": "Executive Team", "icon": "🏢"},
        {"name": "it-security", "description": "IT & Security", "icon": "🔒"},
    ]
    for channel in channels:
        if not channels_collection.find_one({"name": channel["name"]}):
            channels_collection.insert_one(channel)
    print("✅ BP Azerbaijan channels ready")

if __name__ == "__main__":
    create_default_channels()
    print("🚀 SecureDesk server starting...")
    socketio.run(app, debug=True, port=5000)