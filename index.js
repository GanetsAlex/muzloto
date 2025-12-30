
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// Хранилище комнат в памяти
const rooms = new Map();
const ROOM_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 часа

// Очистка старых комнат каждые 10 минут
setInterval(() => {
  const now = Date.now();
  let deletedCount = 0;
  for (const [code, room] of rooms.entries()) {
    if (now - room.lastActivity > ROOM_EXPIRY_MS) {
      rooms.delete(code);
      deletedCount++;
      console.log(`Комната ${code} удалена по истечении времени`);
    }
  }
  if (deletedCount > 0) {
    console.log(`Автоочистка: удалено ${deletedCount} комнат`);
  }
}, 10 * 60 * 1000);

// Генерация кода комнаты
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms.has(code));
  return code;
}

// === АДМИНИСТРАТИВНЫЕ ФУНКЦИИ ===

// 1. Очистить ВСЕ комнаты
app.post('/api/admin/clear-rooms', (req, res) => {
  try {
    const { password } = req.body;
    // Пароль для защиты (поменяйте на свой!)
    if (password !== 'muzloto2024') {
      return res.status(401).json({ error: 'Неверный пароль' });
    }
    
    const roomCount = rooms.size;
    rooms.clear();
    
    console.log(`✅ Все комнаты очищены (${roomCount} комнат удалено)`);
    res.json({ 
      status: 'ok', 
      message: `Удалено ${roomCount} комнат`,
      clearedAt: new Date().toISOString(),
      deletedCount: roomCount
    });
    
  } catch (error) {
    console.error('Ошибка очистки комнат:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// 2. Очистить только старые комнаты
app.post('/api/admin/cleanup', (req, res) => {
  try {
    const now = Date.now();
    const deletedRooms = [];
    
    for (const [code, room] of rooms.entries()) {
      if (now - room.lastActivity > ROOM_EXPIRY_MS) {
        rooms.delete(code);
        deletedRooms.push({
          code: code,
          hostName: room.hostName,
          ageHours: Math.round((now - room.lastActivity) / (1000 * 60 * 60))
        });
      }
    }
    
    console.log(`🧹 Очистка старых комнат: удалено ${deletedRooms.length}`);
    res.json({
      status: 'ok',
      deletedCount: deletedRooms.length,
      deletedRooms: deletedRooms,
      remainingCount: rooms.size
    });
    
  } catch (error) {
    console.error('Ошибка очистки старых комнат:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// 3. Получить информацию о всех комнатах
app.get('/api/admin/rooms-info', (req, res) => {
  try {
    const { password } = req.query;
    if (password !== 'muzloto2024') {
      return res.status(401).json({ error: 'Неверный пароль' });
    }
    
    const activeRooms = Array.from(rooms.values()).map(room => ({
      code: room.code,
      hostName: room.hostName,
      songsCount: room.songs.length,
      playedCount: room.playedNumbers.length,
      playersCount: room.players.length,
      createdAt: new Date(room.createdAt).toLocaleString('ru-RU'),
      lastActivity: new Date(room.lastActivity).toLocaleString('ru-RU'),
      ageMinutes: Math.round((Date.now() - room.lastActivity) / (1000 * 60))
    }));
    
    res.json({
      totalRooms: rooms.size,
      rooms: activeRooms
    });
    
  } catch (error) {
    console.error('Ошибка получения информации о комнатах:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// === ОСНОВНЫЕ ФУНКЦИИ КОМНАТ ===

// Создание комнаты
app.post('/api/rooms/create', (req, res) => {
  try {
    const { roomCode: requestedCode, hostName } = req.body;
    
    // Если код не передан, генерируем случайный
    const roomCode = requestedCode || generateRoomCode();
    
    // Проверяем, существует ли уже комната с таким кодом
    if (rooms.has(roomCode)) {
      return res.status(400).json({ 
        error: 'Комната с таким кодом уже существует',
        suggestedCode: generateRoomCode()
      });
    }
    
    // Создаем новую комнату
    rooms.set(roomCode, {
      code: roomCode,
      hostName: hostName || 'Ведущий',
      songs: [],
      playedNumbers: [],
      players: [],
      createdAt: Date.now(),
      lastActivity: Date.now()
    });
    
    console.log(`🎪 Комната создана: ${roomCode} (ведущий: ${hostName || 'Ведущий'})`);
    res.json({ 
      status: 'ok', 
      roomCode, 
      message: 'Комната успешно создана'
    });
    
  } catch (error) {
    console.error('Ошибка создания комнаты:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Присоединение к комнате
app.post('/api/rooms/:roomCode/join', (req, res) => {
  try {
    const { roomCode } = req.params;
    const { playerName } = req.body;
    
    if (!rooms.has(roomCode)) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }
    
    const room = rooms.get(roomCode);
    room.lastActivity = Date.now();
    
    // Добавляем игрока, если его еще нет
    const playerId = playerName || `Игрок${room.players.length + 1}`;
    if (!room.players.includes(playerId)) {
      room.players.push(playerId);
    }
    
    console.log(`👤 Игрок присоединился: ${playerId} -> ${roomCode}`);
    res.json({ 
      status: 'ok', 
      roomCode, 
      songsCount: room.songs.length,
      playedCount: room.playedNumbers.length,
      playersCount: room.players.length,
      message: 'Вы успешно присоединились к комнате'
    });
    
  } catch (error) {
    console.error('Ошибка присоединения к комнате:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Загрузка песен в комнату (только ведущий)
app.post('/api/rooms/:roomCode/songs', (req, res) => {
  try {
    const { roomCode } = req.params;
    
    if (!rooms.has(roomCode)) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }
    
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Ожидается массив строк' });
    }
    
    const room = rooms.get(roomCode);
    room.songs = req.body;
    room.lastActivity = Date.now();
    
    console.log(`🎵 В комнату ${roomCode} загружено ${room.songs.length} песен`);
    res.json({ 
      status: 'ok', 
      count: room.songs.length,
      message: 'Список песен обновлен'
    });
    
  } catch (error) {
    console.error('Ошибка загрузки песен:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение песен из комнаты
app.get('/api/rooms/:roomCode/songs', (req, res) => {
  try {
    const { roomCode } = req.params;
    
    if (!rooms.has(roomCode)) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }
    
    const room = rooms.get(roomCode);
    room.lastActivity = Date.now();
    
    res.json(room.songs);
    
  } catch (error) {
    console.error('Ошибка получения песен:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Обновление сыгранных номеров (только ведущий)
app.post('/api/rooms/:roomCode/played', (req, res) => {
  try {
    const { roomCode } = req.params;
    
    if (!rooms.has(roomCode)) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }
    
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Ожидается массив чисел' });
    }
    
    const room = rooms.get(roomCode);
    room.playedNumbers = req.body;
    room.lastActivity = Date.now();
    
    res.json({ 
      status: 'ok', 
      count: room.playedNumbers.length,
      message: 'Сыгранные номера обновлены'
    });
    
  } catch (error) {
    console.error('Ошибка обновления сыгранных номеров:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение сыгранных номеров
app.get('/api/rooms/:roomCode/played', (req, res) => {
  try {
    const { roomCode } = req.params;
    
    if (!rooms.has(roomCode)) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }
    
    const room = rooms.get(roomCode);
    room.lastActivity = Date.now();
    
    res.json(room.playedNumbers);
    
  } catch (error) {
    console.error('Ошибка получения сыгранных номеров:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение информации о комнате
app.get('/api/rooms/:roomCode/info', (req, res) => {
  try {
    const { roomCode } = req.params;
    
    if (!rooms.has(roomCode)) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }
    
    const room = rooms.get(roomCode);
    room.lastActivity = Date.now();
    
    res.json({
      code: room.code,
      hostName: room.hostName,
      songsCount: room.songs.length,
      playedCount: room.playedNumbers.length,
      playersCount: room.players.length,
      createdAt: room.createdAt,
      lastActivity: room.lastActivity
    });
    
  } catch (error) {
    console.error('Ошибка получения информации о комнате:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Удаление комнаты (ведущий)
app.delete('/api/rooms/:roomCode', (req, res) => {
  try {
    const { roomCode } = req.params;
    
    if (!rooms.has(roomCode)) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }
    
    rooms.delete(roomCode);
    console.log(`🗑️ Комната ${roomCode} удалена`);
    
    res.json({ 
      status: 'ok', 
      message: 'Комната удалена'
    });
    
  } catch (error) {
    console.error('Ошибка удаления комнаты:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Список активных комнат (для отладки)
app.get('/api/rooms', (req, res) => {
  try {
    const activeRooms = Array.from(rooms.values()).map(room => ({
      code: room.code,
      hostName: room.hostName,
      songsCount: room.songs.length,
      playersCount: room.players.length,
      createdAt: new Date(room.createdAt).toLocaleString('ru-RU'),
      lastActivity: new Date(room.lastActivity).toLocaleString('ru-RU')
    }));
    
    res.json(activeRooms);
    
  } catch (error) {
    console.error('Ошибка получения списка комнат:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Старые эндпоинты для обратной совместимости
app.post('/api/songs', (req, res) => {
  // Используем комнату по умолчанию 'DEFAULT'
  if (!rooms.has('DEFAULT')) {
    rooms.set('DEFAULT', {
      code: 'DEFAULT',
      songs: [],
      playedNumbers: [],
      players: [],
      createdAt: Date.now(),
      lastActivity: Date.now()
    });
  }
  
  const room = rooms.get('DEFAULT');
  room.songs = Array.isArray(req.body) ? req.body : [];
  room.lastActivity = Date.now();
  
  res.json({ status: 'ok', count: room.songs.length });
});

app.get('/api/songs', (req, res) => {
  const room = rooms.get('DEFAULT');
  res.json(room ? room.songs : []);
});

// Статус сервера
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    totalRooms: rooms.size,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Проверка сервера
app.get('/', (req, res) => {
  const roomCount = rooms.size;
  const lastCleanup = new Date().toLocaleString('ru-RU');
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>🎵 Musical Lotto Server</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .card { background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0; }
        .btn { display: inline-block; padding: 10px 20px; background: #ff4d6d; color: white; 
               text-decoration: none; border-radius: 5px; margin: 5px; }
      </style>
    </head>
    <body>
      <h1>🎵 Музыкальное Лото Сервер</h1>
      
      <div class="card">
        <h2>📊 Статус сервера</h2>
        <p><strong>Активных комнат:</strong> ${roomCount}</p>
        <p><strong>Последняя очистка:</strong> ${lastCleanup}</p>
        <p><strong>Время жизни комнат:</strong> 24 часа</p>
      </div>
      
      <div class="card">
        <h2>🛠 Администрирование</h2>
        <p>Пароль для админ-функций: <code>muzloto2024</code></p>
        
        <h3>API эндпоинты:</h3>
        <ul>
          <li><code>POST /api/rooms/create</code> - создать комнату</li>
          <li><code>POST /api/rooms/:code/join</code> - присоединиться</li>
          <li><code>POST /api/rooms/:code/songs</code> - загрузить песни</li>
          <li><code>GET /api/rooms/:code/songs</code> - получить песни</li>
          <li><code>POST /api/admin/clear-rooms</code> - очистить ВСЕ комнаты</li>
          <li><code>POST /api/admin/cleanup</code> - очистить старые комнаты</li>
          <li><code>GET /api/admin/rooms-info?password=...</code> - информация о комнатах</li>
        </ul>
        
        <a class="btn" href="/admin.html" target="_blank">📋 Панель администратора</a>
      </div>
      
      <div class="card">
        <h2>📖 Документация</h2>
        <p>Сервер работает на Node.js + Express</p>
        <p>Комнаты автоматически удаляются через 24 часа неактивности</p>
        <p>Для ручного управления используйте админ  функции</p>
      </div>
    </body>
    </html>
  `);
});

// Отдаем статические файлы
app.use(express.static('public'));

module.exports = app;
