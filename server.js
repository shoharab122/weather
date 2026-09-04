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

// ---- Real-time push (Server-Sent Events) ----
// Every browser tab that opens the dashboard registers a connection here.
// Whenever a new ESP32 reading comes in, we push it to all open tabs instantly,
// instead of making the browser wait for its next poll.
let sseClients = [];

app.get('/api/weather/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.flushHeaders();
  res.write(': connected\n\n');

  sseClients.push(res);

  req.on('close', () => {
    sseClients = sseClients.filter((client) => client !== res);
  });
});

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => client.write(payload));
}

// Send a heartbeat every 20s so proxies/browsers don't silently drop idle SSE connections
setInterval(() => {
  sseClients.forEach((client) => client.write(': ping\n\n'));
}, 20000);

// Receive data from ESP32
app.post('/api/weather', (req, res) => {
  const { temperature, humidity } = req.body;

  console.log(`📊 Received: ${temperature}°C, ${humidity}%`);

  db.run(
    'INSERT INTO weather_data (temperature, humidity) VALUES (?, ?)',
    [temperature, humidity],
    function (err) {
      if (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
      } else {
        res.json({ success: true });
        // Push the fresh reading to every connected dashboard immediately
        broadcast('reading', {
          id: this.lastID,
          temperature,
          humidity,
          created_at: new Date().toISOString()
        });
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
      AVG(humidity) as avg_humidity,
      MAX(humidity) as max_humidity,
      MIN(humidity) as min_humidity
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

// Get recent history for charting (default last 50 readings, newest last)
app.get('/api/weather/history', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 500);

  db.all(
    `SELECT temperature, humidity, created_at
     FROM weather_data
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json(rows.reverse()); // oldest -> newest for chart plotting
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
  console.log(`📡 Database: ./weather.db (SQLite)`);
  console.log(`⚡ Real-time stream: /api/weather/stream\n`);
});
