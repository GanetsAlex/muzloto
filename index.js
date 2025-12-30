
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
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

// ============================
// СТАТИЧЕСКИЕ ФАЙЛЫ
// ============================

// Проверяем существование файла
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (err) {
    return false;
  }
}

// Главная страница
app.get('/', (req, res) => {
  const roomCount = rooms.size;
  const lastCleanup = new Date().toLocaleString('ru-RU');
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>🎵 Musical Lotto Server</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; }
        .card { background: white; padding: 25px; border-radius: 15px; margin: 20px 0; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
        .btn { display: inline-block; padding: 12px 25px; background: #ff4d6d; color: white; 
               text-decoration: none; border-radius: 8px; margin: 5px; transition: all 0.3s; }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(255,77,109,0.3); }
        .btn-secondary { background: #666; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
        .stat { text-align: center; padding: 15px; background: #f9f9f9; border-radius: 10px; }
        .stat-value { font-size: 28px; font-weight: bold; color: #ff4d6d; }
        .stat-label { font-size: 14px; color: #666; margin-top: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <h1 style="color: #ff4d6d;">🎵 Музыкальное Лото Сервер</h1>
          <p>Сервер успешно работает! Используйте клиентское приложение для игры.</p>
          
          <div class="stats">
            <div class="stat">
              <div class="stat-value">${roomCount}</div>
              <div class="stat-label">Активных комнат</div>
            </div>
            <div class="stat">
              <div class="stat-value">24ч</div>
              <div class="stat-label">Время жизни комнат</div>
            </div>
            <div class="stat">
              <div class="stat-value">${Math.round(process.uptime()/3600)}ч</div>
              <div class="stat-label">Аптайм сервера</div>
            </div>
          </div>
        </div>
        
        <div class="card">
          <h2>🔗 Быстрые ссылки</h2>
          <div style="display: flex; flex-wrap: wrap; gap: 10px; margin: 15px 0;">
            <a href="/admin.html" class="btn">🛠 Панель администратора</a>
            <a href="/api/rooms" class="btn btn-secondary">📋 Список комнат (JSON)</a>
            <a href="/api/status" class="btn btn-secondary">📊 Статус сервера</a>
          </div>
          <p style="font-size: 14px; color: #666; margin-top: 15px;">
            Пароль для админ-панели: <code>muzloto2024</code>
          </p>
        </div>
        
        <div class="card">
          <h2>📖 API эндпоинты</h2>
          <ul style="line-height: 1.8;">
            <li><code>POST /api/rooms/create</code> - создать комнату</li>
            <li><code>POST /api/rooms/:code/join</code> - присоединиться к комнате</li>
            <li><code>POST /api/rooms/:code/songs</code> - загрузить песни</li>
            <li><code>GET /api/rooms/:code/songs</code> - получить песни</li>
            <li><code>POST /api/admin/clear-rooms</code> - очистить ВСЕ комнаты</li>
            <li><code>POST /api/admin/cleanup</code> - очистить старые комнаты</li>
          </ul>
        </div>
        
        <div class="card">
          <h2>⚙️ Информация о сервере</h2>
          <p><strong>Последняя очистка:</strong> ${lastCleanup}</p>
          <p><strong>Память:</strong> ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB</p>
          <p><strong>Время запуска:</strong> ${new Date(Date.now() - process.uptime() * 1000).toLocaleString('ru-RU')}</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Админ панель
app.get('/admin.html', (req, res) => {
  const adminHtml = `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Админ-панель МузЛото</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            min-height: 100vh;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .login-container {
            background: white;
            border-radius: 15px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
            max-width: 400px;
            width: 100%;
            text-align: center;
        }
        .admin-container { display: none; max-width: 1200px; margin: 0 auto; width: 100%; }
        .header {
            background: white;
            padding: 30px;
            border-radius: 15px;
            margin-bottom: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            text-align: center;
        }
        .header h1 { color: #ff4d6d; margin-bottom: 10px; font-size: 2.5em; }
        .input-group { margin-bottom: 25px; }
        .input-group label { display: block; margin-bottom: 10px; font-weight: 600; color: #555; text-align: left; }
        .input-group input {
            width: 100%; padding: 15px; border: 2px solid #e0e0e0; border-radius: 10px;
            font-size: 16px; transition: border-color 0.3s ease;
        }
        .input-group input:focus { outline: none; border-color: #ff4d6d; }
        .btn {
            display: inline-block; padding: 15px 30px; background: linear-gradient(90deg, #ff4d6d, #ff7b9d);
            color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: 600;
            cursor: pointer; margin: 10px 5px; transition: all 0.3s ease; text-align: center; width: 100%;
        }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(255, 77, 109, 0.3); }
        .btn-danger { background: linear-gradient(90deg, #f44336, #ff7961); }
        .btn-warning { background: linear-gradient(90deg, #ff9800, #ffb74d); }
        .btn-info { background: linear-gradient(90deg, #2196f3, #64b5f6); }
        .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .card { background: white; border-radius: 15px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .card h2 { color: #333; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #f0f0f0; font-size: 1.5em; }
        .alert { padding: 15px; border-radius: 10px; margin: 15px 0; text-align: center; font-weight: 600; }
        .alert-danger { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .results { background: white; border-radius: 15px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); margin-top: 20px; }
        .loading { text-align: center; padding: 40px; color: #666; }
        .loading::after {
            content: ''; display: inline-block; width: 30px; height: 30px;
            border: 3px solid #f0f0f0; border-top-color: #ff4d6d; border-radius: 50%;
            animation: spin 1s linear infinite; margin-left: 10px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .back-btn {
            position: absolute; left: 20px; top: 20px; background: rgba(255, 255, 255, 0.9);
            border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 20px;
            cursor: pointer; box-shadow: 0 4px 8px rgba(0,0,0,0.15);
            display: flex; align-items: center; justify-content: center;
        }
    </style>
</head>
<body>
    <div id="loginScreen" class="login-container">
        <h1>🔐 Вход в админ-панель</h1>
        <p style="color: #666; margin-bottom: 30px;">Введите пароль администратора</p>
        <div class="input-group">
            <label for="adminPassword">Пароль администратора</label>
            <input type="password" id="adminPassword" placeholder="Введите пароль" autocomplete="off" value="muzloto2024">
        </div>
        <div id="passwordError" class="alert alert-danger" style="display: none;">Неверный пароль</div>
        <button class="btn" onclick="checkPassword()">🔓 Войти</button>
        <div style="margin-top: 20px; font-size: 14px; color: #888;">
            <p>По умолчанию пароль: <code>muzloto2024</code></p>
            <p>Смените пароль в файле <code>index.js</code> на сервере</p>
        </div>
    </div>
    
    <div id="adminPanel" class="admin-container" style="display: none;">
        <button class="back-btn" onclick="logout()">←</button>
        <div class="header">
            <h1>🛠 Админ-панель МузЛото</h1>
            <p>Управление сервером и комнатами игры</p>
            <p style="margin-top: 10px; font-size: 14px; color: #888;">
                Сервер: <span id="serverUrl">https://muzloto.vercel.app</span>
                | Авторизован как: <span id="userInfo">Администратор</span>
            </p>
        </div>
        <div class="cards">
            <div class="card">
                <h2>🧹 Очистка комнат</h2>
                <p style="margin-bottom: 20px; color: #666;">Управление комнатами на сервере</p>
                <button class="btn btn-danger" onclick="clearAllRooms()">🗑️ Очистить ВСЕ комнаты</button>
                <button class="btn btn-warning" onclick="cleanupOldRooms()">🧹 Очистить старые комнаты (24ч+)</button>
                <div style="margin-top: 20px; padding: 15px; background: #fff8e1; border-radius: 10px;">
                    <strong>⚠️ Внимание:</strong> Очистка всех комнат удалит ВСЕ активные игры!
                </div>
            </div>
            <div class="card">
                <h2>📊 Информация о сервере</h2>
                <div id="serverInfo" class="loading">Загрузка информации о сервере...</div>
                <button class="btn btn-info" onclick="getServerStatus()">🔄 Обновить статус</button>
                <button class="btn btn-info" onclick="getAllRooms()">📋 Список всех комнат</button>
            </div>
            <div class="card">
                <h2>⚙️ Настройки</h2>
                <div class="input-group">
                    <label for="serverUrlInput">URL сервера</label>
                    <input type="text" id="serverUrlInput" value="https://muzloto.vercel.app">
                </div>
                <button class="btn" onclick="updateServerUrl()">💾 Обновить URL</button>
                <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #eee;">
                    <h3>Диагностика</h3>
                    <div style="display: flex; gap: 10px; margin-top: 10px;">
                        <button class="btn" style="padding: 10px; font-size: 14px; flex: 1;" onclick="testConnection()">📡 Проверить связь</button>
                        <button class="btn" style="padding: 10px; font-size: 14px; flex: 1;" onclick="pingServer()">🏓 Ping</button>
                    </div>
                </div>
            </div>
        </div>
        <div id="results" class="results" style="display: none;"><h2>📋 Результаты операций</h2><div id="resultsContent"></div></div>
        <div id="roomsList" class="results" style="display: none;"><h2>🎪 Активные комнаты</h2><div id="roomsContent"></div></div>
    </div>

    <script>
        const DEFAULT_SERVER_URL = window.location.origin;
        const ADMIN_PASSWORD = "muzloto2024";
        let currentServerUrl = localStorage.getItem('muzloto_admin_url') || DEFAULT_SERVER_URL;
        let isAuthenticated = false;
        
        document.addEventListener('DOMContentLoaded', () => {
            const savedSession = localStorage.getItem('muzloto_admin_session');
            if (savedSession && savedSession === 'authenticated') {
                isAuthenticated = true;
                showAdminPanel();
            } else {
                showLoginScreen();
            }
        });
        
        function showLoginScreen() {
            document.getElementById('loginScreen').style.display = 'block';
            document.getElementById('adminPanel').style.display = 'none';
            document.getElementById('adminPassword').focus();
        }
        
        function showAdminPanel() {
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('adminPanel').style.display = 'block';
            document.getElementById('serverUrl').textContent = currentServerUrl;
            document.getElementById('serverUrlInput').value = currentServerUrl;
            getServerStatus();
        }
        
        function checkPassword() {
            const passwordInput = document.getElementById('adminPassword');
            const password = passwordInput.value.trim();
            if (password === ADMIN_PASSWORD) {
                isAuthenticated = true;
                localStorage.setItem('muzloto_admin_session', 'authenticated');
                showAdminPanel();
            } else {
                document.getElementById('passwordError').style.display = 'block';
                passwordInput.value = '';
                passwordInput.focus();
                if (navigator.vibrate) navigator.vibrate(200);
            }
        }
        
        function logout() {
            isAuthenticated = false;
            localStorage.removeItem('muzloto_admin_session');
            showLoginScreen();
        }
        
        function updateServerUrl() {
            const newUrl = document.getElementById('serverUrlInput').value.trim();
            if (!newUrl) { showAlert('Введите URL сервера', 'danger'); return; }
            currentServerUrl = newUrl;
            localStorage.setItem('muzloto_admin_url', newUrl);
            document.getElementById('serverUrl').textContent = newUrl;
            showAlert('URL сервера обновлен', 'success');
            getServerStatus();
        }
        
        async function clearAllRooms() {
            if (!isAuthenticated) { showAlert('Требуется авторизация', 'danger'); return; }
            if (!confirm('❌ ВНИМАНИЕ!\\n\\nВы собираетесь удалить ВСЕ комнаты на сервере.\\nВсе активные игры будут прекращены.\\n\\nВы уверены?')) return;
            showLoading('Очистка всех комнат...');
            try {
                const response = await fetch(currentServerUrl + '/api/admin/clear-rooms', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: ADMIN_PASSWORD })
                });
                const result = await response.json();
                if (response.ok) {
                    showResults('Очистка завершена', '<div class="alert alert-success">✅ ' + result.message + '</div><div style="color: #888; margin-top: 10px; font-size: 14px;">Время операции: ' + new Date().toLocaleString('ru-RU') + '</div>');
                    getServerStatus(); getAllRooms();
                } else { showAlert(result.error || 'Ошибка очистки', 'danger'); }
            } catch (error) { showAlert('Ошибка соединения с сервером: ' + error.message, 'danger'); }
        }
        
        async function cleanupOldRooms() {
            if (!isAuthenticated) { showAlert('Требуется авторизация', 'danger'); return; }
            if (!confirm('Очистить комнаты, которые неактивны более 24 часов?')) return;
            showLoading('Очистка старых комнат...');
            try {
                const response = await fetch(currentServerUrl + '/api/admin/cleanup', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: ADMIN_PASSWORD })
                });
                const result = await response.json();
                if (response.ok) {
                    let content = '<div class="alert alert-success">✅ Удалено комнат: ' + result.deletedCount + '</div><div class="alert alert-info">📊 Осталось комнат: ' + result.remainingCount + '</div>';
                    if (result.deletedRooms && result.deletedRooms.length > 0) {
                        content += '<h3>Удаленные комнаты:</h3>' + result.deletedRooms.map(room => '<div style="background: #f5f5f5; padding: 10px; border-radius: 8px; margin: 5px 0;"><strong>' + room.code + '</strong> - ' + room.hostName + ' (возраст: ' + room.ageHours + ' ч.)</div>').join('');
                    }
                    content += '<div style="color: #888; margin-top: 10px; font-size: 14px;">Время операции: ' + new Date().toLocaleString('ru-RU') + '</div>';
                    showResults('Очистка старых комнат', content);
                    getServerStatus(); getAllRooms();
                } else { showAlert(result.error || 'Ошибка очистки', 'danger'); }
            } catch (error) { showAlert('Ошибка соединения с сервере: ' + error.message, 'danger'); }
        }
        
        async function getAllRooms() {
            if (!isAuthenticated) { showAlert('Требуется авторизация', 'danger'); return; }
            showLoading('Загрузка списка комнат...');
            try {
                const response = await fetch(currentServerUrl + '/api/admin/rooms-info?password=' + encodeURIComponent(ADMIN_PASSWORD));
                const result = await response.json();
                if (response.ok) {
                    document.getElementById('roomsList').style.display = 'block';
                    let content = '<div class="alert alert-info">Всего комнат: ' + result.totalRooms + '</div>';
                    if (result.rooms.length > 0) {
                        content += result.rooms.map(room => '<div style="background: #f9f9f9; border-radius: 10px; padding: 15px; margin: 10px 0; border-left: 4px solid #ff4d6d;"><div style="display: flex; justify-content: space-between; align-items: center;"><span style="font-family: monospace; font-size: 20px; font-weight: bold; color: #ff4d6d;">' + room.code + '</span><span style="font-size: 14px; color: #666;">Неактивна: ' + room.ageMinutes + ' мин.</span></div><p style="margin: 10px 0;"><strong>👑 Ведущий:</strong> ' + room.hostName + '</p><div style="display: flex; gap: 15px; margin: 10px 0;"><span style="background: white; padding: 5px 10px; border-radius: 5px;">🎵 ' + room.songsCount + ' песен</span><span style="background: white; padding: 5px 10px; border-radius: 5px;">👥 ' + room.playersCount + ' игроков</span><span style="background: white; padding: 5px 10px; border-radius: 5px;">🎯 ' + room.playedCount + ' сыграно</span></div><div style="font-size: 12px; color: #888;"><div>Создана: ' + room.createdAt + '</div><div>Активна: ' + room.lastActivity + '</div></div></div>').join('');
                    } else { content += '<div class="alert alert-info">🎉 Нет активных комнат</div>'; }
                    document.getElementById('roomsContent').innerHTML = content;
                } else { showAlert(result.error || 'Ошибка получения списка комнат', 'danger'); }
            } catch (error) { showAlert('Ошибка соединения с сервером: ' + error.message, 'danger'); }
        }
        
        async function getServerStatus() {
            if (!isAuthenticated) return;
            const serverInfoEl = document.getElementById('serverInfo');
            serverInfoEl.innerHTML = '<div class="loading">Загрузка...</div>';
            try {
                const response = await fetch(currentServerUrl + '/api/status');
                if (response.ok) {
                    const status = await response.json();
                    const uptimeHours = Math.floor(status.uptime / 3600);
                    const uptimeMinutes = Math.floor((status.uptime % 3600) / 60);
                    const memoryMB = Math.round(status.memory.heapUsed / 1024 / 1024);
                    serverInfoEl.innerHTML = '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;"><div style="background: #f0f7ff; padding: 15px; border-radius: 10px;"><strong>🎪 Комнат:</strong><div style="font-size: 28px; font-weight: bold; color: #ff4d6d;">' + (status.totalRooms || 0) + '</div></div><div style="background: #f0fff4; padding: 15px; border-radius: 10px;"><strong>⏱️ Аптайм:</strong><div style="font-size: 16px; font-weight: bold; color: #4caf50;">' + uptimeHours + 'ч ' + uptimeMinutes + 'м</div></div><div style="background: #fff4f0; padding: 15px; border-radius: 10px;"><strong>💾 Память:</strong><div style="font-size: 16px; font-weight: bold; color: #ff9800;">' + memoryMB + ' MB</div></div><div style="background: #f5f0ff; padding: 15px; border-radius: 10px;"><strong>🕐 Время:</strong><div style="font-size: 14px; color: #9c27b0;">' + new Date(status.timestamp).toLocaleString('ru-RU') + '</div></div></div>';
                } else { serverInfoEl.innerHTML = '<div class="alert alert-danger">Ошибка получения статуса</div>'; }
            } catch (error) { serverInfoEl.innerHTML = '<div class="alert alert-danger">Сервер не отвечает</div>'; }
        }
        
        async function testConnection() {
            if (!isAuthenticated) return;
            try {
                const response = await fetch(currentServerUrl);
                if (response.ok) { showAlert('✅ Связь с сервером установлена', 'success'); }
                else { showAlert('⚠️ Сервер отвечает с ошибкой', 'warning'); }
            } catch (error) { showAlert('❌ Нет связи с сервером', 'danger'); }
        }
        
        async function pingServer() {
            if (!isAuthenticated) return;
            const start = Date.now();
            try {
                const response = await fetch(currentServerUrl + '/api/status');
                const end = Date.now();
                const ping = end - start;
                showAlert('🏓 Ping: ' + ping + 'ms', 'success');
            } catch (error) { showAlert('❌ Сервер не отвечает', 'danger'); }
        }
        
        function showResults(title, content) {
            document.getElementById('results').style.display = 'block';
            document.getElementById('resultsContent').innerHTML = '<h3>' + title + '</h3>' + content;
            document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
        }
        
        function showLoading(message) {
            showResults('Выполнение операции', '<div class="loading">' + message + '</div>');
        }
        
        function showAlert(message, type) {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-' + type;
            alertDiv.textContent = message;
            alertDiv.style.margin = '10px 0';
            const container = document.querySelector('.admin-container .header');
            container.parentNode.insertBefore(alertDiv, container.nextSibling);
            setTimeout(() => { alertDiv.remove(); }, 5000);
        }
    </script>
</body>
</html>
  `;
  
  res.send(adminHtml);
});

// Статические файлы
app.use(express.static('.'));

// 404 обработчик
app.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>404 - Страница не найдена</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        h1 { color: #ff4d6d; }
        a { color: #2196f3; text-decoration: none; }
      </style>
    </head>
    <body>
      <h1>404 - Страница не найдена</h1>
      <p>Запрошенная страница не существует.</p>
      <p><a href="/">Вернуться на главную</a> | <a href="/admin.html">Админ-панель</a></p>
    </body>
    </html>
  `);
});

module.exports = app;
