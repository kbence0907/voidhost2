const byDiscordId = new Map();
const byUserId    = new Map();

const MAX_SSE_PER_USER = 5;

export function sseRegister(discordId, userId, res) {
  const existing = byUserId.get(userId);
  if (existing && existing.size >= MAX_SSE_PER_USER) return false;
  if (discordId) {
    if (!byDiscordId.has(discordId)) byDiscordId.set(discordId, new Set());
    byDiscordId.get(discordId).add(res);
  }
  if (!byUserId.has(userId)) byUserId.set(userId, new Set());
  byUserId.get(userId).add(res);
  return true;
}

export function sseUnregister(discordId, userId, res) {
  if (discordId) {
    byDiscordId.get(discordId)?.delete(res);
    if (byDiscordId.get(discordId)?.size === 0) byDiscordId.delete(discordId);
  }
  byUserId.get(userId)?.delete(res);
  if (byUserId.get(userId)?.size === 0) byUserId.delete(userId);
}

export function sseNotify(discordId, event = 'role_update', data = {}) {
  const set = byDiscordId.get(discordId);
  if (!set || set.size === 0) return;
  const payload = JSON.stringify(data);
  for (const res of set) {
    try { res.write(`event: ${event}\ndata: ${payload}\n\n`); } catch {  }
  }
}

export function getOnlineUserIds() {
  return new Set(byUserId.keys());
}

export function sseNotifyUser(userId, event, data = {}) {
  const set = byUserId.get(userId);
  if (!set || set.size === 0) return;
  const payload = JSON.stringify(data);
  for (const res of set) {
    try { res.write(`event: ${event}\ndata: ${payload}\n\n`); } catch {  }
  }
}
