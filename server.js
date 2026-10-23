// Entry point: checks the environment, builds the app (src/app.js), opens the HTTP server with its two
// WebSockets (the public Live Hub and the authenticated game plaza on /ws/game) and starts the background jobs.

// Must be set before anything else is required: it's how src/db/index.js tells
// the running application server apart from a migration/seed script required
// directly (which it refuses to let connect — see that file). This is the
// application declaring itself, not something derived from how the process was
// launched, so it holds regardless of Render's start command, nodemon, or a
// plain `node server.js`.
process.env.APP_SERVER_BOOT = '1';

require('dotenv').config();
// No JWT secret, no server: there is no safe default to fall back on (see src/config/jwtSecret.js).
require('./src/config/jwtSecret').assertJwtSecret();
const http = require('http');
const { createApp, IS_PRODUCTION } = require('./src/app');
const { createLiveHub } = require('./src/realtime/liveHub');
const { verifyToken } = require('./src/utils/authToken');
const { startJobs } = require('./src/jobs/scheduler');
const { JOBS } = require('./src/jobs');

const liveHub = createLiveHub();

// Typed messages in the plaza, checked before anyone sees them; off until an admin switches them on. One repository
// and one moderator shared by the plaza and the admin page (/api/admin/game-chat), so a change applies at once.
const gameChatRepo = require('./src/repositories/gameChatRepository').gameChatRepository();
const gameChatModerator = require('./src/services/chatModeration').createChatModerator({ repo: gameChatRepo });

// Plaza of "CardBrix the game" (/ws/game): unlike the public Live Hub, every connection must identify
// itself with the site's JWT, and players only ever see each other's username and character.
const plaza = require('./src/services/gamePlazaSocket').createPlaza({
  verifyToken,
  loadUser: async (userId) => {
    const { rows } = await require('./src/db').query(
      'SELECT id, username, avatar_config, is_active FROM users WHERE id = $1',
      [userId]
    );
    return rows[0] || null;
  },
  moderator: gameChatModerator,
});

const app = createApp({
  broadcast: liveHub.broadcast,
  wss: liveHub.wss,
  gameChatRepo,
  gameChatModerator,
  onGameChatSettingsChanged: () => plaza.refreshChat(),
});

const server = http.createServer(app);

server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  if (pathname === '/ws/game') {
    plaza.handleUpgrade(request, socket, head);
    return;
  }
  liveHub.handleUpgrade(request, socket, head);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Backend live on port ${PORT}`);
  console.log(`CSP: ${IS_PRODUCTION ? 'strict (no unsafe-inline/unsafe-eval)' : 'permissive (dev)'}`);
});

// Analytics snapshots, featured expiry, credit maturation, delivery auto-confirm: see src/jobs/index.js.
startJobs(JOBS);
