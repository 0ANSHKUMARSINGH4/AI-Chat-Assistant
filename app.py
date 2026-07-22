import os
import sys
import uuid
from datetime import datetime

# Workaround for Google Protobuf compatibility issue with Python 3.14+
# Metaclasses with custom tp_new are not supported in upb/cpp C-extensions in 3.14.
# Forcing pure Python implementation by blocking the C-extensions in sys.modules.
sys.modules['google._upb._message'] = None
sys.modules['google.protobuf.pyext._message'] = None
os.environ["PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION"] = "python"

import logging
from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
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
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-key-ai-chat-rays")

# Database Configuration (SQLite local, PostgreSQL in production)
db_url = os.getenv("DATABASE_URL", "sqlite:///rays.db")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)
login_manager = LoginManager(app)

# Set up Gemini API Client
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    logging.warning("GEMINI_API_KEY not found in environment. Please add it to your .env file or environment variables.")
else:
    genai.configure(api_key=api_key)
    logging.info("Gemini API configured successfully.")

# ---------------------------------------------------------------------------
# Database Models
# ---------------------------------------------------------------------------

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    conversations = db.relationship('Conversation', backref='user', lazy=True, cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at.isoformat()
        }

class Conversation(db.Model):
    __tablename__ = 'conversations'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False, default="New Conversation")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    messages = db.relationship('Message', backref='conversation', lazy=True, cascade="all, delete-orphan", order_by="Message.created_at")

    def to_dict(self, include_messages=False):
        data = {
            "id": self.id,
            "title": self.title,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }
        if include_messages:
            data["messages"] = [msg.to_dict() for msg in self.messages]
        return data

class Message(db.Model):
    __tablename__ = 'messages'
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.String(36), db.ForeignKey('conversations.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'user' or 'model'
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "role": self.role,
            "content": self.content,
            "created_at": self.created_at.isoformat()
        }

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Initialize database tables
with app.app_context():
    db.create_all()

# ---------------------------------------------------------------------------
# Routes: Page Rendering & Authentication
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    """Render the main chat interface."""
    is_api_configured = bool(os.getenv("GEMINI_API_KEY"))
    return render_template("index.html", is_api_configured=is_api_configured)

@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    """Check current authentication status."""
    if current_user.is_authenticated:
        return jsonify({
            "authenticated": True,
            "user": current_user.to_dict()
        })
    return jsonify({"authenticated": False, "user": None})

@app.route("/api/auth/signup", methods=["POST"])
def auth_signup():
    """Register a new user."""
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not username or not email or not password:
        return jsonify({"error": "Username, email, and password are required."}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters long."}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "An account with this email already exists."}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "This username is already taken."}), 400

    user = User(username=username, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    login_user(user, remember=True)
    return jsonify({
        "message": "Account created successfully!",
        "user": user.to_dict()
    }), 201

@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    """Authenticate an existing user."""
    data = request.get_json() or {}
    identifier = data.get("identifier", "").strip().lower() # email or username
    password = data.get("password", "")

    if not identifier or not password:
        return jsonify({"error": "Email/Username and password are required."}), 400

    user = User.query.filter(
        (User.email == identifier) | (User.username == identifier)
    ).first()

    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email/username or password."}), 401

    login_user(user, remember=True)
    return jsonify({
        "message": "Logged in successfully!",
        "user": user.to_dict()
    })

@app.route("/api/auth/logout", methods=["POST"])
@login_required
def auth_logout():
    """Log out the current user."""
    logout_user()
    return jsonify({"message": "Logged out successfully!"})

# ---------------------------------------------------------------------------
# Routes: User-Scoped Conversations Management
# ---------------------------------------------------------------------------

@app.route("/api/conversations", methods=["GET"])
def get_conversations():
    """Get all conversations for the logged-in user."""
    if not current_user.is_authenticated:
        return jsonify([])

    conversations = Conversation.query.filter_by(user_id=current_user.id)\
        .order_by(Conversation.updated_at.desc()).all()
    return jsonify([c.to_dict() for c in conversations])

@app.route("/api/conversations/<string:conv_id>", methods=["GET"])
def get_conversation_detail(conv_id):
    """Get details and message history for a specific conversation."""
    if not current_user.is_authenticated:
        return jsonify({"error": "Authentication required"}), 401

    conv = Conversation.query.filter_by(id=conv_id, user_id=current_user.id).first()
    if not conv:
        return jsonify({"error": "Conversation not found"}), 404

    return jsonify(conv.to_dict(include_messages=True))

@app.route("/api/conversations/<string:conv_id>", methods=["DELETE"])
def delete_conversation(conv_id):
    """Delete a conversation."""
    if not current_user.is_authenticated:
        return jsonify({"error": "Authentication required"}), 401

    conv = Conversation.query.filter_by(id=conv_id, user_id=current_user.id).first()
    if not conv:
        return jsonify({"error": "Conversation not found"}), 404

    db.session.delete(conv)
    db.session.commit()
    return jsonify({"message": "Conversation deleted"})

@app.route("/api/conversations/clear", methods=["DELETE"])
def clear_conversations():
    """Clear all conversations for the logged-in user."""
    if not current_user.is_authenticated:
        return jsonify({"error": "Authentication required"}), 401

    Conversation.query.filter_by(user_id=current_user.id).delete()
    db.session.commit()
    return jsonify({"message": "All conversations cleared"})

# ---------------------------------------------------------------------------
# Route: Chat Processing & Persistence
# ---------------------------------------------------------------------------

@app.route("/api/chat", methods=["POST"])
def chat():
    """
    Handle chat requests and persist messages to DB when user is logged in.
    """
    current_api_key = os.getenv("GEMINI_API_KEY")
    if not current_api_key:
        return jsonify({
            "error": "Gemini API Key is not configured. Please set GEMINI_API_KEY in your .env file or environment variables."
        }), 500

    genai.configure(api_key=current_api_key)

    try:
        data = request.get_json() or {}
        user_message = data.get("message", "").strip()
        chat_history = data.get("history", [])
        conv_id = data.get("conversation_id")

        if not user_message:
            return jsonify({"error": "Message is required"}), 400

        # Formulate history for the Gemini API
        formatted_history = []
        for msg in chat_history:
            role = msg.get("role")
            content = msg.get("content", "")
            gemini_role = "user" if role == "user" else "model"
            formatted_history.append({
                "role": gemini_role,
                "parts": [content]
            })

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

        chat_session = model.start_chat(history=formatted_history)
        response = chat_session.send_message(user_message)
        ai_response_text = response.text

        # If user is logged in, save to Database!
        response_data = {"response": ai_response_text}

        if current_user.is_authenticated:
            conv = None
            if conv_id:
                conv = Conversation.query.filter_by(id=conv_id, user_id=current_user.id).first()

            if not conv:
                title = user_message[:35] + "..." if len(user_message) > 35 else user_message
                conv = Conversation(user_id=current_user.id, title=title)
                db.session.add(conv)
                db.session.flush()

            # Create User and Model Message entries
            msg_user = Message(conversation_id=conv.id, role="user", content=user_message)
            msg_model = Message(conversation_id=conv.id, role="model", content=ai_response_text)
            conv.updated_at = datetime.utcnow()

            db.session.add(msg_user)
            db.session.add(msg_model)
            db.session.commit()

            response_data["conversation_id"] = conv.id
            response_data["title"] = conv.title

        return jsonify(response_data)

    except Exception as e:
        logging.error(f"Error in Gemini chat completion: {str(e)}", exc_info=True)
        return jsonify({
            "error": f"An error occurred while communicating with the Gemini API: {str(e)}"
        }), 500

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
