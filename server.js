const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Local SQLite database
const db = new sqlite3.Database('./weather.db', (err) => {
  if (err) {
    console.error('Database error:', err);
  } else {
    console.log('✅ Connected to SQLite');
    
    db.run(`
      CREATE TABLE IF NOT EXISTS weather_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        temperature REAL NOT NULL,
        humidity REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
});

// Receive data from ESP32
app.post('/api/weather', (req, res) => {
  const { temperature, humidity } = req.body;
  
  console.log(`📊 Received: ${temperature}°C, ${humidity}%`);
  
  db.run(
    'INSERT INTO weather_data (temperature, humidity) VALUES (?, ?)',
    [temperature, humidity],
    function(err) {
      if (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
      } else {
        res.json({ success: true });
      }
    }
  );
});

// Get latest data
app.get('/api/weather/latest', (req, res) => {
  db.get(
    'SELECT * FROM weather_data ORDER BY created_at DESC LIMIT 1',
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (row) {
        res.json(row);
      } else {
        res.json({ temperature: 0, humidity: 0, created_at: new Date() });
      }
    }
  );
});

// Get stats
app.get('/api/weather/stats', (req, res) => {
  db.get(
    `SELECT 
      COUNT(*) as count,
      AVG(temperature) as avg_temp,
      MAX(temperature) as max_temp,
      MIN(temperature) as min_temp,
      AVG(humidity) as avg_humidity
     FROM weather_data`,
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json(row);
      }
    }
  );
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🌤️  WEATHER STATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📱 Website: http://localhost:${PORT}`);
  console.log(`📍 Local Network: http://192.168.x.x:${PORT}`);
  console.log(`📡 Database: ./weather.db (SQLite)\n`);
});
