const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');

// 🔥 ВЕРСИЯ ДЛЯ RAILWAY
console.log('🚀 Starting Secure Messenger on Railway...');

const app = express();
const server = http.createServer(app);

// 🔥 НАСТРОЙКИ ДЛЯ RAILWAY - ПРОСТЫЕ И РАБОЧИЕ
const io = socketIo(server, {
  cors: {
    origin: "*",  // Разрешаем все домены
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Базовые настройки CORS
app.use(cors({
  origin: "*",  // Разрешаем все домены
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 🔥 ПОДКЛЮЧЕНИЕ К MONGODB ДЛЯ RAILWAY
const MONGODB_URI = process.env.MONGO_URL || 
                    process.env.MONGODB_URI || 
                    'mongodb://localhost:27017/secure-messenger';

console.log('🔗 Connecting to MongoDB...');
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Схемы и модели
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  password: {
    type: String,
    required: true
  },
  email: {
    type: String,
    default: null
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  theme: {
    type: String,
    enum: ['light', 'dark'],
    default: 'light'
  },
  pinnedChats: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

const messageSchema = new mongoose.Schema({
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const friendRequestSchema = new mongoose.Schema({
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  }
});

// Простая проверка пароля без хеширования
userSchema.methods.correctPassword = async function(candidatePassword) {
  return candidatePassword === this.password;
};

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);
const FriendRequest = mongoose.model('FriendRequest', friendRequestSchema);

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Токен доступа отсутствует' });
  }

  jwt.verify(token, 'your-super-secret-jwt-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Неверный токен' });
    }
    req.user = user;
    next();
  });
};

// API routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Имя пользователя должно содержать минимум 3 символа' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Это имя пользователя уже занято' });
    }

    const user = new User({
      username,
      password,
      email: email || null
    });

    await user.save();

    const token = jwt.sign(
      { userId: user._id },
      'your-super-secret-jwt-key',
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        theme: user.theme
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, rememberMe } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Введите имя пользователя и пароль' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'Неверное имя пользователя или пароль' });
    }

    const isPasswordCorrect = await user.correctPassword(password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ error: 'Неверное имя пользователя или пароль' });
    }

    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    const token = jwt.sign(
      { userId: user._id },
      'your-super-secret-jwt-key',
      { expiresIn: rememberMe ? '30d' : '1d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        theme: user.theme,
        isOnline: user.isOnline
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/auth/check-username', async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({ error: 'Имя пользователя обязательно' });
    }

    const existingUser = await User.findOne({ username });
    res.json({ available: !existingUser });
  } catch (error) {
    console.error('Error checking username:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/friends', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const friendRequests = await FriendRequest.find({
      $or: [{ from: userId }, { to: userId }],
      status: 'accepted'
    }).populate('from', 'username isOnline lastSeen pinnedChats').populate('to', 'username isOnline lastSeen pinnedChats');

    const user = await User.findById(userId).select('pinnedChats');
    const pinnedChats = user?.pinnedChats || [];

    const friends = friendRequests.map(request => {
      const friend = request.from._id.toString() === userId ? request.to : request.from;
      const isPinned = pinnedChats.includes(friend._id.toString());
      
      return {
        id: friend._id,
        username: friend.username,
        isOnline: friend.isOnline,
        lastSeen: friend.lastSeen,
        isPinned: isPinned
      };
    });

    // Сортируем: сначала закрепленные, потом остальные
    friends.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });

    res.json({ success: true, friends });
  } catch (error) {
    console.error('Error getting friends:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/users/search', authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.user.userId;

    if (!query || query.length < 2) {
      return res.json({ success: true, users: [] });
    }

    const users = await User.find({
      username: { $regex: query, $options: 'i' },
      _id: { $ne: userId }
    }).select('username isOnline lastSeen').limit(20);

    const usersWithStatus = await Promise.all(
      users.map(async (user) => {
        const friendRequest = await FriendRequest.findOne({
          $or: [
            { from: userId, to: user._id },
            { from: user._id, to: userId }
          ]
        });

        let status = 'none';
        if (friendRequest) {
          if (friendRequest.status === 'accepted') status = 'friend';
          else if (friendRequest.status === 'pending') {
            status = friendRequest.from.toString() === userId ? 'request_sent' : 'request_received';
          }
        }

        return {
          id: user._id,
          username: user.username,
          isOnline: user.isOnline,
          lastSeen: user.lastSeen,
          friendStatus: status
        };
      })
    );

    res.json({ success: true, users: usersWithStatus });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/friends/request', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { friendId } = req.body;

    if (!friendId) {
      return res.status(400).json({ error: 'ID пользователя обязателен' });
    }

    const friend = await User.findById(friendId);
    if (!friend) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const existingRequest = await FriendRequest.findOne({
      $or: [
        { from: userId, to: friendId },
        { from: friendId, to: userId }
      ]
    });

    if (existingRequest) {
      return res.status(400).json({ error: 'Запрос в друзья уже отправлен' });
    }

    const friendRequest = new FriendRequest({
      from: userId,
      to: friendId
    });

    await friendRequest.save();

    io.to(friendId).emit('friend_request_received', {
      from: userId,
      username: req.user.username
    });

    res.json({ success: true, message: 'Запрос в друзья отправлен' });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/friends/requests', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const requests = await FriendRequest.find({
      to: userId,
      status: 'pending'
    }).populate('from', 'username isOnline lastSeen');

    res.json({
      success: true,
      requests: requests.map(req => ({
        id: req._id,
        from: {
          id: req.from._id,
          username: req.from.username,
          isOnline: req.from.isOnline
        },
        createdAt: req.createdAt
      }))
    });
  } catch (error) {
    console.error('Error getting friend requests:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/friends/respond', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { requestId, accept } = req.body;

    console.log('📨 Responding to friend request:', { requestId, accept, userId });

    const friendRequest = await FriendRequest.findOne({
      _id: requestId,
      to: userId,
      status: 'pending'
    }).populate('from').populate('to');

    if (!friendRequest) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }

    if (accept) {
      friendRequest.status = 'accepted';
      await friendRequest.save();
      
      console.log('✅ Friend request accepted, users are now friends');
      
      // Уведомляем обоих пользователей
      io.to(friendRequest.from._id.toString()).emit('friend_added', {
        friendId: friendRequest.to._id,
        username: friendRequest.to.username
      });
      
      io.to(friendRequest.to._id.toString()).emit('friend_added', {
        friendId: friendRequest.from._id,
        username: friendRequest.from.username
      });

      res.json({ 
        success: true, 
        message: 'Запрос в друзья принят',
        friend: {
          id: friendRequest.from._id,
          username: friendRequest.from.username
        }
      });
    } else {
      await FriendRequest.findByIdAndDelete(requestId);
      res.json({ success: true, message: 'Запрос в друзья отклонен' });
    }
  } catch (error) {
    console.error('Error responding to friend request:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.delete('/api/friends/:friendId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { friendId } = req.params;

    console.log('🗑️ Удаление друга:', { userId, friendId });

    // Находим и удаляем запрос дружбы
    const friendRequest = await FriendRequest.findOneAndDelete({
      $or: [
        { from: userId, to: friendId, status: 'accepted' },
        { from: friendId, to: userId, status: 'accepted' }
      ]
    });

    if (!friendRequest) {
      return res.status(404).json({ error: 'Друг не найден' });
    }

    // Удаляем из закрепленных чатов
    await User.findByIdAndUpdate(userId, {
      $pull: { pinnedChats: friendId }
    });

    await User.findByIdAndUpdate(friendId, {
      $pull: { pinnedChats: userId }
    });

    // Уведомляем через WebSocket
    io.to(friendId).emit('friend_removed', { userId: userId });
    
    console.log('✅ Друг удален');

    res.json({ success: true, message: 'Друг удален' });
  } catch (error) {
    console.error('Error removing friend:', error);
    res.status(500).json({ error: 'Ошибка удаления друга' });
  }
});

app.post('/api/chats/pin', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { friendId, pin } = req.body;

    console.log('📌 Изменение закрепления чата:', { userId, friendId, pin });

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (pin) {
      // Закрепляем чат
      if (!user.pinnedChats.includes(friendId)) {
        user.pinnedChats.push(friendId);
      }
    } else {
      // Открепляем чат
      user.pinnedChats = user.pinnedChats.filter(chatId => chatId.toString() !== friendId);
    }

    await user.save();

    res.json({ 
      success: true, 
      message: pin ? 'Чат закреплен' : 'Чат откреплен',
      pinnedChats: user.pinnedChats 
    });
  } catch (error) {
    console.error('Error pinning chat:', error);
    res.status(500).json({ error: 'Ошибка закрепления чата' });
  }
});

app.get('/api/messages/:friendId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { friendId } = req.params;

    const messages = await Message.find({
      $or: [
        { from: userId, to: friendId },
        { from: friendId, to: userId }
      ]
    })
    .populate('from', 'username')
    .populate('to', 'username')
    .sort({ timestamp: 1 })
    .limit(50);

    res.json({
      success: true,
      messages: messages.map(msg => ({
        id: msg._id,
        from: msg.from.username,
        to: msg.to.username,
        message: msg.message,
        timestamp: msg.timestamp
      }))
    });
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.delete('/api/messages/:friendId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { friendId } = req.params;

    await Message.deleteMany({
      $or: [
        { from: userId, to: friendId },
        { from: friendId, to: userId }
      ]
    });

    res.json({ success: true, message: 'Чат очищен' });
  } catch (error) {
    console.error('Error clearing chat:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.put('/api/user/theme', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { theme } = req.body;

    await User.findByIdAndUpdate(userId, { theme });
    res.json({ success: true, message: 'Тема изменена' });
  } catch (error) {
    console.error('Error changing theme:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ОБЯЗАТЕЛЬНО: Добавляем обработчик для всех остальных маршрутов
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io логика
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Токен отсутствует'));
    }

    const decoded = jwt.verify(token, 'your-super-secret-jwt-key');
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return next(new Error('Пользователь не найден'));
    }

    socket.userId = user._id.toString();
    socket.username = user.username;
    next();
  } catch (error) {
    next(new Error('Ошибка авторизации'));
  }
});

io.on('connection', async (socket) => {
  console.log('✅ User connected:', socket.username);

  socket.join(socket.userId);

  await User.findByIdAndUpdate(socket.userId, {
    isOnline: true,
    lastSeen: new Date()
  });

  const friendRequests = await FriendRequest.find({
    $or: [{ from: socket.userId }, { to: socket.userId }],
    status: 'accepted'
  });

  friendRequests.forEach(request => {
    const friendId = request.from.toString() === socket.userId ? 
      request.to.toString() : request.from.toString();
    socket.to(friendId).emit('friend_online', { userId: socket.userId });
  });

  socket.on('send_message', async (data) => {
    try {
      const { to, message } = data;

      if (!to || !message) {
        socket.emit('error', { message: 'Получатель и сообщение обязательны' });
        return;
      }

      // Проверяем, есть ли дружба между пользователями
      const friendRequest = await FriendRequest.findOne({
        $or: [
          { from: socket.userId, to: to, status: 'accepted' },
          { from: to, to: socket.userId, status: 'accepted' }
        ]
      });

      if (!friendRequest) {
        socket.emit('error', { message: 'Вы не можете писать этому пользователю' });
        return;
      }

      const newMessage = new Message({
        from: socket.userId,
        to: to,
        message: message.trim()
      });

      await newMessage.save();

      const messageData = {
        id: newMessage._id,
        from: socket.username,
        to: to,
        message: newMessage.message,
        timestamp: newMessage.timestamp
      };

      socket.emit('new_message', messageData);
      socket.to(to).emit('new_message', messageData);

    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Ошибка отправки сообщения' });
    }
  });

  socket.on('disconnect', async () => {
    console.log('❌ User disconnected:', socket.username);

    await User.findByIdAndUpdate(socket.userId, {
      isOnline: false,
      lastSeen: new Date()
    });

    const friendRequests = await FriendRequest.find({
      $or: [{ from: socket.userId }, { to: socket.userId }],
      status: 'accepted'
    });

    friendRequests.forEach(request => {
      const friendId = request.from.toString() === socket.userId ? 
        request.to.toString() : request.from.toString();
      socket.to(friendId).emit('friend_offline', { userId: socket.userId });
    });
  });
});

// 🔥 ВЕРСИЯ ДЛЯ RAILWAY - ПРОСТОЙ И РАБОЧИЙ ЗАПУСК
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📱 Ready to receive connections!`);
});

// Функция для получения локального IP (только для разработки)
function getLocalIP() {
  if (process.env.NODE_ENV === 'production') return 'railway';
  
  const interfaces = require('os').networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      if (interface.family === 'IPv4' && !interface.internal) {
        return interface.address;
      }
    }
  }
  return 'localhost';
}