import { Client, GatewayIntentBits, Events, ActivityType } from 'discord.js';
import { loadModules } from './modules/index.js';
import { db } from './db.js';

const token = process.env.BOT_TOKEN;
if (!token) process.exit(1);

const botDbId = process.env.BOT_DB_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
  ],
});

client.once(Events.ClientReady, async (c) => {
  loadModules(client);

  if (botDbId) {
    const settings = await db.getBotSettings(botDbId).catch(() => ({}));
    if (!settings.brandingDisabled) {
      c.user.setPresence({
        activities: [{ name: 'Által: voidhost.hu', type: ActivityType.Watching }],
        status: 'online',
      });
    }
  }

  process.send?.({ type: 'ready', tag: c.user.tag });
});

client.on(Events.Error, (err) => {
  process.send?.({ type: 'error', message: err.message });
});

let msgCount = 0;

client.on(Events.MessageCreate, (message) => {
  if (!message.author.bot) msgCount++;
});

client.login(token).catch((err) => {
  process.send?.({ type: 'error', message: err.message });
  process.exit(1);
});

let lastCpu = process.cpuUsage();
let lastHr  = process.hrtime.bigint();

setInterval(() => {
  const nowHr    = process.hrtime.bigint();
  const curCpu   = process.cpuUsage();
  const elapsedUs = Number(nowHr - lastHr) / 1000;
  const usedUs    = (curCpu.user - lastCpu.user) + (curCpu.system - lastCpu.system);
  const cpuPct    = Math.min(100, Math.round((usedUs / elapsedUs) * 100));
  const mem       = process.memoryUsage();
  process.send?.({ type: 'stats', cpu: cpuPct, ram: Math.round(mem.rss / 1024 / 1024), msgCount });
  lastCpu = curCpu;
  lastHr  = nowHr;
}, 2000);

process.on('message', (msg) => {
  if (msg?.type === 'stop') {
    client.destroy();
    process.exit(0);
  }
});
