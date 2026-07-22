# RAYS — Right At Your Service ☀️

> 🌐 **Live Demo:** [https://ai-chat-assistant-w406.onrender.com](https://ai-chat-assistant-w406.onrender.com)

**RAYS** (**R**ight **A**t **Y**our **S**ervice) is a modern, fast, and responsive AI Chat Assistant web application built with **Flask** and powered by Google's **Gemini API**. It features an obsidian dark theme, conversation history management, custom Markdown rendering, and a mobile-friendly layout.

---

## ✨ Features

- **RAYS AI Engine:** Intelligent responses powered by Google's **Gemini 3.6 Flash** API for rapid Q&A, code writing, problem-solving, and creative drafting.
- **Persistent Conversation History:** Start multiple threads, switch between them, and delete conversations as needed. Chat threads persist across page reloads using browser `localStorage`.
- **Custom Markdown Parsing:** Dynamic rendering of markdown elements (headers, lists, tables, bold text).
- **Code Block Container with One-Click Copy:** Automatic formatting for code sections with a custom language header and a responsive **Copy** button.
- **Premium Glassmorphism & UI:** Rich aesthetic layout using modern CSS variables, soft shadows, responsive grids, drawer layout on mobile, and smooth fade-in micro-animations.
- **Typing Indicator:** Elegant pulsing three-dot indicator during API message processing.
- **Environment Variables Support:** Safe handling of the Gemini API Key using `.env` files.

---

## 🛠️ Tech Stack

- **Backend:** Python, Flask, `google-generativeai`, `python-dotenv`
- **Frontend:** Semantic HTML5, CSS3 (Vanilla), JavaScript (ES6+)
- **Libraries:**
  - **Marked.js:** For client-side Markdown rendering.
  - **Lucide Icons:** Premium, modern SVG icons.
  - **Google Fonts:** *Outfit* (headings) & *Inter* (body text).

---

## 📂 Project Structure

```text
AI-Chat-Assistant/
├── static/
│   ├── css/
│   │   └── style.css      # Custom premium styles, variables, typography, layouts
│   └── js/
│       └── app.js         # Chat & state management, localStorage sync, API requests
├── templates/
│   └── index.html         # Responsive semantic UI structure
├── .env.example           # Reference file for API key configurations
├── .gitignore             # Standard Python / local configurations ignore
├── app.py                 # Core Flask backend with Gemini integration & routing
├── requirements.txt       # Python dependencies list
└── README.md              # Installation & project documentation
```

---

## 🚀 Setup & Installation

### 1. Clone the Repository
```bash
git clone https://github.com/0ANSHKUMARSINGH4/AI-Chat-Assistant.git
cd AI-Chat-Assistant
```

### 2. Configure Virtual Environment
Create and activate a Python virtual environment:
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
Install all required modules:
```bash
pip install -r requirements.txt
```

### 4. Setup Gemini API Key
Create a `.env` file in the root directory by copying the example:
```bash
cp .env.example .env
```
Open `.env` and paste your Google Gemini API key:
```env
GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere...
```
> **Note:** If you don't have an API key, you can obtain one for free from [Google AI Studio](https://aistudio.google.com/).

### 5. Run the Application
Start the Flask local development server:
```bash
python app.py
```
Open your browser and navigate to `http://127.0.0.1:5000/`.

---

## 🛡️ Error Handling

- **Missing API Key:** If `GEMINI_API_KEY` is not present, the Flask server warning is shown, and the UI displays a clear banner instructing you to create your `.env` file, disabling input fields to prevent empty API calls.
- **Connection & Quota Errors:** The backend catches all API exceptions and bubbles them to the frontend where they are styled beautifully in a red system-error bubble.
