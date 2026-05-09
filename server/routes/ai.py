import os
import json
import urllib.request
from flask import Blueprint, request, jsonify
from middleware.auth_middleware import token_required

ai_bp = Blueprint("ai", __name__)

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

@ai_bp.route("/ai/summarize", methods=["POST"])
@token_required
def summarize():
    data = request.get_json()
    prompt = data.get("prompt", "")
    if not prompt:
        return jsonify({"error": "No prompt provided"}), 400
    if not ANTHROPIC_API_KEY:
        return jsonify({"error": "ANTHROPIC_API_KEY not set"}), 500
    payload = json.dumps({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 1000,
        "messages": [{"role": "user", "content": prompt}]
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={"Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            result = json.loads(res.read().decode("utf-8"))
            text = "".join(c.get("text", "") for c in result.get("content", []))
            return jsonify({"summary": text}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500