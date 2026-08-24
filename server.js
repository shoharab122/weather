const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Local SQLite database
const db = new Database('./weather.db');
console.log('✅ Connected to SQLite');

db.exec(`
  CREATE TABLE IF NOT EXISTS weather_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    temperature REAL NOT NULL,
    humidity REAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// Receive data from ESP32
app.post('/api/weather', (req, res) => {
  const { temperature, humidity } = req.body;

  console.log(`📊 Received: ${temperature}°C, ${humidity}%`);

  try {
    db.prepare(
      'INSERT INTO weather_data (temperature, humidity) VALUES (?, ?)'
    ).run(temperature, humidity);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get latest data
app.get('/api/weather/latest', (req, res) => {
  try {
    const row = db.prepare(
      'SELECT * FROM weather_data ORDER BY created_at DESC LIMIT 1'
    ).get();
    if (row) {
      res.json(row);
    } else {
      res.json({ temperature: 0, humidity: 0, created_at: new Date() });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get stats
app.get('/api/weather/stats', (req, res) => {
  try {
    const row = db.prepare(`
      SELECT 
        COUNT(*) as count,
        AVG(temperature) as avg_temp,
        MAX(temperature) as max_temp,
        MIN(temperature) as min_temp,
        AVG(humidity) as avg_humidity
      FROM weather_data
    `).get();
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🌤️  WEATHER STATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📱 Website: http://localhost:${PORT}`);
  console.log(`📍 Local Network: http://192.168.x.x:${PORT}`);
  console.log(`📡 Database: ./weather.db (SQLite)\n`);
});
