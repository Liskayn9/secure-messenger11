class SecureMessenger {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.friends = [];
        this.currentChat = null;
        this.messages = new Map();
        this.theme = 'light';
        
         this.API_BASE = window.location.origin + '/api';
        
        console.log('🌐 API Base URL:', this.API_BASE);
        // Создаем Audio объекты для звуков
        this.sounds = {
            click: new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA=='),
            success: new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA=='),
            error: new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA=='),
            message: new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==')
        };
        
        // Настраиваем звуки
        this.createSounds();
        
        this.initializeApp();
    }

    createSounds() {
        // Простые звуки (короткие бипы)
        this.sounds.click.volume = 0.3;
        this.sounds.success.volume = 0.4;
        this.sounds.error.volume = 0.4;
        this.sounds.message.volume = 0.3;
    }

    playSound(soundName) {
        try {
            const sound = this.sounds[soundName];
            if (sound) {
                sound.currentTime = 0;
                sound.play().catch(e => console.log('Sound play failed:', e));
            }
        } catch (error) {
            console.log('Sound error:', error);
        }
    }

    initializeApp() {
        this.setupEventListeners();
        this.loadTheme();
        this.checkAuth();
    }

    setupEventListeners() {
        console.log('🔄 Настройка обработчиков событий...');
        
        // Обработчики для табов авторизации
        this.delegateEvent('click', '.tab-btn', (e) => {
            this.playSound('click');
            const tab = e.target.dataset.tab;
            console.log('🎯 Клик по табу:', tab);
            this.switchAuthTab(tab);
        });

        // Обработчики для табов сайдбара
        this.delegateEvent('click', '.sidebar-tab', (e) => {
            this.playSound('click');
            const tab = e.target.dataset.tab;
            console.log('🎯 Клик по сайдбар табу:', tab);
            this.switchSidebarTab(tab);
        });

        // Обработчики для основных кнопок
        this.delegateEvent('click', '.btn-primary', (e) => {
            this.playSound('click');
            this.addButtonAnimation(e.target);
            
            // Определяем какая кнопка нажата
            const form = e.target.closest('.auth-form');
            if (form) {
                if (form.id === 'loginForm') {
                    console.log('🎯 Клик по кнопке Войти');
                    this.login();
                } else if (form.id === 'registerForm') {
                    console.log('🎯 Клик по кнопке Регистрация');
                    this.register();
                }
            }
        });

        this.delegateEvent('click', '.btn-send', (e) => {
            this.playSound('click');
            this.addButtonAnimation(e.target);
            console.log('🎯 Клик по кнопке Отправить');
            this.sendMessage();
        });

        this.delegateEvent('click', '.btn-clear', (e) => {
            this.playSound('click');
            this.addButtonAnimation(e.target);
            console.log('🎯 Клик по кнопке Очистить чат');
            this.clearChat();
        });

        this.delegateEvent('click', '#themeToggle', (e) => {
            this.playSound('click');
            this.addButtonAnimation(e.target);
            console.log('🎯 Клик по кнопке смены темы');
            this.toggleTheme();
        });

        this.delegateEvent('click', '.btn-logout', (e) => {
            this.playSound('click');
            this.addButtonAnimation(e.target);
            console.log('🎯 Клик по кнопке Выйти');
            this.logout();
        });

        // Обработчики для действий с друзьями
        this.delegateEvent('click', '.btn-add', (e) => {
            this.playSound('click');
            this.addButtonAnimation(e.target);
            const friendId = e.target.getAttribute('onclick').match(/'([^']+)'/)[1];
            this.sendFriendRequest(friendId);
        });

        this.delegateEvent('click', '.btn-accept', (e) => {
            this.playSound('click');
            this.addButtonAnimation(e.target);
            const friendId = e.target.getAttribute('onclick').match(/'([^']+)'/)[1];
            this.respondToFriendRequest(friendId, true);
        });

        this.delegateEvent('click', '.btn-reject', (e) => {
            this.playSound('click');
            this.addButtonAnimation(e.target);
            const friendId = e.target.getAttribute('onclick').match(/'([^']+)'/)[1];
            this.respondToFriendRequest(friendId, false);
        });

        this.delegateEvent('click', '.btn-pin', (e) => {
            this.playSound('click');
            this.addButtonAnimation(e.target);
            const friendId = e.target.getAttribute('onclick').match(/'([^']+)'/)[1];
            this.togglePin(friendId);
        });

        this.delegateEvent('click', '.btn-remove', (e) => {
            this.playSound('click');
            this.addButtonAnimation(e.target);
            const match = e.target.getAttribute('onclick').match(/'([^']+)', '([^']+)'/);
            if (match) {
                const friendId = match[1];
                const friendUsername = match[2];
                this.removeFriend(friendId, friendUsername);
            }
        });

        // Обработчики для полей ввода
        const registerUsername = document.getElementById('registerUsername');
        if (registerUsername) {
            registerUsername.addEventListener('input', (e) => {
                this.checkUsernameAvailability(e.target.value);
            });
        }

        // Enter для форм
        this.setupEnterKey('loginUsername', () => this.login());
        this.setupEnterKey('loginPassword', () => this.login());
        this.setupEnterKey('registerUsername', () => this.register());
        this.setupEnterKey('registerPassword', () => this.register());
        this.setupEnterKey('registerEmail', () => this.register());

        // Enter для сообщений
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.playSound('click');
                    this.sendMessage();
                }
            });
        }

        // Поиск пользователей
        const userSearch = document.getElementById('userSearch');
        if (userSearch) {
            userSearch.addEventListener('input', (e) => {
                this.searchUsers(e.target.value);
            });
        }

        // Обработчики для элементов списка друзей
        this.delegateEvent('click', '.friend-item', (e) => {
            if (!e.target.classList.contains('btn-pin') && !e.target.classList.contains('btn-remove')) {
                this.playSound('click');
                this.addButtonAnimation(e.currentTarget);
                const onclick = e.currentTarget.getAttribute('onclick');
                const match = onclick.match(/openChat\('([^']+)', '([^']+)'\)/);
                if (match) {
                    const friendId = match[1];
                    const friendUsername = match[2];
                    this.openChat(friendId, friendUsername);
                }
            }
        });

        console.log('✅ Обработчики событий настроены');
    }

    // Делегирование событий
    delegateEvent(eventType, selector, handler) {
        document.addEventListener(eventType, (e) => {
            if (e.target.matches(selector) || e.target.closest(selector)) {
                handler(e);
            }
        });
    }

    // Анимация кнопок
    addButtonAnimation(element) {
        element.style.transform = 'scale(0.95)';
        element.style.transition = 'transform 0.1s ease';
        
        setTimeout(() => {
            element.style.transform = 'scale(1)';
        }, 100);

        setTimeout(() => {
            element.style.transform = '';
        }, 200);
    }

    setupEnterKey(elementId, callback) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.playSound('click');
                    callback();
                }
            });
        }
    }

    switchAuthTab(tab) {
        console.log('🔄 Переключение на таб:', tab);
        
        // Анимация переключения табов
        document.querySelectorAll('.tab-btn').forEach(btn => {
            const wasActive = btn.classList.contains('active');
            btn.classList.toggle('active', btn.dataset.tab === tab);
            
            if (!wasActive && btn.classList.contains('active')) {
                this.addButtonAnimation(btn);
            }
        });

        // Показываем соответствующую форму
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        if (loginForm) {
            loginForm.classList.toggle('active', tab === 'login');
            if (tab === 'login') {
                loginForm.style.animation = 'slideInRight 0.3s ease';
            }
        }
        
        if (registerForm) {
            registerForm.classList.toggle('active', tab === 'register');
            if (tab === 'register') {
                registerForm.style.animation = 'slideInLeft 0.3s ease';
            }
        }
    }

    switchSidebarTab(tab) {
        console.log('🔄 Переключение сайдбар таба:', tab);
        
        document.querySelectorAll('.sidebar-tab').forEach(btn => {
            const wasActive = btn.classList.contains('active');
            btn.classList.toggle('active', btn.dataset.tab === tab);
            
            if (!wasActive && btn.classList.contains('active')) {
                this.addButtonAnimation(btn);
            }
        });

        const friendsTab = document.getElementById('friendsTab');
        const searchTab = document.getElementById('searchTab');
        const requestsTab = document.getElementById('requestsTab');
        
        if (friendsTab) {
            friendsTab.classList.toggle('active', tab === 'friends');
            if (tab === 'friends') friendsTab.style.animation = 'fadeIn 0.3s ease';
        }
        if (searchTab) {
            searchTab.classList.toggle('active', tab === 'search');
            if (tab === 'search') searchTab.style.animation = 'fadeIn 0.3s ease';
        }
        if (requestsTab) {
            requestsTab.classList.toggle('active', tab === 'requests');
            if (tab === 'requests') requestsTab.style.animation = 'fadeIn 0.3s ease';
        }

        if (tab === 'requests') {
            this.loadFriendRequests();
        } else if (tab === 'search') {
            const searchInput = document.getElementById('userSearch');
            if (searchInput) searchInput.value = '';
            const searchResults = document.getElementById('searchResults');
            if (searchResults) searchResults.innerHTML = '';
        }
    }

    async checkUsernameAvailability(username) {
        if (username.length < 3) {
            this.updateUsernameStatus('', '');
            return;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            this.updateUsernameStatus('error', 'Только буквы, цифры и подчёркивания');
            return;
        }

        try {
            const response = await fetch(this.API_BASE + `/api/auth/check-username?username=${encodeURIComponent(username)}`);
            const data = await response.json();

            if (data.available) {
                this.updateUsernameStatus('success', 'Имя пользователя доступно');
            } else {
                this.updateUsernameStatus('error', 'Имя пользователя уже занято');
            }
        } catch (error) {
            console.error('Error checking username:', error);
        }
    }

    updateUsernameStatus(type, message) {
        const statusElement = document.getElementById('usernameStatus');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `username-status ${type}`;
            statusElement.style.animation = 'bounceIn 0.5s ease';
        }
    }

    async register() {
        console.log('📝 Попытка регистрации...');
        
        const usernameInput = document.getElementById('registerUsername');
        const passwordInput = document.getElementById('registerPassword');
        const emailInput = document.getElementById('registerEmail');
        
        if (!usernameInput || !passwordInput) {
            this.showError('Форма регистрации не найдена');
            return;
        }

        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const email = emailInput ? emailInput.value.trim() || null : null;

        console.log('📧 Данные для регистрации:', { username, password: '***', email });

        if (!username || !password) {
            this.showError('Заполните имя пользователя и пароль');
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

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            this.showError('Имя пользователя может содержать только буквы, цифры и подчёркивания');
            return;
        }

        try {
            const response = await fetch(this.API_BASE + '/api/auth/register', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ username, password, email })
            });

            console.log('📡 Ответ сервера:', response.status);

            const data = await response.json();
            console.log('📦 Данные ответа:', data);

            if (data.success) {
                this.playSound('success');
                localStorage.setItem('messenger_token', data.token);
                localStorage.setItem('messenger_user', JSON.stringify(data.user));
                
                this.currentUser = data.user;
                this.showMainScreen();
                this.connectWebSocket(data.token);
                this.loadFriends();
                
                this.showSuccess('Регистрация успешна! Добро пожаловать!');
            } else {
                this.playSound('error');
                this.showError(data.error || 'Ошибка регистрации');
            }
        } catch (error) {
            console.error('❌ Ошибка регистрации:', error);
            this.playSound('error');
            this.showError('Ошибка соединения с сервером');
        }
    }

    async login() {
        console.log('🔐 Попытка входа...');
        
        const usernameInput = document.getElementById('loginUsername');
        const passwordInput = document.getElementById('loginPassword');
        const rememberMeInput = document.getElementById('rememberMe');
        
        if (!usernameInput || !passwordInput) {
            this.showError('Форма входа не найдена');
            return;
        }

        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const rememberMe = rememberMeInput ? rememberMeInput.checked : false;

        console.log('📧 Данные для входа:', { username, password: '***', rememberMe });

        if (!username || !password) {
            this.showError('Введите имя пользователя и пароль');
            return;
        }

        try {
            const response = await fetch(this.API_BASE + '/api/auth/login', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ username, password, rememberMe })
            });

            console.log('📡 Ответ сервера:', response.status);

            const data = await response.json();
            console.log('📦 Данные ответа:', data);

            if (data.success) {
                this.playSound('success');
                localStorage.setItem('messenger_token', data.token);
                localStorage.setItem('messenger_user', JSON.stringify(data.user));
                
                this.currentUser = data.user;
                this.showMainScreen();
                this.connectWebSocket(data.token);
                this.loadFriends();
                
                this.showSuccess('Вход выполнен успешно!');
            } else {
                this.playSound('error');
                this.showError(data.error || 'Ошибка входа');
            }
        } catch (error) {
            console.error('❌ Ошибка входа:', error);
            this.playSound('error');
            this.showError('Ошибка соединения с сервером');
        }
    }

    async checkAuth() {
        const token = localStorage.getItem('messenger_token');
        const userData = localStorage.getItem('messenger_user');
        
        if (token && userData) {
            try {
                const response = await fetch(this.API_BASE + '/api/friends', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    this.currentUser = JSON.parse(userData);
                    this.showMainScreen();
                    this.connectWebSocket(token);
                    this.loadFriends();
                    return;
                } else {
                    localStorage.removeItem('messenger_token');
                    localStorage.removeItem('messenger_user');
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                localStorage.removeItem('messenger_token');
                localStorage.removeItem('messenger_user');
            }
        }

        this.showAuthScreen();
    }

    connectWebSocket(token) {
        try {
            this.socket = io({
                auth: { token }
            });

            this.socket.on('connect', () => {
                console.log('✅ Connected to WebSocket');
            });

            this.socket.on('connect_error', (error) => {
                console.error('WebSocket connection error:', error);
                this.showError('Ошибка подключения к серверу');
            });

            this.socket.on('new_message', (data) => {
                this.playSound('message');
                this.handleNewMessage(data);
            });

            this.socket.on('friend_request_received', (data) => {
                this.playSound('message');
                this.showFriendRequestNotification(data);
            });

            this.socket.on('friend_online', (data) => {
                this.updateFriendStatus(data.userId, true);
            });

            this.socket.on('friend_offline', (data) => {
                this.updateFriendStatus(data.userId, false);
            });

            this.socket.on('friend_removed', (data) => {
                this.handleFriendRemoved(data.userId);
            });

            this.socket.on('friend_added', (data) => {
                this.playSound('success');
                this.showSuccess(`Теперь вы друзья с ${data.username}!`);
                this.loadFriends();
            });

            this.socket.on('error', (data) => {
                this.playSound('error');
                this.showError(data.message);
            });
        } catch (error) {
            console.error('WebSocket initialization error:', error);
        }
    }

    async loadFriends() {
        try {
            const token = localStorage.getItem('messenger_token');
            const response = await fetch(this.API_BASE + '/api/friends', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();
            console.log('👥 Загружены друзья:', data);

            if (data.success) {
                this.friends = data.friends || [];
                this.renderFriendsList();
            }
        } catch (error) {
            console.error('Error loading friends:', error);
        }
    }

    renderFriendsList() {
        const friendsList = document.getElementById('friendsList');
        if (!friendsList) return;
        
        if (this.friends.length === 0) {
            friendsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">👥</div>
                    <div class="empty-text">У вас пока нет друзей</div>
                    <div class="empty-subtext">Найдите пользователей во вкладке "Поиск"</div>
                </div>
            `;
            return;
        }

        friendsList.innerHTML = this.friends.map(friend => `
            <div class="friend-item ${this.currentChat?.id === friend.id ? 'active' : ''} ${friend.isPinned ? 'pinned' : ''}" 
                 onclick="messenger.openChat('${friend.id}', '${friend.username}')">
                <div class="user-avatar">${friend.username.charAt(0).toUpperCase()}</div>
                <div class="user-details">
                    <div class="user-name">
                        ${friend.isPinned ? '📌 ' : ''}${friend.username}
                    </div>
                    <div class="user-status">${friend.isOnline ? '🟢 В сети' : `⚫ Был(а) ${new Date(friend.lastSeen).toLocaleTimeString()}`}</div>
                </div>
                <div class="friend-actions">
                    <button class="btn-pin" onclick="event.stopPropagation(); messenger.togglePin('${friend.id}')" title="${friend.isPinned ? 'Открепить' : 'Закрепить'}">
                        ${friend.isPinned ? '📌' : '📄'}
                    </button>
                    <button class="btn-remove" onclick="event.stopPropagation(); messenger.removeFriend('${friend.id}', '${friend.username}')" title="Удалить друга">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    }

    openChat(friendId, friendUsername) {
        console.log('💬 Открытие чата с:', friendId, friendUsername);
        
        this.currentChat = { id: friendId, username: friendUsername };
        
        // Обновляем активный элемент
        document.querySelectorAll('.friend-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const currentItem = document.querySelector(`.friend-item[onclick*="${friendId}"]`);
        if (currentItem) {
            currentItem.classList.add('active');
        }
        
        // Обновляем заголовок чата
        const chatUserName = document.getElementById('chatUserName');
        const chatUserAvatar = document.getElementById('chatUserAvatar');
        const chatUserStatus = document.getElementById('chatUserStatus');
        const chatHeader = document.getElementById('chatHeader');
        const messageInputContainer = document.getElementById('messageInputContainer');
        const noChatSelected = document.getElementById('noChatSelected');
        
        if (chatUserName) chatUserName.textContent = friendUsername;
        if (chatUserAvatar) chatUserAvatar.textContent = friendUsername.charAt(0).toUpperCase();
        
        const friend = this.friends.find(f => f.id === friendId);
        if (chatUserStatus) chatUserStatus.textContent = friend?.isOnline ? '🟢 В сети' : '⚫ Не в сети';
        
        if (chatHeader) chatHeader.style.display = 'flex';
        if (messageInputContainer) messageInputContainer.classList.add('active');
        if (noChatSelected) noChatSelected.style.display = 'none';
        
        this.loadChatMessages(friendId);
    }

    async searchUsers(query) {
        if (!query || query.length < 2) {
            const searchResults = document.getElementById('searchResults');
            if (searchResults) {
                searchResults.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">🔍</div>
                        <div class="empty-text">Введите минимум 2 символа для поиска</div>
                    </div>
                `;
            }
            return;
        }

        try {
            const token = localStorage.getItem('messenger_token');
            const response = await fetch(this.API_BASE + `/api/users/search?query=${encodeURIComponent(query)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();
            console.log('🔍 Результаты поиска:', data);

            if (data.success) {
                this.renderSearchResults(data.users);
            } else {
                this.showError(data.error || 'Ошибка поиска');
            }
        } catch (error) {
            console.error('Error searching users:', error);
            this.showError('Ошибка поиска пользователей');
        }
    }

    renderSearchResults(users) {
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;
        
        if (users.length === 0) {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <div class="empty-text">Пользователи не найдены</div>
                </div>
            `;
            return;
        }

        resultsContainer.innerHTML = users.map(user => `
            <div class="user-item">
                <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
                <div class="user-details">
                    <div class="user-name">${user.username}</div>
                    <div class="user-status">${user.isOnline ? '🟢 В сети' : '⚫ Не в сети'}</div>
                </div>
                <div class="user-actions">
                    ${this.getUserActionButton(user)}
                </div>
            </div>
        `).join('');
    }

    getUserActionButton(user) {
        switch (user.friendStatus) {
            case 'friend':
                return '<button class="btn-action btn-pending" disabled>Друг</button>';
            case 'request_sent':
                return '<button class="btn-action btn-pending" disabled>Запрос отправлен</button>';
            case 'request_received':
                return `
                    <button class="btn-action btn-accept" onclick="messenger.respondToFriendRequest('${user.id}', true)">✓</button>
                    <button class="btn-action btn-reject" onclick="messenger.respondToFriendRequest('${user.id}', false)">✗</button>
                `;
            case 'none':
            default:
                return `<button class="btn-action btn-add" onclick="messenger.sendFriendRequest('${user.id}')">Добавить</button>`;
        }
    }

    async sendFriendRequest(friendId) {
        try {
            const token = localStorage.getItem('messenger_token');
            const response = await fetch(this.API_BASE + '/api/friends/request', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ friendId })
            });

            const data = await response.json();

            if (data.success) {
                this.playSound('success');
                this.showSuccess('Запрос в друзья отправлен!');
                const currentQuery = document.getElementById('userSearch')?.value;
                if (currentQuery) {
                    setTimeout(() => this.searchUsers(currentQuery), 500);
                }
            } else {
                this.playSound('error');
                this.showError(data.error);
            }
        } catch (error) {
            console.error('Error sending friend request:', error);
            this.playSound('error');
            this.showError('Ошибка отправки запроса');
        }
    }

    async respondToFriendRequest(friendId, accept) {
        try {
            const token = localStorage.getItem('messenger_token');
            const response = await fetch(this.API_BASE + '/api/friends/requests', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const data = await response.json();
            
            if (data.success) {
                const request = data.requests.find(req => req.from.id === friendId);
                if (request) {
                    await this.respondToRequest(request.id, accept);
                } else {
                    this.showError('Запрос не найден');
                }
            }
        } catch (error) {
            console.error('Error accepting friend request:', error);
            this.showError('Ошибка: ' + error.message);
        }
    }

    async respondToRequest(requestId, accept) {
        try {
            const token = localStorage.getItem('messenger_token');
            const response = await fetch(this.API_BASE + '/api/friends/respond', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ requestId, accept })
            });

            const data = await response.json();

            if (data.success) {
                this.playSound('success');
                this.showSuccess(accept ? 'Запрос принят!' : 'Запрос отклонен');
                this.loadFriendRequests();
                this.loadFriends();
            } else {
                this.playSound('error');
                this.showError(data.error);
            }
        } catch (error) {
            console.error('Error responding to friend request:', error);
            this.playSound('error');
            this.showError('Ошибка: ' + error.message);
        }
    }

    async removeFriend(friendId, friendUsername) {
        if (!confirm(`Вы уверены, что хотите удалить ${friendUsername} из друзей?`)) {
            return;
        }

        try {
            const token = localStorage.getItem('messenger_token');
            const response = await fetch(this.API_BASE + `/api/friends/${friendId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                this.playSound('success');
                this.showSuccess('Друг удален');
                this.loadFriends();
                
                // Если удаленный друг - текущий чат, закрываем чат
                if (this.currentChat?.id === friendId) {
                    this.closeCurrentChat();
                }
            } else {
                this.playSound('error');
                this.showError(data.error);
            }
        } catch (error) {
            console.error('Error removing friend:', error);
            this.playSound('error');
            this.showError('Ошибка удаления друга');
        }
    }

    async togglePin(friendId) {
        try {
            const friend = this.friends.find(f => f.id === friendId);
            if (!friend) return;

            const shouldPin = !friend.isPinned;
            const token = localStorage.getItem('messenger_token');
            
            const response = await fetch(this.API_BASE + '/api/chats/pin', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ friendId, pin: shouldPin })
            });

            const data = await response.json();

            if (data.success) {
                this.playSound('success');
                this.showSuccess(shouldPin ? 'Чат закреплен' : 'Чат откреплен');
                this.loadFriends();
            } else {
                this.playSound('error');
                this.showError(data.error);
            }
        } catch (error) {
            console.error('Error toggling pin:', error);
            this.playSound('error');
            this.showError('Ошибка закрепления чата');
        }
    }

    closeCurrentChat() {
        this.currentChat = null;
        
        const chatHeader = document.getElementById('chatHeader');
        const messageInputContainer = document.getElementById('messageInputContainer');
        const noChatSelected = document.getElementById('noChatSelected');
        const messagesContainer = document.getElementById('messagesContainer');
        
        if (chatHeader) chatHeader.style.display = 'none';
        if (messageInputContainer) messageInputContainer.classList.remove('active');
        if (noChatSelected) noChatSelected.style.display = 'flex';
        if (messagesContainer) messagesContainer.innerHTML = '';
        
        document.querySelectorAll('.friend-item').forEach(item => {
            item.classList.remove('active');
        });
    }

    handleFriendRemoved(friendId) {
        // Удаляем друга из локального списка
        this.friends = this.friends.filter(f => f.id !== friendId);
        this.renderFriendsList();
        
        // Если удаленный друг - текущий чат, закрываем чат
        if (this.currentChat?.id === friendId) {
            this.closeCurrentChat();
        }
        
        this.playSound('error');
        this.showSuccess('Вас удалили из друзей');
    }

    async sendMessage() {
        console.log('🔄 sendMessage вызван');
        
        if (!this.currentChat) {
            this.showError('Выберите чат для общения');
            return;
        }

        if (!this.socket) {
            this.showError('Нет подключения к серверу');
            return;
        }

        const messageInput = document.getElementById('messageInput');
        if (!messageInput) {
            this.showError('Поле ввода сообщения не найдено');
            return;
        }

        const message = messageInput.value.trim();
        if (!message) {
            return;
        }

        console.log('📤 Отправка сообщения:', {
            to: this.currentChat.id,
            message: message,
            currentUser: this.currentUser?.username
        });

        try {
            // Создаем временное сообщение для мгновенного отображения
            const tempMessage = {
                id: 'temp-' + Date.now(),
                from: this.currentUser.username,
                to: this.currentChat.username,
                message: message,
                timestamp: new Date()
            };

            // Добавляем временное сообщение в историю
            if (!this.messages.has(this.currentChat.id)) {
                this.messages.set(this.currentChat.id, []);
            }
            const chatMessages = this.messages.get(this.currentChat.id);
            chatMessages.push(tempMessage);
            this.renderMessages(chatMessages);

            // Очищаем поле ввода
            messageInput.value = '';

            // Отправляем через WebSocket
            this.socket.emit('send_message', {
                to: this.currentChat.id,
                message: message
            });

            console.log('✅ Сообщение отправлено через WebSocket');

        } catch (error) {
            console.error('❌ Ошибка отправки сообщения:', error);
            this.showError('Ошибка отправки сообщения: ' + error.message);
        }
    }

    async clearChat() {
        if (!this.currentChat) {
            this.showError('Выберите чат для очистки');
            return;
        }

        if (!confirm(`Вы уверены, что хотите очистить чат с ${this.currentChat.username}?`)) {
            return;
        }

        try {
            const token = localStorage.getItem('messenger_token');
            const response = await fetch(this.API_BASE + `/api/messages/${this.currentChat.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();

            if (data.success) {
                this.playSound('success');
                this.messages.set(this.currentChat.id, []);
                this.renderMessages([]);
                this.showSuccess('Чат очищен');
            } else {
                this.playSound('error');
                this.showError(data.error);
            }
        } catch (error) {
            console.error('Error clearing chat:', error);
            this.playSound('error');
            this.showError('Ошибка очистки чата');
        }
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.applyTheme();
        
        if (this.currentUser) {
            try {
                const token = localStorage.getItem('messenger_token');
                fetch(this.API_BASE + '/api/user/theme', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ theme: this.theme })
                });
            } catch (error) {
                console.error('Error saving theme:', error);
            }
        }
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('messenger_theme') || 'light';
        this.theme = savedTheme;
        this.applyTheme();
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        localStorage.setItem('messenger_theme', this.theme);
        
        const themeIcon = document.querySelector('.theme-icon');
        if (themeIcon) {
            themeIcon.textContent = this.theme === 'dark' ? '☀️' : '🌙';
        }
    }

    showAuthScreen() {
        console.log('🔄 Показ экрана авторизации');
        const authScreen = document.getElementById('authScreen');
        const mainScreen = document.getElementById('mainScreen');
        
        if (authScreen) authScreen.classList.add('active');
        if (mainScreen) mainScreen.classList.remove('active');
    }

    showMainScreen() {
        console.log('🔄 Показ основного экрана');
        const authScreen = document.getElementById('authScreen');
        const mainScreen = document.getElementById('mainScreen');
        
        if (authScreen) authScreen.classList.remove('active');
        if (mainScreen) mainScreen.classList.add('active');
        
        const headerUsername = document.getElementById('headerUsername');
        if (headerUsername && this.currentUser) {
            headerUsername.textContent = this.currentUser.username;
        }
        
        this.applyTheme();
    }

    logout() {
        localStorage.removeItem('messenger_token');
        localStorage.removeItem('messenger_user');
        
        if (this.socket) {
            this.socket.disconnect();
        }
        
        this.currentUser = null;
        this.friends = [];
        this.currentChat = null;
        this.messages.clear();
        
        this.showAuthScreen();
    }

    showError(message) {
        console.error('❌ Ошибка:', message);
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        console.log('✅ Успех:', message);
        this.showNotification(message, 'success');
    }

    showNotification(message, type) {
        // Удаляем старые уведомления
        document.querySelectorAll('.notification').forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            background: ${type === 'error' ? '#dc3545' : '#28a745'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideInRight 0.3s ease, bounceIn 0.5s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 4000);
    }

    async loadFriendRequests() {
        try {
            const token = localStorage.getItem('messenger_token');
            const response = await fetch(this.API_BASE + '/api/friends/requests', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();

            if (data.success) {
                this.renderFriendRequests(data.requests);
            }
        } catch (error) {
            console.error('Error loading friend requests:', error);
        }
    }

    renderFriendRequests(requests) {
        const requestsContainer = document.getElementById('requestsList');
        if (!requestsContainer) return;
        
        if (requests.length === 0) {
            requestsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📨</div>
                    <div class="empty-text">Нет входящих запросов</div>
                </div>
            `;
            return;
        }

        requestsContainer.innerHTML = requests.map(request => `
            <div class="request-item">
                <div class="user-avatar">${request.from.username.charAt(0).toUpperCase()}</div>
                <div class="user-details">
                    <div class="user-name">${request.from.username}</div>
                    <div class="user-status">${request.from.isOnline ? '🟢 В сети' : '⚫ Не в сети'}</div>
                </div>
                <div class="user-actions">
                    <button class="btn-action btn-accept" onclick="messenger.respondToRequest('${request.id}', true)">✓</button>
                    <button class="btn-action btn-reject" onclick="messenger.respondToRequest('${request.id}', false)">✗</button>
                </div>
            </div>
        `).join('');
    }

    async loadChatMessages(friendId) {
        try {
            const token = localStorage.getItem('messenger_token');
            const response = await fetch(this.API_BASE + `/api/messages/${friendId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();
            if (data.success) {
                this.messages.set(friendId, data.messages);
                this.renderMessages(data.messages);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }

    renderMessages(messages) {
        const container = document.getElementById('messagesContainer');
        if (!container) return;
        
        if (messages.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">💬</div>
                    <div class="empty-text">Начните общение!</div>
                </div>
            `;
            return;
        }

        container.innerHTML = messages.map(message => `
            <div class="message ${message.from === this.currentUser.username ? 'own' : 'other'}">
                <div class="message-sender">${message.from}</div>
                <div class="message-text">${this.escapeHtml(message.message)}</div>
                <div class="message-time">${new Date(message.timestamp).toLocaleTimeString('ru-RU', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                })}</div>
            </div>
        `).join('');

        container.scrollTop = container.scrollHeight;
    }

    handleNewMessage(message) {
        console.log('📥 Получено новое сообщение:', message);
        
        // Определяем ID чата для этого сообщения
        let chatId;
        if (message.from === this.currentUser.username) {
            // Если сообщение от нас, то to - это ID друга
            chatId = this.currentChat?.id;
        } else {
            // Если сообщение от друга, ищем его в списке друзей
            const friend = this.friends.find(f => f.username === message.from);
            chatId = friend?.id;
        }

        if (chatId) {
            if (!this.messages.has(chatId)) {
                this.messages.set(chatId, []);
            }
            
            const chatMessages = this.messages.get(chatId);
            
            // Удаляем временное сообщение если есть
            const tempIndex = chatMessages.findIndex(m => m.id && m.id.startsWith('temp-'));
            if (tempIndex > -1) {
                chatMessages.splice(tempIndex, 1);
            }
            
            // Добавляем настоящее сообщение
            chatMessages.push(message);
            this.renderMessages(chatMessages);

            // Если это текущий открытый чат, обновляем отображение
            if (this.currentChat?.id === chatId) {
                this.renderMessages(chatMessages);
            }
        }
    }

    updateFriendStatus(friendId, isOnline) {
        const friend = this.friends.find(f => f.id === friendId);
        if (friend) {
            friend.isOnline = isOnline;
            friend.lastSeen = new Date();
            this.renderFriendsList();
            
            if (this.currentChat?.id === friendId) {
                const chatUserStatus = document.getElementById('chatUserStatus');
                if (chatUserStatus) {
                    chatUserStatus.textContent = isOnline ? '🟢 В сети' : '⚫ Не в сети';
                }
            }
        }
    }

    showFriendRequestNotification(data) {
        if (confirm(`${data.username} хочет добавить вас в друзья. Принять запрос?`)) {
            this.respondToFriendRequest(data.from, true);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Инициализация Secure Messenger...');
    window.messenger = new SecureMessenger();
});

// Глобальные функции для обратной совместимости
window.login = () => {
    console.log('🌍 Глобальная функция login вызвана');
    window.messenger?.login();
};

window.register = () => {
    console.log('🌍 Глобальная функция register вызвана');
    window.messenger?.register();
};

window.sendMessage = () => {
    console.log('🌍 Глобальная функция sendMessage вызвана');
    window.messenger?.sendMessage();
};

window.clearChat = () => {
    console.log('🌍 Глобальная функция clearChat вызвана');
    window.messenger?.clearChat();
};

window.toggleTheme = () => {
    console.log('🌍 Глобальная функция toggleTheme вызвана');
    window.messenger?.toggleTheme();
};

window.logout = () => {
    console.log('🌍 Глобальная функция logout вызвана');
    window.messenger?.logout();
};