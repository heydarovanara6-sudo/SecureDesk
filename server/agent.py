import os
import json
import urllib.request
from flask import Blueprint, request, jsonify
from middleware.auth_middleware import token_required
from datetime import datetime

agent_bp = Blueprint("agent", __name__)

DAILY_LIMIT = 50

SYSTEM_PROMPT = """You are SecureDesk Assistant, an AI helper for BP Azerbaijan's secure operations platform.
You assist staff with: incident reports, shift handovers, channel summaries, task management, and operational questions.
Be concise, professional, and safety-aware. Use bullet points for lists. Keep answers short and actionable.
If asked to draft a report or message, produce it directly. If you don't know something, say so clearly.
Do not make up facts about specific people, incidents, or data you haven't been shown."""


@agent_bp.route("/agent/chat", methods=["POST"])
@token_required
def agent_chat():
    # Read per-request so Coolify env vars are always picked up
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return jsonify({"error": "ANTHROPIC_API_KEY not set on server"}), 500

    user_email = request.user.get("email")
    data = request.get_json()
    messages = data.get("messages", [])

    if not messages:
        return jsonify({"error": "No messages provided"}), 400

    # Daily rate limit tracked in MongoDB
    count = 0
    today = datetime.utcnow().strftime("%Y-%m-%d")
    try:
        from app import db
        usage = db["agent_usage"].find_one({"email": user_email, "date": today})
        count = usage["count"] if usage else 0
        if count >= DAILY_LIMIT:
            return jsonify({
                "error": f"Daily limit of {DAILY_LIMIT} messages reached. Resets at midnight UTC."
            }), 429
    except Exception:
        count = 0

    payload = json.dumps({
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 600,
        "system": SYSTEM_PROMPT,
        "messages": messages
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            result = json.loads(res.read().decode("utf-8"))
            text = "".join(c.get("text", "") for c in result.get("content", []))

            # Update daily usage counter
            try:
                from app import db
                db["agent_usage"].update_one(
                    {"email": user_email, "date": today},
                    {"$inc": {"count": 1}},
                    upsert=True
                )
            except Exception:
                pass

            remaining = max(0, DAILY_LIMIT - count - 1)
            return jsonify({"reply": text, "remaining": remaining}), 200

    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        return jsonify({"error": f"Anthropic API error {e.code}: {body}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@agent_bp.route("/agent/usage", methods=["GET"])
@token_required
def agent_usage():
    user_email = request.user.get("email")
    try:
        from app import db
        today = datetime.utcnow().strftime("%Y-%m-%d")
        usage = db["agent_usage"].find_one({"email": user_email, "date": today})
        count = usage["count"] if usage else 0
        return jsonify({"used": count, "limit": DAILY_LIMIT, "remaining": DAILY_LIMIT - count}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500