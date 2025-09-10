const API_BASE = window.location.origin;
let currentUser = null;
let currentChat = null;
let blockedUsers = new Set();
let chatInterval = null;

// Функции для работы с localStorage
function saveBlockedUsers() {
    localStorage.setItem('blockedUsers', JSON.stringify(Array.from(blockedUsers)));
}

function loadBlockedUsers() {
    const saved = localStorage.getItem('blockedUsers');
    if (saved) {
        blockedUsers = new Set(JSON.parse(saved));
    }
}

// Основные функции
async function loginOrRegister() {
    const email = document.getElementById('login-email').value;
    const firstName = document.getElementById('login-firstname').value;
    const lastName = document.getElementById('login-lastname').value;

    if (!email || !firstName || !lastName) {
        alert('Заполните все поля');
        return;
    }

    try {
        // Проверяем существование пользователя
        const checkResponse = await fetch(`${API_BASE}/check-user/${email}`);
        const checkData = await checkResponse.json();

        if (!checkData.exists) {
            // Регистрируем нового пользователя
            const registerResponse = await fetch(`${API_BASE}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, firstName, lastName })
            });
            
            const registerData = await registerResponse.json();
            if (!registerData.success) {
                throw new Error(registerData.error);
            }
        }

        currentUser = { email, firstName, lastName };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        loadBlockedUsers();
        showMainInterface();
        loadChats();
        
    } catch (error) {
        console.error('Ошибка входа:', error);
        alert('Ошибка входа: ' + error.message);
    }
}

function logout() {
    currentUser = null;
    currentChat = null;
    clearInterval(chatInterval);
    localStorage.removeItem('currentUser');
    showLoginInterface();
}

function showMainInterface() {
    document.getElementById('login-section').classList.remove('active');
    document.getElementById('main-section').classList.add('active');
    document.getElementById('current-user').textContent = 
        `${currentUser.firstName} ${currentUser.lastName} (${currentUser.email})`;
}

function showLoginInterface() {
    document.getElementById('main-section').classList.remove('active');
    document.getElementById('login-section').classList.add('active');
}

// Загрузка чатов
async function loadChats() {
    try {
        const response = await fetch(`${API_BASE}/chats/${currentUser.email}`);
        const data = await response.json();
        
        if (data.success) {
            displayChats(data.chats);
        }
    } catch (error) {
        console.error('Ошибка загрузки чатов:', error);
    }
}

function displayChats(chats) {
    const chatsList = document.getElementById('chats-list');
    chatsList.innerHTML = '';

    chats.forEach(chat => {
        if (blockedUsers.has(chat.contactEmail)) return;

        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.innerHTML = `
            <strong>${chat.firstName} ${chat.lastName}</strong>
            <br>
            <small>${chat.contactEmail}</small>
        `;
        
        chatItem.onclick = () => selectChat(chat);
        chatsList.appendChild(chatItem);
    });

    updateBlockedList();
}

// Блокировка пользователей
async function blockUser() {
    if (!currentChat) return;

    if (confirm(`Заблокировать пользователя ${currentChat.firstName} ${currentChat.lastName}?`)) {
        blockedUsers.add(currentChat.contactEmail);
        saveBlockedUsers();
        
        // Удаляем из списка чатов
        const chatItems = document.querySelectorAll('.chat-item');
        chatItems.forEach(item => {
            if (item.textContent.includes(currentChat.contactEmail)) {
                item.remove();
            }
        });

        // Очищаем текущий чат
        currentChat = null;
        document.getElementById('messages-container').innerHTML = '';
        document.getElementById('chat-header').innerHTML = '<span>Выберите чат</span>';
        document.getElementById('user-details').innerHTML = '';
        
        document.getElementById('message-input').disabled = true;
        document.getElementById('send-btn').disabled = true;
        document.getElementById('block-btn').style.display = 'none';

        updateBlockedList();
    }
}

async function unblockUser(email) {
    blockedUsers.delete(email);
    saveBlockedUsers();
    updateBlockedList();
    loadChats(); // Перезагружаем чаты
}

function updateBlockedList() {
    const blockedList = document.getElementById('blocked-list');
    blockedList.innerHTML = '';

    if (blockedUsers.size === 0) {
        blockedList.innerHTML = '<p>Нет заблокированных пользователей</p>';
        return;
    }

    blockedUsers.forEach(email => {
        const blockedItem = document.createElement('div');
        blockedItem.className = 'blocked-user';
        blockedItem.innerHTML = `
            <span>${email}</span>
            <button class="unblock-btn" onclick="unblockUser('${email}')">Разблокировать</button>
        `;
        blockedList.appendChild(blockedItem);
    });
}

// Работа с чатами
async function selectChat(chat) {
    currentChat = chat;
    
    // Обновляем интерфейс
    document.getElementById('chat-header').innerHTML = `
        <strong>${chat.firstName} ${chat.lastName}</strong>
        <br>
        <small>${chat.contactEmail}</small>
    `;

    document.getElementById('user-details').innerHTML = `
        <h3>${chat.firstName} ${chat.lastName}</h3>
        <p>${chat.contactEmail}</p>
    `;

    document.getElementById('message-input').disabled = false;
    document.getElementById('send-btn').disabled = false;
    document.getElementById('block-btn').style.display = 'block';

    // Загружаем сообщения
    await loadMessages();
    
    // Запускаем автообновление
    clearInterval(chatInterval);
    chatInterval = setInterval(loadMessages, 3000);
}

async function loadMessages() {
    if (!currentChat) return;

    try {
        const response = await fetch(
            `${API_BASE}/messages/${currentUser.email}/${currentChat.contactEmail}`
        );
        const data = await response.json();
        
        if (data.success) {
            displayMessages(data.messages);
        }
    } catch (error) {
        console.error('Ошибка загрузки сообщений:', error);
    }
}

function displayMessages(messages) {
    const container = document.getElementById('messages-container');
    container.innerHTML = '';

    messages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${
            msg.senderEmail === currentUser.email ? 'sent' : 'received'
        }`;
        
        let content = msg.message;
        if (msg.attachmentType) {
            content += `<br><small>📎 Файл: ${msg.attachmentName}</small>`;
        }
        
        messageDiv.innerHTML = `
            <div>${content}</div>
            <small>${new Date(msg.timestamp).toLocaleTimeString()}</small>
        `;
        
        container.appendChild(messageDiv);
    });

    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if (!message || !currentChat) return;

    try {
        const response = await fetch(`${API_BASE}/send-message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderEmail: currentUser.email,
                receiverEmail: currentChat.contactEmail,
                message: message
            })
        });

        const data = await response.json();
        
        if (data.success) {
            input.value = '';
            loadMessages(); // Обновляем сообщения
        }
    } catch (error) {
        console.error('Ошибка отправки сообщения:', error);
    }
}

async function clearChat() {
    if (!currentChat) return;

    if (confirm('Очистить историю чата?')) {
        try {
            const response = await fetch(`${API_BASE}/clear-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userEmail: currentUser.email,
                    friendEmail: currentChat.contactEmail
                })
            });

            const data = await response.json();
            
            if (data.success) {
                document.getElementById('messages-container').innerHTML = '';
            }
        } catch (error) {
            console.error('Ошибка очистки чата:', error);
        }
    }
}

// Поиск пользователей
async function searchUser() {
    const searchTerm = document.getElementById('search-user').value.toLowerCase();
    
    try {
        const response = await fetch(`${API_BASE}/users`);
        const data = await response.json();
        
        if (data.success) {
            const filteredUsers = data.users.filter(user => 
                user.email.toLowerCase().includes(searchTerm) ||
                user.firstName.toLowerCase().includes(searchTerm) ||
                user.lastName.toLowerCase().includes(searchTerm)
            );
            
            displaySearchResults(filteredUsers);
        }
    } catch (error) {
        console.error('Ошибка поиска:', error);
    }
}

function displaySearchResults(users) {
    const chatsList = document.getElementById('chats-list');
    chatsList.innerHTML = '';

    users.forEach(user => {
        if (user.email === currentUser.email || blockedUsers.has(user.email)) return;

        const userItem = document.createElement('div');
        userItem.className = 'chat-item';
        userItem.innerHTML = `
            <strong>${user.firstName} ${user.lastName}</strong>
            <br>
            <small>${user.email}</small>
        `;
        
        userItem.onclick = () => selectChat({
            contactEmail: user.email,
            firstName: user.firstName,
            lastName: user.lastName
        });
        
        chatsList.appendChild(userItem);
    });
}

// Вспомогательные функции
function toggleFileInput() {
    document.getElementById('file-input').click();
}

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        loadBlockedUsers();
        showMainInterface();
        loadChats();
    }

    // Обработка Enter для отправки сообщения
    document.getElementById('message-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Обработка Enter для поиска
    document.getElementById('search-user').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchUser();
        }
    });
});
