import 'dotenv/config';
import app from './app.js';
import { db, pool } from './db.js';
import { startBotProcess } from './bot-runner.js';

const port = process.env.PORT ?? 8080;
const host = process.env.HOST ?? '127.0.0.1';

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const NOTIF_MAX_AGE_MS   = 30 * 24 * 60 * 60 * 1000;
async function cleanupSessions() {
  try { await db.deleteExpiredSessions(SESSION_MAX_AGE_MS); }
  catch (e) { console.warn('Session cleanup error:', e.message); }
  try { await db.deleteOldNotifications(NOTIF_MAX_AGE_MS); }
  catch (e) { console.warn('Notification cleanup error:', e.message); }
}

const server = app.listen(port, host, async () => {
  console.log(`Server: http://${host}:${port}`);

  cleanupSessions();
  setInterval(cleanupSessions, 60 * 60 * 1000);

  try {
    const bots = await db.getAutostartBots();
    for (const bot of bots) {
      startBotProcess(bot.id, bot.bot_token_enc, 'auto-start');
    }
    if (bots.length) console.log(`Auto-started ${bots.length} bot(s)`);
    else console.log('Nincs auto-indítandó bot');
  } catch (e) {
    console.warn('Auto-start error:', e.message);
  }

  try {
    const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM vh_users');
    const userCount = rows[0]?.cnt ?? 0;
    if (userCount > 0) await db.setStatIfLower('total_registered', userCount);
  } catch (e) {
    console.warn('Stat seed error:', e.message);
  }
});

server.headersTimeout = 15_000;
server.requestTimeout = 30_000;

process.on('unhandledRejection', (err) => {
  console.error('unhandledRejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
});
