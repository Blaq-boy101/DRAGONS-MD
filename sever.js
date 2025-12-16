) server.js
- Express + Socket.io server
- Create whatsapp-web.js Client, convert QR string to dataURL with qrcode, emit to clients
- Save session to disk (SESSION_FILE_PATH) and load if present

server.js (shortened explanation — paste into file):
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js'); // uses LocalAuth to store session
const qrcode = require('qrcode');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static web UI
app.use(express.static(path.join(__dirname, 'public')));

// Use LocalAuth so session files are stored in ./session (no manual JSON handling)
const client = new Client({
  puppeteer: { headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] },
  authStrategy: new LocalAuth({ clientId: 'dragons-md' })
});

client.on('qr', async (qr) => {
  // generate data URL and emit
  const dataUrl = await qrcode.toDataURL(qr);
  io.emit('qr', dataUrl);
  io.emit('message', 'QR received, scan with WhatsApp');
});

client.on('ready', () => {
  io.emit('ready', true);
  io.emit('message', 'WhatsApp is ready');
  console.log('Client is ready');
});

client.on('authenticated', () => {
  io.emit('message', 'Authenticated — session saved');
});

client.on('auth_failure', msg => {
  io.emit('message', 'Authentication failure: ' + msg);
});

client.on('disconnected', (reason) => {
  io.emit('message', 'Disconnected: ' + reason);
  // optionally destroy session to force re-QR on next start:
  // client.destroy();
});

client.initialize();

io.on('connection', (socket) => {
  console.log('socket connected:', socket.id);
  socket.on('request-qr', () => {
    // nothing special needed — QR will be emitted on 'qr' event
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

Notes: This uses LocalAuth that stores session files under node_modules/.cache/ or a session directory beside the repo — you can set LocalAuth options to control the path.

3) public/index.html
- Minimal UI that connects to socket.io, shows QR image, shows status messages, and a button to request refreshed QR.

Example public/index.html (paste into public/index.html):
<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Pair DRAGONS-MD</title></head>
  <body>
    <h2>Pair DRAGONS-MD WhatsApp</h2>
    <div id="status">Connecting...</div>
    <img id="qr" style="max-width:300px; display:none" />
    <script src="/socket.io/socket.io.js"></script>
    <script>
      const socket = io();
      const status = document.getElementById('status');
      const qrImg = document.getElementById('qr');

      socket.on('connect', () => status.textContent = 'Connected to server');
      socket.on('message', txt => status.textContent = txt);
      socket.on('qr', dataUrl => {
        qrImg.src = dataUrl;
        qrImg.style.display = 'block';
        status.textContent = 'Scan the QR with WhatsApp on your phone';
      });
      socket.on('ready', () => {
        status.textContent = 'Bot is ready — paired';
        qrImg.style.display = 'none';
      });
    </script>
  </body>
</html>

4) .env (optional)
- PORT=3000
- Any other config you want

Run locally:
- npm install
- node server.js
- open http://localhost:3000 to view the pairing page
