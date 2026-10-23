// The public "Live Hub" WebSocket: anyone may connect (no login), the server only pushes events to everyone
// (CONTEST_CREATED, BID_PLACED, ...). Routes reach it through app.get('broadcast'). The authenticated game
// plaza (/ws/game) is a separate server, see src/services/gamePlazaSocket.js.
const WebSocket = require('ws');

function createLiveHub() {
  const wss = new WebSocket.Server({ noServer: true });

  /** Sends `data` (JSON-encoded once) to every open connection. */
  const broadcast = (data) => {
    const payload = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  };

  wss.on('connection', (ws) => {
    console.log('Client connected to Live Hub.');
    ws.send(JSON.stringify({ type: 'WELCOME', message: 'Connected to Live Hub' }));
  });

  /** Upgrade handler for any path that isn't another socket's. */
  const handleUpgrade = (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  };

  return { wss, broadcast, handleUpgrade };
}

module.exports = { createLiveHub };
