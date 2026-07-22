import os
import sys

# Workaround for Google Protobuf compatibility issue with Python 3.14+
# Metaclasses with custom tp_new are not supported in upb/cpp C-extensions in 3.14.
# Forcing pure Python implementation by blocking the C-extensions in sys.modules.
sys.modules['google._upb._message'] = None
sys.modules['google.protobuf.pyext._message'] = None
os.environ["PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION"] = "python"

import logging
from flask import Flask, render_template, request, jsonify
import google.generativeai as genai
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-key-ai-chat")

# Set up Gemini API Client
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    logging.warning("GEMINI_API_KEY not found in environment. Please add it to your .env file or environment variables.")
else:
    genai.configure(api_key=api_key)
    logging.info("Gemini API configured successfully.")

@app.route("/")
def index():
    """Render the main chat interface."""
    # Pass a flag indicating if the API key is configured
    is_api_configured = bool(os.getenv("GEMINI_API_KEY"))
    return render_template("index.html", is_api_configured=is_api_configured)

@app.route("/api/chat", methods=["POST"])
def chat():
    """
    Handle chat requests.
    Expects JSON:
    {
        "message": "current message text",
        "history": [
            {"role": "user", "content": "previous text"},
            {"role": "model", "content": "previous response"}
        ]
    }
    """
    # 1. Check API key configuration
    current_api_key = os.getenv("GEMINI_API_KEY")
    if not current_api_key:
        return jsonify({
            "error": "Gemini API Key is not configured. Please create a .env file and set GEMINI_API_KEY=your_key or configure it on your system."
        }), 500

    # Configure on-the-fly if configuration changed or wasn't set earlier
    genai.configure(api_key=current_api_key)

    try:
        data = request.get_json() or {}
        user_message = data.get("message", "").strip()
        chat_history = data.get("history", [])

        if not user_message:
            return jsonify({"error": "Message is required"}), 400

        # Formulate history for the Gemini API
        # Gemini expects structure: [{"role": "user"|"model", "parts": ["text"]}]
        formatted_history = []
        for msg in chat_history:
            role = msg.get("role")
            content = msg.get("content", "")
            
            # Map frontend roles to Gemini roles
            gemini_role = "user" if role == "user" else "model"
            
            formatted_history.append({
                "role": gemini_role,
                "parts": [content]
            })

        # Initialize the model with a clear system instruction for RAYS assistant personality
        system_instruction = (
            "You are RAYS (Right At Your Service), a highly capable, polite, fast, and intelligent AI assistant. "
            "Help the user with queries, analysis, programming, writing, calculations, and general problem-solving. "
            "Format code blocks cleanly with language identifiers, use bullet points where helpful, "
            "and respond in clean, beautiful Markdown."
        )

        model = genai.GenerativeModel(
            model_name="gemini-3.6-flash",
            system_instruction=system_instruction
        )

        # Start a chat session with the historical messages
        chat_session = model.start_chat(history=formatted_history)
        
        # Send the user's message
        response = chat_session.send_message(user_message)
        
        # Return response text
        return jsonify({
            "response": response.text
        })

    except Exception as e:
        logging.error(f"Error in Gemini chat completion: {str(e)}", exc_info=True)
        return jsonify({
            "error": f"An error occurred while communicating with the Gemini API: {str(e)}"
        }), 500

if __name__ == "__main__":
    # Get port from environment or default to 5000
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
