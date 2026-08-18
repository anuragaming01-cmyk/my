const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// সেন্ট্রাল স্টেট
let monitorState = {
  url: null,
  status: 'Idle',
  lastChecked: null,
  lastLatency: 0,
  totalPings: 0,
  logs: [],
  history: [] // Chart data latency history
};

let pingInterval = null;

// ওয়েবসাইট ব্যাকএন্ডে ২৪/৭ অবজার্ভ করার জন্য হাই-স্পীড HTTP পিনগিং ফাংশন
function startObserving(targetUrl) {
  if (pingInterval) clearInterval(pingInterval);

  monitorState.url = targetUrl;
  monitorState.status = 'Connecting...';
  monitorState.totalPings = 0;
  monitorState.history = [];
  addLog(`[${new Date().toLocaleTimeString()}] Target set: ${targetUrl}`);

  // প্রতি ৫ সেকেন্ড পর পর ওয়েবসাইট অবজার্ভ করা হবে
  pingInterval = setInterval(async () => {
    const startTime = Date.now();
    try {
      const response = await axios.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) UptimePulseObserver/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml'
        },
        timeout: 8000
      });

      const latency = Date.now() - startTime;
      monitorState.lastLatency = latency;
      monitorState.totalPings++;
      monitorState.lastChecked = new Date().toLocaleTimeString();
      monitorState.status = 'ONLINE 🟢';

      addLog(`[${monitorState.lastChecked}] HTTP ${response.status} OK - Latency: ${latency}ms`);
      addHistory(monitorState.lastChecked, latency);

    } catch (error) {
      const latency = Date.now() - startTime;
      monitorState.lastLatency = latency;
      monitorState.totalPings++;
      monitorState.lastChecked = new Date().toLocaleTimeString();
      monitorState.status = `DOWN / ISSUES 🔴`;

      const errorMsg = error.response ? `HTTP ${error.response.status}` : error.message;
      addLog(`[${monitorState.lastChecked}] ERROR: ${errorMsg}`);
      addHistory(monitorState.lastChecked, 0);
    }
  }, 5000); // 5 Seconds Interval for stable 24/7 observing
}

function addLog(msg) {
  monitorState.logs.unshift(msg);
  if (monitorState.logs.length > 30) monitorState.logs.pop();
}

function addHistory(time, latency) {
  monitorState.history.push({ time, latency });
  if (monitorState.history.length > 15) monitorState.history.shift();
}

// API Routes
app.post('/api/start', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  let formattedUrl = url;
  if (!/^https?:\/\//i.test(url)) {
    formattedUrl = 'https://' + url;
  }

  startObserving(formattedUrl);
  res.json({ message: '24/7 Monitoring Engine Started!' });
});

app.post('/api/stop', (req, res) => {
  if (pingInterval) clearInterval(pingInterval);
  monitorState.status = 'Stopped';
  addLog(`[${new Date().toLocaleTimeString()}] Monitoring stopped by user.`);
  res.json({ message: 'Monitoring stopped successfully.' });
});

app.get('/api/status', (req, res) => {
  res.json(monitorState);
});

// HTML Dashboard Route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
