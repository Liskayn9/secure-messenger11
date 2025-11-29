class SecureMessenger {
    constructor() {
        // 🔥 АВТОМАТИЧЕСКОЕ ОПРЕДЕЛЕНИЕ URL ДЛЯ RAILWAY
        this.API_BASE = window.location.origin + '/api';
        
        this.user = null;
        this.token = localStorage.getItem('token');
        this.currentChat = null;
        this.socket = null;
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Secure Messenger...');
        console.log('🌐 API Base:', this.API_BASE);
        
        this.setupEventListeners();
        
        if (this.token) {
            await this.loadUserData();
        } else {
            this.showAuth();
        }
        
        this.connectSocket();
    }

    setupEventListeners() {
        // Кнопки авторизации
        document.getElementById('loginBtn').addEventListener('click', () => this.login());
        document.getElementById('registerBtn').addEventListener('click', () => this.register());
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        document.getElementById('showRegister').addEventListener('click', () => this.showRegisterForm());
        document.getElementById('showLogin').addEventListener('click', () => this.showLoginForm());

        // Поиск и друзья
        document.getElementById('searchInput').addEventListener('input', (e) => this.searchUsers(e.target.value));
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

        // Отправка сообщения
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        document.getElementById('sendMessageBtn').addEventListener('click', () => this.sendMessage());
    }

    async login() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('rememberMe').checked;

        if (!username || !password) {
            this.showError('Введите имя пользователя и пароль');
            return;
        }

        try {
            const response = await fetch(this.API_BASE + '/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password, rememberMe })
            });

            const data = await response.json();

            if (data.success) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('token', this.token);
                this.showMain();
                this.loadFriends();
            } else {
                this.showError(data.error);
            }
        } catch (error) {
            this.showError('Ошибка соединения');
        }
    }

    async register() {
        const username = document.getElementById('registerUsername').value;
        const password = document.getElementById('registerPassword').value;
        const email = document.getElementById('registerEmail').value;

        if (!username || !password) {
            this.showError('Имя пользователя и пароль обязательны');
            return;
        }

        if (username.length < 3) {
            this.showError('Имя пользователя должно содержать минимум 3 символа');
            return;
        }

        if (password.length < 6) {
            this.showError('Пароль должен содержать минимум 6 символов');
            return;
        }

        try {
            const response = await fetch(this.API_BASE + '/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password, email })
            });

            const data = await response.json();

            if (data.success) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('token', this.token);
                this.showMain();
                this.loadFriends();
                this.showSuccess('Регистрация успешна!');
            } else {
                this.showError(data.error);
            }
        } catch (error) {
            this.showError('Ошибка соединения');
        }
    }

    async loadUserData() {
        try {
            // Просто проверяем что токен валидный через запрос друзей
            await this.loadFriends();
            this.showMain();
        } catch (error) {
            localStorage.removeItem('token');
            this.token = null;
            this.showAuth();
        }
    }

    async loadFriends() {
        try {
            const response = await fetch(this.API_BASE + '/friends', {
                headers: {
                    'Authorization': 'Bearer ' + this.token
                }
            });

            const data = await response.json();

            if (data.success) {
                this.displayFriends(data.friends);
            }
        } catch (error) {
            console.error('Error loading friends:', error);
        }
    }

    displayFriends(friends) {
        const friendsList = document.getElementById('friendsList');
        friendsList.innerHTML = '';

        friends.forEach(friend => {
            const friendElement = document.createElement('div');
            friendElement.className = `friend-item ${friend.isOnline ? 'online' : 'offline'}`;
            friendElement.innerHTML = `
                <div class="friend-info">
                    <span class="username">${friend.username}</span>
                    <span class="status">${friend.isOnline ? 'online' : this.formatLastSeen(friend.lastSeen)}</span>
                </div>
                ${friend.isPinned ? '<span class="pin-icon">📌</span>' : ''}
            `;
            
            friendElement.addEventListener('click', () => this.openChat(friend));
            friendsList.appendChild(friendElement);
        });
    }

    async searchUsers(query) {
        if (query.length < 2) {
            document.getElementById('searchResults').innerHTML = '';
            return;
        }

        try {
            const response = await fetch(this.API_BASE + '/users/search?query=' + encodeURIComponent(query), {
                headers: {
                    'Authorization': 'Bearer ' + this.token
                }
            });

            const data = await response.json();

            if (data.success) {
                this.displaySearchResults(data.users);
            }
        } catch (error) {
            console.error('Error searching users:', error);
        }
    }

    displaySearchResults(users) {
        const resultsContainer = document.getElementById('searchResults');
        resultsContainer.innerHTML = '';

        users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = 'search-result-item';
            userElement.innerHTML = `
                <div class="user-info">
                    <span class="username">${user.username}</span>
                    <span class="status">${user.isOnline ? 'online' : 'offline'}</span>
                </div>
                <button class="action-btn" onclick="messenger.handleFriendAction('${user.id}', '${user.friendStatus}')">
                    ${this.getActionButtonText(user.friendStatus)}
                </button>
            `;
            resultsContainer.appendChild(userElement);
        });
    }

    getActionButtonText(status) {
        switch (status) {
            case 'friend': return '💬 Написать';
            case 'request_sent': return '📨 Запрос отправлен';
            case 'request_received': return '✅ Принять запрос';
            case 'none': return '👥 Добавить в друзья';
            default: return '👥 Добавить';
        }
    }

    async handleFriendAction(userId, status) {
        if (status === 'none') {
            await this.sendFriendRequest(userId);
        } else if (status === 'request_received') {
            await this.acceptFriendRequest(userId);
        } else if (status === 'friend') {
            this.openChat({ id: userId });
        }
    }

    async sendFriendRequest(friendId) {
        try {
            const response = await fetch(this.API_BASE + '/friends/request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + this.token
                },
                body: JSON.stringify({ friendId })
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Запрос в друзья отправлен');
                this.searchUsers(document.getElementById('searchInput').value);
            } else {
                this.showError(data.error);
            }
        } catch (error) {
            this.showError('Ошибка отправки запроса');
        }
    }

    async acceptFriendRequest(requestId) {
        try {
            const response = await fetch(this.API_BASE + '/friends/respond', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + this.token
                },
                body: JSON.stringify({ requestId: requestId, accept: true })
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Запрос в друзья принят');
                this.loadFriends();
                this.searchUsers(document.getElementById('searchInput').value);
            } else {
                this.showError(data.error);
            }
        } catch (error) {
            this.showError('Ошибка принятия запроса');
        }
    }

    async openChat(friend) {
        this.currentChat = friend;
        document.getElementById('currentChatName').textContent = friend.username;
        document.getElementById('chatSection').style.display = 'block';
        
        await this.loadMessages(friend.id);
    }

    async loadMessages(friendId) {
        try {
            const response = await fetch(this.API_BASE + '/messages/' + friendId, {
                headers: {
                    'Authorization': 'Bearer ' + this.token
                }
            });

            const data = await response.json();

            if (data.success) {
                this.displayMessages(data.messages);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }

    displayMessages(messages) {
        const messagesContainer = document.getElementById('messagesContainer');
        messagesContainer.innerHTML = '';

        messages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.className = `message ${message.from === this.user.username ? 'outgoing' : 'incoming'}`;
            messageElement.innerHTML = `
                <div class="message-content">${message.message}</div>
                <div class="message-time">${this.formatTime(message.timestamp)}</div>
            `;
            messagesContainer.appendChild(messageElement);
        });

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();

        if (!message || !this.currentChat) return;

        if (this.socket) {
            this.socket.emit('send_message', {
                to: this.currentChat.id,
                message: message
            });
        }

        messageInput.value = '';
    }

    connectSocket() {
        if (!this.token) return;

        // 🔥 АВТОМАТИЧЕСКОЕ ПОДКЛЮЧЕНИЕ ДЛЯ RAILWAY
        const socketUrl = window.location.origin;
        this.socket = io(socketUrl, {
            auth: {
                token: this.token
            }
        });

        this.socket.on('connect', () => {
            console.log('✅ Connected to server');
        });

        this.socket.on('new_message', (messageData) => {
            if (this.currentChat && messageData.from === this.currentChat.username) {
                this.displayMessages([messageData]);
            }
        });

        this.socket.on('friend_online', (data) => {
            this.updateFriendStatus(data.userId, true);
        });

        this.socket.on('friend_offline', (data) => {
            this.updateFriendStatus(data.userId, false);
        });

        this.socket.on('error', (data) => {
            this.showError(data.message);
        });
    }

    updateFriendStatus(friendId, isOnline) {
        const friendElements = document.querySelectorAll('.friend-item');
        friendElements.forEach(element => {
            if (element.dataset.userId === friendId) {
                element.classList.toggle('online', isOnline);
                element.classList.toggle('offline', !isOnline);
                
                const statusElement = element.querySelector('.status');
                statusElement.textContent = isOnline ? 'online' : 'offline';
            }
        });
    }

    logout() {
        localStorage.removeItem('token');
        this.token = null;
        this.user = null;
        this.currentChat = null;
        
        if (this.socket) {
            this.socket.disconnect();
        }
        
        this.showAuth();
    }

    showAuth() {
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('mainSection').style.display = 'none';
        document.getElementById('chatSection').style.display = 'none';
    }

    showMain() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('mainSection').style.display = 'block';
        document.getElementById('chatSection').style.display = 'none';
    }

    showRegisterForm() {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    }

    showLoginForm() {
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
    }

    showError(message) {
        alert('❌ ' + message);
    }

    showSuccess(message) {
        alert('✅ ' + message);
    }

    formatLastSeen(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString();
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }

    async toggleTheme() {
        if (!this.user) return;

        const newTheme = this.user.theme === 'light' ? 'dark' : 'light';
        
        try {
            const response = await fetch(this.API_BASE + '/user/theme', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + this.token
                },
                body: JSON.stringify({ theme: newTheme })
            });

            const data = await response.json();

            if (data.success) {
                this.user.theme = newTheme;
                document.body.className = newTheme + '-theme';
            }
        } catch (error) {
            console.error('Error changing theme:', error);
        }
    }
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
    window.messenger = new SecureMessenger();
});