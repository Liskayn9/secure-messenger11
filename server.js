const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

console.log('🚀 Starting Secure Messenger on Railway...');

const app = express();
const server = http.createServer(app);

// 🔥 ПРОСТЫЕ НАСТРОЙКИ ДЛЯ RAILWAY
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 🔥 ПОДКЛЮЧЕНИЕ К MONGODB ДЛЯ RAILWAY
const MONGODB_URI = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/secure-messenger';

console.log('🔗 Connecting to MongoDB...');
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Схемы и модели
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, default: null },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  theme: { type: String, default: 'light' },
  pinnedChats: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const friendRequestSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' }
});

// Простая проверка пароля
userSchema.methods.correctPassword = async function(candidatePassword) {
  return candidatePassword === this.password;
};

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);
const FriendRequest = mongoose.model('FriendRequest', friendRequestSchema);

// 🔥 ПРОСТАЯ АВТОРИЗАЦИЯ
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Токен отсутствует' });
  }

  jwt.verify(token, 'your-super-secret-jwt-key', (err, user) => {
    if (err) return res.status(403).json({ error: 'Неверный токен' });
    req.user = user;
    next();
  });
};

// 🔥 API РОУТЫ
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Это имя пользователя уже занято' });
    }

    const user = new User({ username, password, email: email || null });
    await user.save();

    const token = jwt.sign({ userId: user._id }, 'your-super-secret-jwt-key', { expiresIn: '30d' });

    res.json({
      success: true,
      token,
      user: { id: user._id, username: user.username, email: user.email, theme: user.theme }
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

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

    const token = jwt.sign({ userId: user._id }, 'your-super-secret-jwt-key', { expiresIn: '30d' });

    res.json({
      success: true,
      token,
      user: { id: user._id, username: user.username, email: user.email, theme: user.theme, isOnline: true }
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/friends', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const friendRequests = await FriendRequest.find({
      $or: [{ from: userId }, { to: userId }],
      status: 'accepted'
    }).populate('from', 'username isOnline lastSeen').populate('to', 'username isOnline lastSeen');

    const user = await User.findById(userId).select('pinnedChats');
    const pinnedChats = user?.pinnedChats || [];

    const friends = friendRequests.map(request => {
      const friend = request.from._id.toString() === userId ? request.to : request.from;
      return {
        id: friend._id,
        username: friend.username,
        isOnline: friend.isOnline,
        lastSeen: friend.lastSeen,
        isPinned: pinnedChats.includes(friend._id.toString())
      };
    });

    res.json({ success: true, friends });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/users/search', authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.user.userId;

    if (!query) return res.json({ success: true, users: [] });

    const users = await User.find({
      username: { $regex: query, $options: 'i' },
      _id: { $ne: userId }
    }).select('username isOnline lastSeen').limit(10);

    const usersWithStatus = await Promise.all(users.map(async (user) => {
      const friendRequest = await FriendRequest.findOne({
        $or: [{ from: userId, to: user._id }, { from: user._id, to: userId }]
      });

      let status = 'none';
      if (friendRequest) {
        status = friendRequest.status === 'accepted' ? 'friend' : 
                friendRequest.from.toString() === userId ? 'request_sent' : 'request_received';
      }

      return { id: user._id, username: user.username, isOnline: user.isOnline, friendStatus: status };
    }));

    res.json({ success: true, users: usersWithStatus });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/friends/request', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { friendId } = req.body;

    const existingRequest = await FriendRequest.findOne({
      $or: [{ from: userId, to: friendId }, { from: friendId, to: userId }]
    });

    if (existingRequest) {
      return res.status(400).json({ error: 'Запрос в друзья уже отправлен' });
    }

    const friendRequest = new FriendRequest({ from: userId, to: friendId });
    await friendRequest.save();

    res.json({ success: true, message: 'Запрос в друзья отправлен' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/friends/requests', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const requests = await FriendRequest.find({ to: userId, status: 'pending' })
      .populate('from', 'username isOnline lastSeen');

    res.json({ success: true, requests: requests.map(req => ({
      id: req._id,
      from: { id: req.from._id, username: req.from.username, isOnline: req.from.isOnline },
      createdAt: req.createdAt
    }))});
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/friends/respond', authenticateToken, async (req, res) => {
  try {
    const { requestId, accept } = req.body;

    const friendRequest = await FriendRequest.findById(requestId).populate('from').populate('to');
    if (!friendRequest) return res.status(404).json({ error: 'Запрос не найден' });

    if (accept) {
      friendRequest.status = 'accepted';
      await friendRequest.save();
      res.json({ success: true, message: 'Запрос в друзья принят' });
    } else {
      await FriendRequest.findByIdAndDelete(requestId);
      res.json({ success: true, message: 'Запрос в друзья отклонен' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/messages/:friendId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { friendId } = req.params;

    const messages = await Message.find({
      $or: [{ from: userId, to: friendId }, { from: friendId, to: userId }]
    })
    .populate('from', 'username')
    .populate('to', 'username')
    .sort({ timestamp: 1 })
    .limit(100);

    res.json({ success: true, messages: messages.map(msg => ({
      id: msg._id, from: msg.from.username, to: msg.to.username, 
      message: msg.message, timestamp: msg.timestamp
    }))});
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 🔥 ОБРАБОТЧИК ДЛЯ SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🔥 SOCKET.IO ЛОГИКА
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Токен отсутствует'));

    const decoded = jwt.verify(token, 'your-super-secret-jwt-key');
    const user = await User.findById(decoded.userId);
    if (!user) return next(new Error('Пользователь не найден'));

    socket.userId = user._id.toString();
    socket.username = user.username;
    next();
  } catch (error) {
    next(new Error('Ошибка авторизации'));
  }
});

io.on('connection', async (socket) => {
  console.log('✅ User connected:', socket.username);

  await User.findByIdAndUpdate(socket.userId, { isOnline: true, lastSeen: new Date() });

  socket.on('send_message', async (data) => {
    try {
      const { to, message } = data;

      const newMessage = new Message({ from: socket.userId, to: to, message: message.trim() });
      await newMessage.save();

      const messageData = {
        id: newMessage._id, from: socket.username, to: to, 
        message: newMessage.message, timestamp: newMessage.timestamp
      };

      socket.emit('new_message', messageData);
      socket.to(to).emit('new_message', messageData);
    } catch (error) {
      socket.emit('error', { message: 'Ошибка отправки сообщения' });
    }
  });

  socket.on('disconnect', async () => {
    console.log('❌ User disconnected:', socket.username);
    await User.findByIdAndUpdate(socket.userId, { isOnline: false, lastSeen: new Date() });
  });
});

// 🔥 ЗАПУСК СЕРВЕРА
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Ready for Railway!`);
});