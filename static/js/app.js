document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const sidebar = document.getElementById('sidebar');
    const mobileCloseBtn = document.getElementById('mobileCloseBtn');
    const menuToggleBtn = document.getElementById('menuToggleBtn');
    const newChatBtn = document.getElementById('newChatBtn');
    const chatList = document.getElementById('chatList');
    const emptyHistory = document.getElementById('emptyHistory');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    
    const chatTitle = document.getElementById('chatTitle');
    const chatMessagesContainer = document.getElementById('chatMessagesContainer');
    const welcomeScreen = document.getElementById('welcomeScreen');
    const messagesList = document.getElementById('messagesList');
    const typingIndicator = document.getElementById('typingIndicator');
    
    const inputForm = document.getElementById('inputForm');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const shareBtn = document.getElementById('shareBtn');
    const toast = document.getElementById('toast');

    // App State
    let conversations = [];
    let activeConversationId = null;

    // Configure Marked.js for markdown rendering
    const renderer = new marked.Renderer();
    renderer.code = function(code, language) {
        const uniqueId = 'code_' + Math.random().toString(36).substring(2, 11);
        const lang = language ? language : 'text';
        
        // Clean up code block representation
        const rawCode = typeof code === 'object' ? code.text : code;
        
        return `
        <div class="code-block-container">
            <div class="code-block-header">
                <span class="code-block-lang">${lang}</span>
                <button class="copy-code-btn" data-code-id="${uniqueId}">
                    <i data-lucide="copy"></i>
                    <span>Copy</span>
                </button>
            </div>
            <pre><code id="${uniqueId}">${escapeHtml(rawCode)}</code></pre>
        </div>
        `;
    };
    marked.setOptions({ renderer });

    // Initialize the App
    init();

    function init() {
        // Load data from localStorage
        const storedConversations = localStorage.getItem('rays_chats') || localStorage.getItem('gemini_chats');
        if (storedConversations) {
            try {
                conversations = JSON.parse(storedConversations);
            } catch (e) {
                console.error("Failed to parse stored conversations", e);
                conversations = [];
            }
        }
        
        const lastActiveId = localStorage.getItem('rays_active_chat') || localStorage.getItem('gemini_active_chat');
        
        renderSidebar();
        
        // Load active conversation or start a new one
        if (lastActiveId && conversations.some(c => c.id === lastActiveId)) {
            loadConversation(lastActiveId);
        } else if (conversations.length > 0) {
            loadConversation(conversations[0].id);
        } else {
            showWelcomeScreen();
        }

        // Setup Event Listeners
        setupEventListeners();
        
        // Initial Lucide icons initialization
        lucide.createIcons();
    }

    function setupEventListeners() {
        // Toggle Sidebar on mobile
        menuToggleBtn.addEventListener('click', () => {
            sidebar.classList.add('open');
        });
        
        mobileCloseBtn.addEventListener('click', () => {
            sidebar.classList.remove('open');
        });

        // Close sidebar on main click if screen is mobile size
        chatMessagesContainer.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
            }
        });

        // Create New Chat
        newChatBtn.addEventListener('click', () => {
            createNewChat();
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
            }
        });

        // Clear All History
        clearHistoryBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to clear all conversations? This action cannot be undone.")) {
                clearAllConversations();
            }
        });

        // Auto-resize textarea as user types
        userInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight - 6) + 'px';
        });

        // Handle Form Submission
        inputForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleMessageSubmit();
        });

        // Enter key submits the form, Shift+Enter adds newline
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleMessageSubmit();
            }
        });

        // Handle suggestion clicks
        document.querySelectorAll('.suggestion-card').forEach(card => {
            card.addEventListener('click', () => {
                const prompt = card.getAttribute('data-prompt');
                if (prompt) {
                    userInput.value = prompt;
                    userInput.dispatchEvent(new Event('input')); // trigger height resize
                    handleMessageSubmit();
                }
            });
        });

        // Copy button delegation in code blocks
        chatMessagesContainer.addEventListener('click', (e) => {
            const copyBtn = e.target.closest('.copy-code-btn');
            if (copyBtn) {
                const codeId = copyBtn.getAttribute('data-code-id');
                const codeElem = document.getElementById(codeId);
                if (codeElem) {
                    const text = codeElem.textContent;
                    navigator.clipboard.writeText(text).then(() => {
                        const span = copyBtn.querySelector('span');
                        const icon = copyBtn.querySelector('i');
                        
                        span.textContent = 'Copied!';
                        copyBtn.classList.add('copied');
                        
                        showToast('Code copied to clipboard!');
                        
                        setTimeout(() => {
                            span.textContent = 'Copy';
                            copyBtn.classList.remove('copied');
                        }, 2000);
                    }).catch(err => {
                        console.error('Failed to copy text: ', err);
                    });
                }
            }
        });

        // Share chat button
        shareBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(window.location.href).then(() => {
                showToast('Chat page link copied!');
            });
        });
    }

    // --- State and UI Update Functions ---

    function saveState() {
        localStorage.setItem('rays_chats', JSON.stringify(conversations));
        if (activeConversationId) {
            localStorage.setItem('rays_active_chat', activeConversationId);
        } else {
            localStorage.removeItem('rays_active_chat');
        }
    }

    function renderSidebar() {
        chatList.innerHTML = '';
        
        if (conversations.length === 0) {
            emptyHistory.style.display = 'flex';
            return;
        }
        
        emptyHistory.style.display = 'none';
        
        conversations.forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.className = `chat-history-item ${chat.id === activeConversationId ? 'active' : ''}`;
            chatItem.setAttribute('data-id', chat.id);
            
            chatItem.innerHTML = `
                <div class="chat-item-left">
                    <i data-lucide="message-square-text" class="chat-item-icon"></i>
                    <span class="chat-item-title">${escapeHtml(chat.title)}</span>
                </div>
                <button class="delete-chat-btn" title="Delete conversation">
                    <i data-lucide="trash" style="width: 14px; height: 14px;"></i>
                </button>
            `;
            
            // Click to load chat
            chatItem.querySelector('.chat-item-left').addEventListener('click', () => {
                loadConversation(chat.id);
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('open');
                }
            });
            
            // Delete button functionality
            chatItem.querySelector('.delete-chat-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteConversation(chat.id);
            });
            
            chatList.appendChild(chatItem);
        });
        
        lucide.createIcons();
    }

    function createNewChat() {
        activeConversationId = null;
        showWelcomeScreen();
        chatTitle.textContent = "New Conversation";
        userInput.value = '';
        userInput.style.height = 'auto';
        userInput.focus();
        
        document.querySelectorAll('.chat-history-item').forEach(item => {
            item.classList.remove('active');
        });
    }

    function showWelcomeScreen() {
        welcomeScreen.style.display = 'block';
        messagesList.innerHTML = '';
        typingIndicator.style.display = 'none';
        activeConversationId = null;
        chatTitle.textContent = "New Conversation";
    }

    function loadConversation(id) {
        const chat = conversations.find(c => c.id === id);
        if (!chat) return;
        
        activeConversationId = id;
        saveState();
        renderSidebar();
        
        welcomeScreen.style.display = 'none';
        messagesList.innerHTML = '';
        chatTitle.textContent = chat.title;
        
        chat.messages.forEach(msg => {
            appendMessageHTML(msg.role, msg.content);
        });
        
        scrollToBottom();
        userInput.focus();
    }

    function deleteConversation(id) {
        conversations = conversations.filter(c => c.id !== id);
        
        if (activeConversationId === id) {
            activeConversationId = null;
            if (conversations.length > 0) {
                loadConversation(conversations[0].id);
            } else {
                createNewChat();
            }
        } else {
            saveState();
            renderSidebar();
        }
    }

    function clearAllConversations() {
        conversations = [];
        activeConversationId = null;
        saveState();
        renderSidebar();
        createNewChat();
        showToast("Cleared all conversations");
    }

    function handleMessageSubmit() {
        const text = userInput.value.trim();
        if (!text) return;
        
        // Clear input field and trigger height adjust
        userInput.value = '';
        userInput.style.height = 'auto';
        
        // Hide welcome screen if it was active
        if (welcomeScreen.style.display !== 'none') {
            welcomeScreen.style.display = 'none';
        }
        
        // Handle new conversation creation logic if active conversation is null
        if (!activeConversationId) {
            const tempId = 'chat_' + Date.now();
            const newChat = {
                id: tempId,
                title: text.length > 30 ? text.substring(0, 30) + '...' : text,
                messages: []
            };
            conversations.unshift(newChat);
            activeConversationId = tempId;
        }
        
        // Append user message in state
        const currentChat = conversations.find(c => c.id === activeConversationId);
        const userMsg = { role: 'user', content: text };
        currentChat.messages.push(userMsg);
        
        // Append in DOM
        appendMessageHTML('user', text);
        scrollToBottom();
        
        // Update sidebar to display new chat item and active status
        saveState();
        renderSidebar();
        
        // Show typing indicator
        typingIndicator.style.display = 'flex';
        scrollToBottom();
        
        // Disable input during request
        userInput.disabled = true;
        sendBtn.disabled = true;
        
        // Perform API request
        fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: text,
                history: currentChat.messages.slice(0, -1) // send everything except the message we just added
            })
        })
        .then(res => {
            if (!res.ok) {
                return res.json().then(errData => {
                    throw new Error(errData.error || `Server responded with status ${res.status}`);
                });
            }
            return res.json();
        })
        .then(data => {
            const aiResponseText = data.response;
            
            // Save AI response in state
            const aiMsg = { role: 'model', content: aiResponseText };
            currentChat.messages.push(aiMsg);
            saveState();
            
            // Append in DOM
            appendMessageHTML('model', aiResponseText);
        })
        .catch(err => {
            console.error("API error", err);
            appendMessageHTML('system-error', `**Error:** ${err.message}`);
        })
        .finally(() => {
            // Hide typing indicator
            typingIndicator.style.display = 'none';
            scrollToBottom();
            
            // Re-enable input
            userInput.disabled = false;
            sendBtn.disabled = false;
            userInput.focus();
        });
    }

    function appendMessageHTML(role, content) {
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${role === 'user' ? 'user' : 'assistant'}`;
        
        if (role === 'system-error') {
            wrapper.className = 'message-wrapper assistant';
        }
        
        let avatarHTML = '';
        if (role === 'user') {
            avatarHTML = `<div class="avatar user-avatar"><i data-lucide="user"></i></div>`;
        } else {
            avatarHTML = `<div class="avatar assistant-avatar"><i data-lucide="bot"></i></div>`;
        }
        
        let processedContent = '';
        if (role === 'user') {
            // User messages are rendered plain text (escaping code symbols) but preserving linebreaks
            processedContent = `<p>${escapeHtml(content).replace(/\n/g, '<br>')}</p>`;
        } else if (role === 'system-error') {
            processedContent = `<div style="color: var(--color-error);"><i data-lucide="alert-octagon" style="width:16px;height:16px;vertical-align:middle;margin-right:8px;"></i>${marked.parse(content)}</div>`;
        } else {
            // Model messages parsed with marked.js for full markdown
            processedContent = marked.parse(content);
        }
        
        wrapper.innerHTML = `
            ${role === 'user' ? '' : avatarHTML}
            <div class="message-bubble">
                ${processedContent}
            </div>
            ${role === 'user' ? avatarHTML : ''}
        `;
        
        messagesList.appendChild(wrapper);
        
        // Regenerate Lucide icons inside new elements
        lucide.createIcons();
    }

    // Helper functions

    function scrollToBottom() {
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }

    function showToast(text) {
        const toastText = toast.querySelector('.toast-text');
        toastText.textContent = text;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
