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
                "department": data["department"],
                "role": data.get("role", "employee")
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

        content = data.get("content", "")

        # Server-side profanity check placeholder
        # Content is AES-256 encrypted so actual text check happens on frontend
        # Backend logs metadata only

        import uuid
        msg_id = str(uuid.uuid4())
        message = {
            "_id": msg_id,
            "content": content,
            "channel": data.get("channel"),
            "priority": data.get("priority", "normal"),
            "sender_name": user["name"],
            "sender_email": user["email"],
            "department": user["department"],
            "timestamp": data.get("timestamp"),
            "expires_at": data.get("expires_at", None)
        }
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

    @socketio.on('file_upload_complete')
    def handle_file_upload(data):
        user = connected_users.get(request.sid)
        if not user:
            return
        message = {
            "content": data.get("content"),
            "channel": data.get("channel"),
            "priority": "normal",
            "sender_name": user["name"],
            "sender_email": user["email"],
            "department": user["department"],
            "timestamp": data.get("timestamp"),
            "file": {
                "name": data.get("fileName"),
                "type": data.get("fileType"),
                "size": data.get("fileSize"),
                "url": data.get("fileUrl")
            }
        }
        emit('new_message', message, room=data.get("channel"))
    # ─── MUSTER ROLL CALL ───────────────────────────────────────────
    active_muster = {}  # holds current roll call state

    @socketio.on('start_muster')
    def handle_start_muster(data):
        user = connected_users.get(request.sid)
        if not user:
            return
        role = user.get('role', 'employee')
        if role not in ['admin', 'super_admin']:
            emit('error', {'message': 'Only admins can start a muster roll call'})
            return

        from datetime import datetime
        all_names = [u['name'] for u in connected_users.values()]

        active_muster.clear()
        active_muster.update({
            'initiated_by': user['name'],
            'started_at': datetime.utcnow().isoformat(),
            'total': len(all_names),
            'all_users': all_names,
            'safe': [],
            'injured': [],
        })

        not_responded = [n for n in all_names
                         if n not in active_muster['safe']
                         and n not in active_muster['injured']]
        payload = {**active_muster, 'not_responded': not_responded}
        emit('muster_started', payload, broadcast=True)
        print(f"🧑‍🤝‍🧑 Muster roll call started by {user['name']} — {len(all_names)} users online")

    @socketio.on('muster_checkin')
    def handle_muster_checkin(data):
        user = connected_users.get(request.sid)
        if not user or not active_muster:
            return

        name = user['name']
        status = data.get('status', 'safe')

        # Remove from both lists first (prevent duplicates)
        if name in active_muster['safe']:
            active_muster['safe'].remove(name)
        if name in active_muster['injured']:
            active_muster['injured'].remove(name)

        if status == 'safe':
            active_muster['safe'].append(name)
        else:
            active_muster['injured'].append(name)

        not_responded = [n for n in active_muster['all_users']
                         if n not in active_muster['safe']
                         and n not in active_muster['injured']]

        payload = {**active_muster, 'not_responded': not_responded}
        emit('muster_updated', payload, broadcast=True)
        print(f"✅ Muster checkin: {name} — {status}")

    @socketio.on('end_muster')
    def handle_end_muster(data):
        user = connected_users.get(request.sid)
        if not user:
            return
        role = user.get('role', 'employee')
        if role not in ['admin', 'super_admin']:
            return
        active_muster.clear()
        emit('muster_ended', {}, broadcast=True)
        print(f"🛑 Muster roll call ended by {user['name']}")

    # ─── READ RECEIPTS ───────────────────────────────────────────────
    message_receipts = {}  # { msg_id: [ {name, email, time} ] }

    @socketio.on('mark_seen')
    def handle_mark_seen(data):
        user = connected_users.get(request.sid)
        if not user:
            return

        msg_id = data.get('msg_id')
        if not msg_id:
            return

        from datetime import datetime
        if msg_id not in message_receipts:
            message_receipts[msg_id] = []

        # Avoid duplicate receipts
        already = any(r['email'] == user['email'] for r in message_receipts[msg_id])
        if not already:
            receipt = {
                'name': user['name'],
                'email': user['email'],
                'time': datetime.utcnow().strftime('%H:%M')
            }
            message_receipts[msg_id].append(receipt)

            # Broadcast to everyone so senders see live receipt updates
            emit('message_seen', {
                'msg_id': msg_id,
                'reader_name': user['name'],
                'reader_email': user['email'],
                'time': receipt['time']
            }, broadcast=True)