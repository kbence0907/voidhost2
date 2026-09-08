import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { decryptToken } from './crypto.js';
import { db } from './db.js';
import { notifyBotParties } from './notify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROCESS_SCRIPT = path.join(__dirname, 'bot-process.js');
const MAX_LOGS = 300;

const procs = new Map();

let shuttingDown = false;
function markShuttingDown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const entry of procs.values()) {
    try { entry.proc?.kill('SIGKILL'); } catch {}
  }
}
process.once('SIGINT',  () => { markShuttingDown(); process.exit(0); });
process.once('SIGTERM', () => { markShuttingDown(); process.exit(0); });
process.once('beforeExit', markShuttingDown);
const pendingRestart = new Map();
const manualStops    = new Set();   // botDbId-k, ahol a leállást szándékosan kértük
const lastDownNotif  = new Map();   // botDbId -> ts, throttle a "leállt" értesítéshez
const DOWN_NOTIF_COOLDOWN = 5 * 60 * 1000;

function nowTs() {
  return new Date().toTimeString().slice(0, 8);
}

function pushLog(botDbId, entry, log) {
  entry.logs.push(log);
  if (entry.logs.length > MAX_LOGS) entry.logs.shift();
  db.addBotLog(botDbId, log).catch(() => {});
}

export async function startBotProcess(botDbId, botTokenEnc, userName) {
  const existing = procs.get(botDbId);
  if (existing?.proc) return { ok: false, error: 'Már fut' };

  let rawToken;
  try { rawToken = decryptToken(botTokenEnc); }
  catch { return { ok: false, error: 'Token dekódolási hiba' }; }

  const savedLogs = await db.getBotLogs(botDbId).catch(() => []);

  const execArgv = process.execArgv.includes('--use-system-ca')
    ? process.execArgv
    : ['--use-system-ca', ...process.execArgv];
  const proc = fork(PROCESS_SCRIPT, [], {
    execArgv,
    env: { ...process.env, BOT_TOKEN: rawToken, BOT_DB_ID: botDbId },
  });

  const entry = {
    proc,
    tokenEnc:  botTokenEnc,
    stats:     { cpu: 0, ram: 0 },
    startedAt: Date.now(),
    history:   [],
    logs:      savedLogs,
    msgCount:  0,
  };
  procs.set(botDbId, entry);
  pushLog(botDbId, entry, { ts: nowTs(), user: userName, msg: 'Elindította a botot' });
  db.setAutostart(botDbId, true).catch(() => {});

  proc.on('message', (msg) => {
    if (!msg) return;
    if (msg.type === 'stats') {
      entry.stats = { cpu: msg.cpu, ram: msg.ram };
      entry.history.push({ t: Date.now(), cpu: msg.cpu, ram: msg.ram });
      if (entry.history.length > 60) entry.history.shift();
      const newCount = msg.msgCount ?? 0;
      const delta = newCount - entry.msgCount;
      entry.msgCount = newCount;
      if (delta > 0) db.incrementStatBy('total_messages', delta).catch(() => {});
    }
    if (msg.type === 'ready') pushLog(botDbId, entry, { ts: nowTs(), msg: 'A bot elérhető' });
    if (msg.type === 'error') pushLog(botDbId, entry, { ts: nowTs(), msg: `Hiba: ${msg.message}` });
    if (msg.type === 'log')   pushLog(botDbId, entry, { ts: nowTs(), msg: msg.msg });
  });

  proc.on('exit', (code) => {
    if (procs.has(botDbId)) {
      const e = procs.get(botDbId);
      pushLog(botDbId, e, { ts: nowTs(), msg: `Folyamat leállt (kód: ${code ?? '?'})` });
      e.proc    = null;
      e.stats   = { cpu: 0, ram: 0 };
      e.history = [];
    }
    if (shuttingDown) return;

    const wasManual  = manualStops.delete(botDbId);
    const wasRestart = pendingRestart.has(botDbId);
    if (!wasManual && !wasRestart) {
      const now = Date.now();
      if (now - (lastDownNotif.get(botDbId) ?? 0) > DOWN_NOTIF_COOLDOWN) {
        lastDownNotif.set(botDbId, now);
        db.getBotById(botDbId).then(b => {
          notifyBotParties(botDbId, {
            type: 'bot_down',
            title: 'A bot váratlanul leállt',
            body: b?.botName
              ? `A(z) ${b.botName} folyamata váratlanul leállt (kód: ${code ?? '?'}).`
              : `A bot folyamata váratlanul leállt (kód: ${code ?? '?'}).`,
          }).catch(() => {});
        }).catch(() => {});
      }
    }

    if (pendingRestart.has(botDbId)) {
      const { tokenEnc, uName } = pendingRestart.get(botDbId);
      pendingRestart.delete(botDbId);
      setTimeout(() => startBotProcess(botDbId, tokenEnc, uName), 500);
    } else {
      db.getBotSettings(botDbId).then(s => {
        if (shuttingDown) return;
        if (s.autoRestart) {
          const enc = entry?.tokenEnc;
          if (enc) setTimeout(() => { if (!shuttingDown) startBotProcess(botDbId, enc, 'auto-restart'); }, 1000);
        } else {
          db.setAutostart(botDbId, false).catch(() => {});
        }
      }).catch(() => {  });
    }
  });

  return { ok: true };
}

export function stopBotProcess(botDbId, userName) {
  const entry = procs.get(botDbId);
  if (!entry?.proc) return { ok: false, error: 'Nem fut' };

  pushLog(botDbId, entry, { ts: nowTs(), user: userName, msg: 'Leállította a botot' });
  manualStops.add(botDbId);
  db.setAutostart(botDbId, false).catch(() => {});
  entry.proc.send({ type: 'stop' });
  setTimeout(() => { if (procs.has(botDbId)) procs.get(botDbId)?.proc?.kill('SIGKILL'); }, 4000);

  return { ok: true };
}

export function restartBotProcess(botDbId, botTokenEnc, userName) {
  pendingRestart.set(botDbId, { tokenEnc: botTokenEnc, uName: userName });
  manualStops.add(botDbId);
  const entry = procs.get(botDbId);
  if (entry?.proc) {
    pushLog(botDbId, entry, { ts: nowTs(), user: userName, msg: 'Újraindítja a botot...' });
    entry.proc.send({ type: 'stop' });
    setTimeout(() => { const e = procs.get(botDbId); if (e?.proc) e.proc.kill('SIGKILL'); }, 4000);
  } else {
    pendingRestart.delete(botDbId);
    startBotProcess(botDbId, botTokenEnc, userName);
  }
  return { ok: true };
}

export function getActiveBotIds() {
  const ids = [];
  for (const [id, entry] of procs) {
    if (entry.proc) ids.push(id);
  }
  return ids;
}

export function getActiveBotCount() {
  let count = 0;
  for (const [, entry] of procs) { if (entry.proc) count++; }
  return count;
}

// Az összes futó bot élő statisztikája a memóriából (nincs DB-hívás).
export function getAllBotStats() {
  const out = {};
  for (const [id, entry] of procs) {
    const running = !!entry.proc;
    out[id] = {
      running,
      cpu:    running ? entry.stats.cpu : 0,
      ram:    running ? entry.stats.ram : 0,
      uptime: running ? Math.floor((Date.now() - entry.startedAt) / 1000) : 0,
      msgCount: entry.msgCount ?? 0,
    };
  }
  return out;
}

export async function getBotStatus(botDbId) {
  let entry = procs.get(botDbId);
  if (!entry) {
    const logs = await db.getBotLogs(botDbId).catch(() => []);
    if (!logs.length) return { running: false, cpu: 0, ram: 0, uptime: 0, history: [], logs: [] };
    return { running: false, cpu: 0, ram: 0, uptime: 0, history: [], logs };
  }
  const running = !!entry.proc;
  return {
    running,
    cpu:     running ? entry.stats.cpu : 0,
    ram:     running ? entry.stats.ram : 0,
    uptime:  running ? Math.floor((Date.now() - entry.startedAt) / 1000) : 0,
    history: entry.history,
    logs:    entry.logs,
  };
}
