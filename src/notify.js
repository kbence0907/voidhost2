import { v4 as uuidv4 } from 'uuid';
import { db } from './db.js';
import { sseNotifyUser } from './sse.js';
import { getUserTopRole, postApprovalRequest } from './discord.js';
import { sendApprovalPendingEmail } from './mailer.js';

const ADMIN_ROLE_IDS = new Set(
  (process.env.ADMIN_ROLE_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean)
);

// Rövid cache a Discord top-rang lekérdezésekhez, hogy a jóváhagyás-értesítés
// ne terhelje agyon a Discord API-t sok felhasználónál.
const roleCache = new Map();
const ROLE_TTL = 2 * 60 * 1000;
async function cachedTopRole(discordId) {
  const hit = roleCache.get(discordId);
  if (hit && Date.now() - hit.at < ROLE_TTL) return hit.role;
  let role = null;
  try { role = await getUserTopRole(discordId); } catch {}
  roleCache.set(discordId, { role, at: Date.now() });
  return role;
}

/**
 * Létrehoz egy értesítést a DB-ben és élőben kiküldi SSE-n (ha a user online).
 */
export async function pushNotification(userId, { type, title, body = '', link = null }) {
  if (!userId) return;
  const id = uuidv4();
  try {
    await db.createNotification({ id, userId, type, title, body, link });
  } catch (e) {
    console.warn('notification insert hiba:', e.message);
    return;
  }
  try {
    sseNotifyUser(userId, 'notification', {
      id, type, title, body, link, is_read: false, created_at: Date.now(),
    });
  } catch {}
}

/**
 * Értesíti egy bot tulajdonosát és a megosztott tagjait.
 */
export async function notifyBotParties(botDbId, notif, excludeUserId = null) {
  try {
    const bot = await db.getBotById(botDbId);
    if (!bot) return;
    const recipients = new Set();
    if (bot.ownerId) recipients.add(bot.ownerId);
    const members = await db.getBotMembers(botDbId).catch(() => []);
    for (const m of members) recipients.add(m.userId);
    if (excludeUserId) recipients.delete(excludeUserId);
    for (const uid of recipients) {
      await pushNotification(uid, notif);
    }
  } catch (e) {
    console.warn('notifyBotParties hiba:', e.message);
  }
}

/**
 * Kideríti, kik hagyhatnak jóvá fiókokat (ADMIN_ROLE_IDS vagy approveUsers rang-jog),
 * bell-értesítést küld nekik, és emailt azoknak, akiknek a rangján be van kapcsolva
 * az approvalEmail (az adminok mindig kapnak emailt).
 */
export async function notifyApprovers(applicant) {
  // Discord csatorna: embed + gombok (jóváhagyás/elutasítás közvetlenül Discordról)
  postApprovalRequest(applicant).catch(() => {});

  let users, rankRows;
  try {
    [users, rankRows] = await Promise.all([db.getAllUsers(), db.getAllRankPerms()]);
  } catch (e) {
    console.warn('notifyApprovers hiba:', e.message);
    return;
  }
  const permByRole = Object.fromEntries(rankRows.map(r => [r.roleId, r]));
  const title = 'Új fiók jóváhagyásra vár';
  const body = `${applicant.name} (${applicant.email}) regisztrált és jóváhagyásra vár.`;

  for (const u of users) {
    if (!u.discord_id || u.banned) continue;
    const topRole = await cachedTopRole(u.discord_id);
    if (!topRole?.id) continue;

    const isAdmin = ADMIN_ROLE_IDS.has(topRole.id);
    const rp = permByRole[topRole.id] ?? permByRole['default'] ?? null;
    const canApprove = isAdmin || !!rp?.approveUsers;
    if (!canApprove) continue;

    await pushNotification(u.id, { type: 'approval_pending', title, body, link: 'approvals' });

    if (isAdmin || !!rp?.approvalEmail) {
      sendApprovalPendingEmail(u.email, {
        name: u.name,
        applicantName: applicant.name,
        applicantEmail: applicant.email,
      }).catch(() => {});
    }
  }
}
