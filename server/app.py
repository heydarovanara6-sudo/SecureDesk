import certifi
from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from pymongo import MongoClient
from config import MONGO_URI

app = Flask(__name__)

CORS(app,
     origins=[
         "https://securedesk.xyz",
         "https://www.securedesk.xyz",
         "http://securedesk.xyz",
         "http://localhost:3000",
         "http://127.0.0.1:3000"
     ],
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
)

socketio = SocketIO(app,
    cors_allowed_origins=[
        "https://securedesk.xyz",
        "https://www.securedesk.xyz",
        "http://securedesk.xyz",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    async_mode='eventlet',
    logger=False,
    engineio_logger=False
)

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
from routes.agent import agent_bp  # ← moved here

app.register_blueprint(auth_bp, url_prefix="/api")
app.register_blueprint(channels_bp, url_prefix="/api")
app.register_blueprint(messages_bp, url_prefix="/api")
app.register_blueprint(handover_bp, url_prefix="/api")
app.register_blueprint(admin_bp, url_prefix="/api")
app.register_blueprint(ai_bp, url_prefix="/api")
app.register_blueprint(tasks_bp, url_prefix="/api")
app.register_blueprint(incidents_bp, url_prefix="/api")
app.register_blueprint(agent_bp, url_prefix="/api")  # ← moved here