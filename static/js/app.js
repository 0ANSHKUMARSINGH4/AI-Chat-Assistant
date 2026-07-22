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

    // Auth Elements
    const authModalOverlay = document.getElementById('authModalOverlay');
    const openAuthModalBtn = document.getElementById('openAuthModalBtn');
    const closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
    const tabLoginBtn = document.getElementById('tabLoginBtn');
    const tabSignupBtn = document.getElementById('tabSignupBtn');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const authAlert = document.getElementById('authAlert');
    
    const guestAuthBox = document.getElementById('guestAuthBox');
    const userInfoBox = document.getElementById('userInfoBox');
    const userAvatarInitial = document.getElementById('userAvatarInitial');
    const userUsernameDisplay = document.getElementById('userUsernameDisplay');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const logoutBtn = document.getElementById('logoutBtn');

    // App State
    let currentUser = null;
    let conversations = [];
    let activeConversationId = null;

    // Configure Marked.js for markdown rendering
    const renderer = new marked.Renderer();
    renderer.code = function(code, language) {
        const uniqueId = 'code_' + Math.random().toString(36).substring(2, 11);
        const lang = language ? language : 'text';
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

    async function init() {
        setupEventListeners();
        await checkAuthStatus();
        lucide.createIcons();
    }

    async function checkAuthStatus() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('auth_error')) {
            const err = urlParams.get('auth_error');
            if (err === 'google_not_configured') {
                showToast("Google Sign-In is optional & disabled. Please use Email & Password!");
            }
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json();

            if (data.authenticated && data.user) {
                currentUser = data.user;
                renderUserProfile();
                await fetchUserConversations();
            } else {
                currentUser = null;
                renderGuestProfile();
                loadGuestConversations();
            }
        } catch (e) {
            console.error("Auth status check failed", e);
            currentUser = null;
            renderGuestProfile();
            loadGuestConversations();
        }
    }

    function renderUserProfile() {
        guestAuthBox.style.display = 'none';
        userInfoBox.style.display = 'flex';
        userUsernameDisplay.textContent = currentUser.username;
        userEmailDisplay.textContent = currentUser.email;

        const avatarBadge = document.querySelector('.user-avatar-badge');
        if (currentUser.profile_pic) {
            avatarBadge.innerHTML = `<img src="${escapeHtml(currentUser.profile_pic)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" alt="Avatar">`;
        } else {
            avatarBadge.innerHTML = `<span class="user-avatar-initial" id="userAvatarInitial">${escapeHtml(currentUser.username.charAt(0).toUpperCase())}</span>`;
        }
    }

    function renderGuestProfile() {
        guestAuthBox.style.display = 'block';
        userInfoBox.style.display = 'none';
    }

    async function fetchUserConversations() {
        try {
            const res = await fetch('/api/conversations');
            if (res.ok) {
                conversations = await res.json();
                renderSidebar();

                if (conversations.length > 0) {
                    loadConversation(conversations[0].id);
                } else {
                    showWelcomeScreen();
                }
            }
        } catch (e) {
            console.error("Failed to fetch user conversations", e);
        }
    }

    function loadGuestConversations() {
        const storedConversations = localStorage.getItem('rays_chats') || localStorage.getItem('gemini_chats');
        if (storedConversations) {
            try {
                conversations = JSON.parse(storedConversations);
            } catch (e) {
                conversations = [];
            }
        } else {
            conversations = [];
        }

        renderSidebar();

        const lastActiveId = localStorage.getItem('rays_active_chat') || localStorage.getItem('gemini_active_chat');
        if (lastActiveId && conversations.some(c => c.id === lastActiveId)) {
            loadConversation(lastActiveId);
        } else if (conversations.length > 0) {
            loadConversation(conversations[0].id);
        } else {
            showWelcomeScreen();
        }
    }

    function setupEventListeners() {
        // Toggle Sidebar on mobile
        menuToggleBtn.addEventListener('click', () => sidebar.classList.add('open'));
        mobileCloseBtn.addEventListener('click', () => sidebar.classList.remove('open'));

        chatMessagesContainer.addEventListener('click', () => {
            if (window.innerWidth <= 768) sidebar.classList.remove('open');
        });

        // Create New Chat
        newChatBtn.addEventListener('click', () => {
            createNewChat();
            if (window.innerWidth <= 768) sidebar.classList.remove('open');
        });

        // Clear All History
        clearHistoryBtn.addEventListener('click', async () => {
            if (confirm("Are you sure you want to clear all conversations? This action cannot be undone.")) {
                await clearAllConversations();
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
                    userInput.dispatchEvent(new Event('input'));
                    handleMessageSubmit();
                }
            });
        });

        // Copy code block event delegation
        chatMessagesContainer.addEventListener('click', (e) => {
            const copyBtn = e.target.closest('.copy-code-btn');
            if (copyBtn) {
                const codeId = copyBtn.getAttribute('data-code-id');
                const codeElem = document.getElementById(codeId);
                if (codeElem) {
                    navigator.clipboard.writeText(codeElem.textContent).then(() => {
                        const span = copyBtn.querySelector('span');
                        span.textContent = 'Copied!';
                        copyBtn.classList.add('copied');
                        showToast('Code copied to clipboard!');
                        setTimeout(() => {
                            span.textContent = 'Copy';
                            copyBtn.classList.remove('copied');
                        }, 2000);
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

        // --- Auth Modal Event Listeners ---
        openAuthModalBtn.addEventListener('click', () => {
            authAlert.style.display = 'none';
            authModalOverlay.style.display = 'flex';
        });

        closeAuthModalBtn.addEventListener('click', () => {
            authModalOverlay.style.display = 'none';
        });

        authModalOverlay.addEventListener('click', (e) => {
            if (e.target === authModalOverlay) authModalOverlay.style.display = 'none';
        });

        tabLoginBtn.addEventListener('click', () => {
            tabLoginBtn.classList.add('active');
            tabSignupBtn.classList.remove('active');
            loginForm.style.display = 'block';
            signupForm.style.display = 'none';
            authAlert.style.display = 'none';
        });

        tabSignupBtn.addEventListener('click', () => {
            tabSignupBtn.classList.add('active');
            tabLoginBtn.classList.remove('active');
            signupForm.style.display = 'block';
            loginForm.style.display = 'none';
            authAlert.style.display = 'none';
        });

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const identifier = document.getElementById('loginIdentifier').value.trim();
            const password = document.getElementById('loginPassword').value;

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier, password })
                });

                const data = await res.json();
                if (!res.ok) {
                    showAuthAlert(data.error || 'Login failed.');
                    return;
                }

                currentUser = data.user;
                renderUserProfile();
                authModalOverlay.style.display = 'none';
                loginForm.reset();
                showToast(`Welcome back, ${currentUser.username}!`);
                await fetchUserConversations();
            } catch (err) {
                showAuthAlert('An error occurred during login.');
            }
        });

        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('signupUsername').value.trim();
            const email = document.getElementById('signupEmail').value.trim();
            const password = document.getElementById('signupPassword').value;

            try {
                const res = await fetch('/api/auth/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password })
                });

                const data = await res.json();
                if (!res.ok) {
                    showAuthAlert(data.error || 'Sign up failed.');
                    return;
                }

                currentUser = data.user;
                renderUserProfile();
                authModalOverlay.style.display = 'none';
                signupForm.reset();
                showToast(`Account created! Welcome, ${currentUser.username}.`);
                await fetchUserConversations();
            } catch (err) {
                showAuthAlert('An error occurred during sign up.');
            }
        });

        logoutBtn.addEventListener('click', async () => {
            try {
                await fetch('/api/auth/logout', { method: 'POST' });
                currentUser = null;
                renderGuestProfile();
                loadGuestConversations();
                showToast('Logged out successfully');
            } catch (e) {
                console.error("Logout error", e);
            }
        });
    }

    function showAuthAlert(msg) {
        authAlert.textContent = msg;
        authAlert.style.display = 'block';
    }

    function saveGuestState() {
        if (!currentUser) {
            localStorage.setItem('rays_chats', JSON.stringify(conversations));
            if (activeConversationId) {
                localStorage.setItem('rays_active_chat', activeConversationId);
            } else {
                localStorage.removeItem('rays_active_chat');
            }
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
            
            chatItem.querySelector('.chat-item-left').addEventListener('click', () => {
                loadConversation(chat.id);
                if (window.innerWidth <= 768) sidebar.classList.remove('open');
            });
            
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
        
        document.querySelectorAll('.chat-history-item').forEach(item => item.classList.remove('active'));
    }

    function showWelcomeScreen() {
        welcomeScreen.style.display = 'block';
        messagesList.innerHTML = '';
        typingIndicator.style.display = 'none';
        activeConversationId = null;
        chatTitle.textContent = "New Conversation";
    }

    async function loadConversation(id) {
        activeConversationId = id;

        if (!currentUser) {
            saveGuestState();
            renderSidebar();
            const chat = conversations.find(c => c.id === id);
            if (!chat) return;
            welcomeScreen.style.display = 'none';
            messagesList.innerHTML = '';
            chatTitle.textContent = chat.title;
            (chat.messages || []).forEach(msg => appendMessageHTML(msg.role, msg.content));
            scrollToBottom();
            userInput.focus();
            return;
        }

        // Logged-in user: fetch full detail from server DB
        try {
            const res = await fetch(`/api/conversations/${id}`);
            if (res.ok) {
                const chat = await res.json();
                renderSidebar();
                welcomeScreen.style.display = 'none';
                messagesList.innerHTML = '';
                chatTitle.textContent = chat.title;
                (chat.messages || []).forEach(msg => appendMessageHTML(msg.role, msg.content));
                scrollToBottom();
                userInput.focus();
            }
        } catch (e) {
            console.error("Failed to load conversation details", e);
        }
    }

    async function deleteConversation(id) {
        if (currentUser) {
            try {
                await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
                conversations = conversations.filter(c => c.id !== id);
                if (activeConversationId === id) {
                    activeConversationId = null;
                    if (conversations.length > 0) {
                        loadConversation(conversations[0].id);
                    } else {
                        createNewChat();
                    }
                } else {
                    renderSidebar();
                }
            } catch (e) {
                console.error("Failed to delete conversation", e);
            }
        } else {
            conversations = conversations.filter(c => c.id !== id);
            if (activeConversationId === id) {
                activeConversationId = null;
                if (conversations.length > 0) {
                    loadConversation(conversations[0].id);
                } else {
                    createNewChat();
                }
            } else {
                saveGuestState();
                renderSidebar();
            }
        }
    }

    async function clearAllConversations() {
        if (currentUser) {
            try {
                await fetch('/api/conversations/clear', { method: 'DELETE' });
                conversations = [];
                activeConversationId = null;
                renderSidebar();
                createNewChat();
                showToast("Cleared all conversations");
            } catch (e) {
                console.error("Failed to clear conversations", e);
            }
        } else {
            conversations = [];
            activeConversationId = null;
            saveGuestState();
            renderSidebar();
            createNewChat();
            showToast("Cleared all conversations");
        }
    }

    async function handleMessageSubmit() {
        const text = userInput.value.trim();
        if (!text) return;
        
        userInput.value = '';
        userInput.style.height = 'auto';
        
        if (welcomeScreen.style.display !== 'none') {
            welcomeScreen.style.display = 'none';
        }

        // Temporary guest conversation creation
        if (!currentUser && !activeConversationId) {
            const tempId = 'chat_' + Date.now();
            const newChat = {
                id: tempId,
                title: text.length > 30 ? text.substring(0, 30) + '...' : text,
                messages: []
            };
            conversations.unshift(newChat);
            activeConversationId = tempId;
        }

        let currentMessages = [];
        if (!currentUser) {
            const currentChat = conversations.find(c => c.id === activeConversationId);
            if (currentChat) {
                currentChat.messages.push({ role: 'user', content: text });
                currentMessages = currentChat.messages.slice(0, -1);
            }
        }

        appendMessageHTML('user', text);
        scrollToBottom();

        saveGuestState();
        renderSidebar();

        typingIndicator.style.display = 'flex';
        scrollToBottom();

        userInput.disabled = true;
        sendBtn.disabled = true;

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    history: currentMessages,
                    conversation_id: activeConversationId
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || `Server error ${res.status}`);
            }

            const data = await res.json();
            const aiResponseText = data.response;

            if (currentUser) {
                if (data.conversation_id) {
                    activeConversationId = data.conversation_id;
                    const existing = conversations.find(c => c.id === data.conversation_id);
                    if (!existing) {
                        conversations.unshift({
                            id: data.conversation_id,
                            title: data.title || text.substring(0, 30),
                            created_at: new Date().toISOString()
                        });
                    }
                }
                renderSidebar();
            } else {
                const currentChat = conversations.find(c => c.id === activeConversationId);
                if (currentChat) {
                    currentChat.messages.push({ role: 'model', content: aiResponseText });
                    saveGuestState();
                }
            }

            appendMessageHTML('model', aiResponseText);

        } catch (err) {
            console.error("API error", err);
            appendMessageHTML('system-error', `**Error:** ${err.message}`);
        } finally {
            typingIndicator.style.display = 'none';
            scrollToBottom();
            userInput.disabled = false;
            sendBtn.disabled = false;
            userInput.focus();
        }
    }

    function appendMessageHTML(role, content) {
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${role === 'user' ? 'user' : 'assistant'}`;
        if (role === 'system-error') wrapper.className = 'message-wrapper assistant';

        let avatarHTML = role === 'user' 
            ? `<div class="avatar user-avatar"><i data-lucide="user"></i></div>`
            : `<div class="avatar assistant-avatar"><i data-lucide="bot"></i></div>`;

        let processedContent = '';
        if (role === 'user') {
            processedContent = `<p>${escapeHtml(content).replace(/\n/g, '<br>')}</p>`;
        } else if (role === 'system-error') {
            processedContent = `<div style="color: var(--color-error);"><i data-lucide="alert-octagon" style="width:16px;height:16px;vertical-align:middle;margin-right:8px;"></i>${marked.parse(content)}</div>`;
        } else {
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
        lucide.createIcons();
    }

    function scrollToBottom() {
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }

    function showToast(text) {
        const toastText = toast.querySelector('.toast-text');
        toastText.textContent = text;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
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
