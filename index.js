[file name]: index.js
[file content begin]
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
  for (const [code, room] of rooms.entries()) {
    if (now - room.lastActivity > ROOM_EXPIRY_MS) {
      rooms.delete(code);
      console.log(`Комната ${code} удалена по истечении времени`);
    }
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
    
    console.log(`Комната создана: ${roomCode}`);
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
    
    console.log(`В комнату ${roomCode} загружено ${room.songs.length} песен`);
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
    console.log(`Комната ${roomCode} удалена`);
    
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
      createdAt: new Date(room.createdAt).toLocaleString(),
      lastActivity: new Date(room.lastActivity).toLocaleString()
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

// Проверка сервера
app.get('/', (req, res) => {
  res.send(`
    <h1>🎵 Musical Lotto Server с поддержкой комнат</h1>
    <p>Активных комнат: ${rooms.size}</p>
    <p>Для работы с комнатами используйте:</p>
    <ul>
      <li>POST /api/rooms/create - создать комнату</li>
      <li>POST /api/rooms/:code/join - присоединиться</li>
      <li>POST /api/rooms/:code/songs - загрузить песни</li>
      <li>GET /api/rooms/:code/songs - получить песни</li>
      <li>POST /api/rooms/:code/played - обновить сыгранные</li>
      <li>GET /api/rooms/:code/played - получить сыгранные</li>
    </ul>
  `);
});

module.exports = app;
[file content end]
