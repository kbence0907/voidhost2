import { v4 as uuidv4 } from 'uuid';
import { db } from './db.js';
import { sseNotifyUser } from './sse.js';
import { pushNotification } from './notify.js';
import { getUserTopRole } from './discord.js';
import { sendApprovedEmail, sendRejectedEmail } from './mailer.js';

const ADMIN_ROLE_IDS = new Set(
  (process.env.ADMIN_ROLE_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean)
);
const RANK_ROLE_IDS = new Set(
  (process.env.DISCORD_RANK_ROLE_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean)
);

function log(event, msg, opts = {}) {
  db.addLog({ id: uuidv4(), event, msg, ...opts }).catch(() => {});
}

/**
 * Eldönti, hogy egy Discord felhasználó jóváhagyhat-e fiókokat.
 * @param {string} discordId
 * @param {string[]} [roleIds] - ha ismert a szerepkör-lista (pl. interakcióból), ezt használjuk (nincs API hívás)
 */
export async function canApprove(discordId, roleIds = null) {
  if (!discordId) return false;

  let ids = Array.isArray(roleIds) ? roleIds : null;
  if (!ids) {
    const top = await getUserTopRole(discordId).catch(() => null);
    ids = top?.id ? [top.id] : [];
  }
  if (!ids.length) return false;

  if (ids.some(r => ADMIN_ROLE_IDS.has(r))) return true;

  const rankRows = await db.getAllRankPerms().catch(() => []);
  const permByRole = Object.fromEntries(rankRows.map(r => [r.roleId, r]));
  for (const rid of ids) {
    if (RANK_ROLE_IDS.has(rid) && permByRole[rid]?.approveUsers) return true;
  }
  return false;
}

/**
 * Jóváhagy egy várakozó fiókot. Egységes forrás a web és a Discord számára.
 * @returns {{ ok: boolean, error?: string, already?: boolean, user?: object }}
 */
export async function approveUserAccount(userId, actorName = 'Ismeretlen', src = 'jóváhagyás') {
  const user = await db.getUserById(userId).catch(() => null);
  if (!user) return { ok: false, error: 'Felhasználó nem található' };
  if (user.approved) return { ok: true, already: true, user };

  await db.approveUser(user.id);
  log('user_approve', `${actorName} jóváhagyta ${user.name} (${user.email}) fiókját`, { userName: actorName, userId: user.id, src });

  pushNotification(user.id, {
    type: 'account_approved',
    title: 'Fiókod jóváhagyva',
    body: 'Mostantól bejelentkezhetsz a VoidHost panelre.',
  }).catch(() => {});
  sseNotifyUser(user.id, 'role_update', {});
  sendApprovedEmail(user.email, { name: user.name }).catch(() => {});

  return { ok: true, user };
}

/**
 * Elutasít (töröl) egy várakozó fiókot.
 * @returns {{ ok: boolean, error?: string, user?: object }}
 */
export async function rejectUserAccount(userId, reason = '', actorName = 'Ismeretlen', src = 'jóváhagyás') {
  const user = await db.getUserById(userId).catch(() => null);
  if (!user) return { ok: false, error: 'Felhasználó nem található' };
  if (user.approved) return { ok: false, error: 'Ez a fiók már jóvá van hagyva.' };

  const cleanReason = String(reason ?? '').trim().slice(0, 300);

  await db.deleteUserSessions(user.id).catch(() => {});
  await db.deleteVerifyCode(user.email).catch(() => {});
  await db.deleteUser(user.id);
  log('user_reject', `${actorName} elutasította ${user.name} (${user.email}) regisztrációját`, { userName: actorName, userId: user.id, src });
  sendRejectedEmail(user.email, { name: user.name, reason: cleanReason }).catch(() => {});

  return { ok: true, user };
}
