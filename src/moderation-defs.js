
export const MOD_RULE_KEYS = ['profanity', 'gif', 'content', 'mentions', 'emoji', 'repeated'];

export const CMD_PERM_DEFAULT = { useDiscord: true, roleIds: [], userIds: [] };

export const MOD_DEFAULT = {
  language: 'hu',
  disabledCommands: [],
  commandPerms: {
    global:    { ...CMD_PERM_DEFAULT },
    overrides: {},
  },
  global: {
    bypassRoleIds:  [],
    bypassUserIds:  [],
    appliedRoleIds: [],
  },
  profanity: {
    enabled: false,
    words: ['fasz', 'geci', 'kurva', 'picsa', 'buzi', 'köcsög', 'csicska', 'szar', 'baszd', 'ribanc'],
    deleteMessage: true, replyMessage: 'Kérlek, ne káromkodj! 🚫',
    timeoutEnabled: false, timeoutMinutes: 10,
    bypassRoleIds: [], bypassUserIds: [],
  },
  gif: {
    enabled: false,
    allowedChannelIds: [],
    deleteMessage: true, replyMessage: 'Ebben a csatornában nem küldhetsz GIF-et.',
    timeoutEnabled: false, timeoutMinutes: 10,
    bypassRoleIds: [], bypassUserIds: [],
  },
  content: {
    enabled: false,
    allowedChannelIds: [],
    deleteMessage: true, replyMessage: 'Ebben a csatornában nem küldhetsz képet vagy videót.',
    timeoutEnabled: false, timeoutMinutes: 10,
    bypassRoleIds: [], bypassUserIds: [],
  },
  mentions: {
    enabled: false, maxMentions: 5,
    deleteMessage: true, replyMessage: 'Ne említs meg ennyi embert egyszerre!',
    timeoutEnabled: false, timeoutMinutes: 10,
    bypassRoleIds: [], bypassUserIds: [],
  },
  emoji: {
    enabled: false, maxEmojis: 10,
    deleteMessage: true, replyMessage: 'Túl sok emojit használtál!',
    timeoutEnabled: false, timeoutMinutes: 5,
    bypassRoleIds: [], bypassUserIds: [],
  },
  repeated: {
    enabled: false, maxRepeats: 3, intervalSec: 15,
    deleteMessage: true, replyMessage: 'Kérlek, ne küldd ugyanazt az üzenetet többször!',
    timeoutEnabled: false, timeoutMinutes: 5,
    bypassRoleIds: [], bypassUserIds: [],
  },
};

const PERM_BAN      = '4';
const PERM_KICK     = '2';
const PERM_MODERATE = '1099511627776';

export const MOD_COMMANDS = [
  {
    action: 'ban', hu: 'kitiltás', en: 'ban', perm: PERM_BAN,
    descHu: 'Felhasználó kitiltása a szerverről', descEn: 'Ban a user from the server',
    options: [
      { type: 6, hu: 'felhasznalo', en: 'user',     descHu: 'A kitiltandó felhasználó',                    descEn: 'User to ban',            required: true  },
      { type: 3, hu: 'indok',       en: 'reason',   descHu: 'A kitiltás indoka',                           descEn: 'Reason for the ban',     required: false },
      { type: 3, hu: 'idotartam',   en: 'duration', descHu: 'Pl. 30m, 2h, 7d — üresen hagyva végleges',    descEn: 'E.g. 30m, 2h, 7d — empty = permanent', required: false },
    ],
  },
  {
    action: 'unban', hu: 'kitiltásfeloldás', en: 'unban', perm: PERM_BAN,
    descHu: 'Kitiltott felhasználó feloldása', descEn: 'Unban a user',
    options: [
      { type: 3, hu: 'felhasznalo_id', en: 'user_id', descHu: 'A feloldandó felhasználó ID-ja', descEn: 'ID of the user to unban', required: true },
    ],
  },
  {
    action: 'unbanall', hu: 'összkitiltásfeloldás', en: 'unbanall', perm: PERM_BAN,
    descHu: 'Az összes kitiltott felhasználó feloldása', descEn: 'Unban every banned user',
    options: [],
  },
  {
    action: 'kick', hu: 'kirúgás', en: 'kick', perm: PERM_KICK,
    descHu: 'Felhasználó kirúgása a szerverről (indokot privátban megkapja)', descEn: 'Kick a user (reason is sent in DM)',
    options: [
      { type: 6, hu: 'felhasznalo', en: 'user',   descHu: 'A kirúgandó felhasználó', descEn: 'User to kick',       required: true  },
      { type: 3, hu: 'indok',       en: 'reason', descHu: 'A kirúgás indoka',        descEn: 'Reason for the kick', required: false },
    ],
  },
  {
    action: 'timeout', hu: 'felfüggesztés', en: 'timeout', perm: PERM_MODERATE,
    descHu: 'Felhasználó felfüggesztése adott időre', descEn: 'Timeout a user for a duration',
    options: [
      { type: 6, hu: 'felhasznalo', en: 'user',     descHu: 'A felfüggesztendő felhasználó',    descEn: 'User to timeout',       required: true  },
      { type: 3, hu: 'idotartam',   en: 'duration', descHu: 'Pl. 10m, 1h, 1d (max 28 nap)',     descEn: 'E.g. 10m, 1h, 1d (max 28 days)', required: true },
      { type: 3, hu: 'indok',       en: 'reason',   descHu: 'A felfüggesztés indoka',           descEn: 'Reason',                required: false },
    ],
  },
  {
    action: 'untimeout', hu: 'felfüggesztésfeloldás', en: 'untimeout', perm: PERM_MODERATE,
    descHu: 'Felfüggesztés feloldása', descEn: 'Remove a timeout',
    options: [
      { type: 6, hu: 'felhasznalo', en: 'user', descHu: 'A feloldandó felhasználó', descEn: 'User to remove timeout from', required: true },
    ],
  },
  {
    action: 'mute', hu: 'némítás', en: 'mute', perm: PERM_MODERATE,
    descHu: 'Felhasználó némítása (Mute rangot kap, nem tud írni)', descEn: 'Mute a user (gets the Mute role)',
    options: [
      { type: 6, hu: 'felhasznalo', en: 'user',     descHu: 'A némítandó felhasználó',           descEn: 'User to mute',      required: true  },
      { type: 3, hu: 'indok',       en: 'reason',   descHu: 'A némítás indoka',                  descEn: 'Reason',            required: false },
      { type: 3, hu: 'idotartam',   en: 'duration', descHu: 'Pl. 1h, 1d — üresen hagyva végleges', descEn: 'E.g. 1h, 1d — empty = permanent', required: false },
    ],
  },
  {
    action: 'unmute', hu: 'némításfeloldás', en: 'unmute', perm: PERM_MODERATE,
    descHu: 'Némítás feloldása', descEn: 'Unmute a user',
    options: [
      { type: 6, hu: 'felhasznalo', en: 'user', descHu: 'A feloldandó felhasználó', descEn: 'User to unmute', required: true },
    ],
  },
];

export function resolveCmdPerm(cfg, action) {
  const cp = cfg?.commandPerms ?? {};
  const g  = cp.global ?? {};
  const ov = cp.overrides?.[action];
  const src = (ov && ov.inherit === false) ? ov : g;
  return {
    useDiscord: src?.useDiscord !== false,
    roleIds: Array.isArray(src?.roleIds) ? src.roleIds : [],
    userIds: Array.isArray(src?.userIds) ? src.userIds : [],
  };
}

export function cmdPermIsCustom(p) {
  return !p.useDiscord || p.roleIds.length > 0 || p.userIds.length > 0;
}

export function buildModCommands(lang = 'hu', disabled = [], cfg = null) {
  const L = lang === 'en' ? 'en' : 'hu';
  const D = L === 'en' ? 'descEn' : 'descHu';
  return MOD_COMMANDS.filter(c => !disabled.includes(c.action)).map(c => {
    const p = resolveCmdPerm(cfg, c.action);
    const perm = cmdPermIsCustom(p) ? null : c.perm;
    return {
      name: c[L],
      description: c[D],
      type: 1,
      default_member_permissions: perm,
      dm_permission: false,
      options: c.options.map(o => ({
        type: o.type,
        name: o[L],
        description: o[D],
        required: !!o.required,
      })),
    };
  });
}

export function findModCommand(name) {
  return MOD_COMMANDS.find(c => c.hu === name || c.en === name) ?? null;
}

export function parseDuration(str) {
  const s = String(str ?? '').trim().toLowerCase();
  if (!s) return null;
  const m = s.match(/^(\d+)\s*(mp|s|m|p|h|ó|o|d|n)?$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!n || n <= 0) return null;
  const unit = m[2] ?? 'm';
  const mult = (unit === 's' || unit === 'mp') ? 1000
             : (unit === 'h' || unit === 'ó' || unit === 'o') ? 3600000
             : (unit === 'd' || unit === 'n') ? 86400000
             : 60000;
  return n * mult;
}

export function fmtDuration(ms) {
  if (ms >= 86400000) return `${Math.round(ms / 86400000)} nap`;
  if (ms >= 3600000)  return `${Math.round(ms / 3600000)} óra`;
  if (ms >= 60000)    return `${Math.round(ms / 60000)} perc`;
  return `${Math.round(ms / 1000)} mp`;
}
