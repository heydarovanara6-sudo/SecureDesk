from flask_socketio import emit, join_room, leave_room
from flask import request
import jwt
from config import JWT_SECRET

connected_users = {}

def register_socket_events(socketio):

    @socketio.on('connect')
    def handle_connect():
        token = request.args.get('token')
        if not token:
            return False
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            connected_users[request.sid] = {
                "name": data["name"],
                "email": data["email"],
                "department": data["department"]
            }
            emit('user_connected', {
                "name": data["name"],
                "online_users": list(connected_users.values())
            }, broadcast=True)
            print(f"✅ {data['name']} connected")
        except:
            return False

    @socketio.on('disconnect')
    def handle_disconnect():
        user = connected_users.pop(request.sid, None)
        if user:
            emit('user_disconnected', {
                "name": user["name"],
                "online_users": list(connected_users.values())
            }, broadcast=True)
            print(f"❌ {user['name']} disconnected")

    @socketio.on('join_channel')
    def handle_join(data):
        channel = data.get('channel')
        join_room(channel)
        print(f"👥 {connected_users.get(request.sid, {}).get('name')} joined #{channel}")

    @socketio.on('leave_channel')
    def handle_leave(data):
        channel = data.get('channel')
        leave_room(channel)

    @socketio.on('send_message')
    def handle_message(data):
        user = connected_users.get(request.sid)
        if not user:
            return
        message = {
            "content": data.get("content"),
            "channel": data.get("channel"),
            "priority": data.get("priority", "normal"),
            "sender_name": user["name"],
            "sender_email": user["email"],
            "department": user["department"],
            "timestamp": data.get("timestamp")
        }
        # Broadcast to everyone in the channel room
        emit('new_message', message, room=data.get("channel"))

    @socketio.on('typing')
    def handle_typing(data):
        user = connected_users.get(request.sid)
        if not user:
            return
        emit('user_typing', {
            "name": user["name"],
            "channel": data.get("channel")
        }, room=data.get("channel"), include_self=False)

    @socketio.on('emergency_broadcast')
    def handle_emergency(data):
        user = connected_users.get(request.sid)
        if not user:
            return
        print(f"🚨 EMERGENCY BROADCAST from {user['name']}: {data.get('message')}")
        emit('emergency_alert', {
            "message": data.get("message"),
            "sender": user["name"],
            "department": user["department"]
        }, broadcast=True)