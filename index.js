const express = require('express');
const app = express();

app.use(express.json());

let songs = [];

// Ведущий загружает список
app.post('/api/songs', (req, res) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Ожидается массив строк' });
  }
  songs = req.body;
  res.json({ status: 'ok', count: songs.length });
});

// Игроки получают список
app.get('/api/songs', (req, res) => {
  res.json(songs);
});

// Проверка
app.get('/', (req, res) => {
  res.send('Musical Lotto Server работает!');
});

module.exports = app;
