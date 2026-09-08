// Hibajegy (ticket) modul – közös definíciók a panel (API) és a bot folyamat között.

export const TICKET_LIMITS = {
  panels:            10,
  categoriesPerPanel: 15,   // a legördülő menü max 25 opciót enged, 15 bőven elég
  questionsPerCategory: 5,  // Discord modál max 5 mező
};

export const BUTTON_STYLES = ['primary', 'secondary', 'success', 'danger'];
const STYLE_MAP = { primary: 1, secondary: 2, success: 3, danger: 4 };

export const QUESTION_STYLES = ['short', 'paragraph'];

// ---- alap sablonok ----

export function emptyQuestion() {
  return { label: 'Kérdés', placeholder: '', style: 'short', required: true, maxLength: 300 };
}

export function emptyCategory() {
  return {
    id: '',
    label: 'Általános',
    emoji: '🎫',
    description: 'Általános kérdések és segítségkérés',
    discordCategoryId: '',
    staffRoleIds: [],
    pingRoleIds: [],
    openMessage: 'Köszönjük, hogy jegyet nyitottál! A csapatunk hamarosan válaszol. Kérlek, addig is írd le részletesen a problémádat.',
    maxOpenPerUser: 0,           // 0 = korlátlan (kategóriánként, felhasználónként)
    questions: [],
  };
}

export function emptyPanel() {
  return {
    id: '',
    name: 'Támogatás',
    channelId: '',
    messageId: '',
    embed: {
      title: '🎫 Támogatás',
      description: 'Nyiss egy jegyet a lenti gombbal, és a csapatunk hamarosan válaszol.\nKérlek, csak valós problémával nyiss jegyet.',
      color: '#5865f2',
      imageUrl: '',
      thumbnailUrl: '',
    },
    button: { label: 'Jegy nyitása', emoji: '🎫', style: 'primary' },
    access: { allowedRoleIds: [], deniedRoleIds: [] },
    maxOpenPerUser: 1,           // az egész panelre összesen, felhasználónként
    categories: [],
  };
}

export const TICKET_CONFIG_DEFAULT = {
  logChannelId: '',
  transcript: { enabled: true, deleteDelaySec: 5 },
  panels: [],
};

// ---- segédfüggvények ----

export function hexToInt(hex, fallback = 0x5865f2) {
  const n = parseInt(String(hex ?? '').replace('#', ''), 16);
  return Number.isFinite(n) ? n : fallback;
}

function isHttpUrl(u) {
  return typeof u === 'string' && /^https?:\/\/.+/i.test(u) && u.length <= 500;
}

function isChannelId(v) {
  return typeof v === 'string' && /^[0-9]{1,30}$/.test(v);
}

function idList(v, max = 40) {
  return Array.isArray(v)
    ? [...new Set(v.map(x => String(x ?? '')).filter(s => /^[0-9]{1,30}$/.test(s)))].slice(0, max)
    : [];
}

function clampInt(v, min, max, def) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}

function str(v, max) {
  return String(v ?? '').slice(0, max);
}

export function parseEmoji(input) {
  const s = String(input ?? '').trim();
  if (!s) return undefined;
  const m = s.match(/^<(a?):(\w{2,32}):(\d{1,25})>$/);
  if (m) return { animated: Boolean(m[1]), name: m[2], id: m[3] };
  // egyszerű unicode emoji – csak akkor fogadjuk el, ha rövid és nincs benne szóköz
  if (s.length <= 8 && !/\s/.test(s)) return { name: s };
  return undefined;
}

// ---- merge (olvasáshoz / bothoz) ----

export function mergeTicketConfig(raw) {
  const d = TICKET_CONFIG_DEFAULT;
  const out = {
    logChannelId: typeof raw?.logChannelId === 'string' ? raw.logChannelId : '',
    transcript: {
      enabled: raw?.transcript?.enabled !== false,
      deleteDelaySec: clampInt(raw?.transcript?.deleteDelaySec, 0, 3600, 5),
    },
    panels: Array.isArray(raw?.panels) ? raw.panels.map(mergePanel) : [],
  };
  return out;
}

function mergePanel(p) {
  const base = emptyPanel();
  return {
    id: typeof p?.id === 'string' ? p.id : '',
    name: typeof p?.name === 'string' ? p.name : base.name,
    channelId: typeof p?.channelId === 'string' ? p.channelId : '',
    messageId: typeof p?.messageId === 'string' ? p.messageId : '',
    embed: {
      title: typeof p?.embed?.title === 'string' ? p.embed.title : base.embed.title,
      description: typeof p?.embed?.description === 'string' ? p.embed.description : base.embed.description,
      color: typeof p?.embed?.color === 'string' ? p.embed.color : base.embed.color,
      imageUrl: typeof p?.embed?.imageUrl === 'string' ? p.embed.imageUrl : '',
      thumbnailUrl: typeof p?.embed?.thumbnailUrl === 'string' ? p.embed.thumbnailUrl : '',
    },
    button: {
      label: typeof p?.button?.label === 'string' ? p.button.label : base.button.label,
      emoji: typeof p?.button?.emoji === 'string' ? p.button.emoji : base.button.emoji,
      style: BUTTON_STYLES.includes(p?.button?.style) ? p.button.style : 'primary',
    },
    access: {
      allowedRoleIds: idList(p?.access?.allowedRoleIds),
      deniedRoleIds: idList(p?.access?.deniedRoleIds),
    },
    maxOpenPerUser: clampInt(p?.maxOpenPerUser, 0, 50, base.maxOpenPerUser),
    categories: Array.isArray(p?.categories) ? p.categories.map(mergeCategory) : [],
  };
}

function mergeCategory(c) {
  const base = emptyCategory();
  return {
    id: typeof c?.id === 'string' ? c.id : '',
    label: typeof c?.label === 'string' ? c.label : base.label,
    emoji: typeof c?.emoji === 'string' ? c.emoji : base.emoji,
    description: typeof c?.description === 'string' ? c.description : '',
    discordCategoryId: typeof c?.discordCategoryId === 'string' ? c.discordCategoryId : '',
    staffRoleIds: idList(c?.staffRoleIds),
    pingRoleIds: idList(c?.pingRoleIds),
    openMessage: typeof c?.openMessage === 'string' ? c.openMessage : base.openMessage,
    maxOpenPerUser: clampInt(c?.maxOpenPerUser, 0, 50, 0),
    questions: Array.isArray(c?.questions) ? c.questions.slice(0, TICKET_LIMITS.questionsPerCategory).map(mergeQuestion) : [],
  };
}

function mergeQuestion(q) {
  return {
    label: typeof q?.label === 'string' ? q.label : 'Kérdés',
    placeholder: typeof q?.placeholder === 'string' ? q.placeholder : '',
    style: QUESTION_STYLES.includes(q?.style) ? q.style : 'short',
    required: q?.required !== false,
    maxLength: clampInt(q?.maxLength, 1, 1024, 300),
  };
}

// ---- sanitize (mentéshez) ----

export function sanitizeTicketConfig(raw, { genId }) {
  const panelsIn = Array.isArray(raw?.panels) ? raw.panels.slice(0, TICKET_LIMITS.panels) : [];
  return {
    logChannelId: isChannelId(raw?.logChannelId) ? raw.logChannelId : '',
    transcript: {
      enabled: raw?.transcript?.enabled !== false,
      deleteDelaySec: clampInt(raw?.transcript?.deleteDelaySec, 0, 3600, 5),
    },
    panels: panelsIn.map(p => sanitizePanel(p, genId)),
  };
}

function sanitizePanel(p, genId) {
  const catsIn = Array.isArray(p?.categories) ? p.categories.slice(0, TICKET_LIMITS.categoriesPerPanel) : [];
  return {
    id: typeof p?.id === 'string' && p.id ? p.id : genId(),
    name: str(p?.name, 60) || 'Panel',
    channelId: isChannelId(p?.channelId) ? p.channelId : '',
    messageId: isChannelId(p?.messageId) ? p.messageId : '',
    embed: {
      title: str(p?.embed?.title, 256),
      description: str(p?.embed?.description, 4000),
      color: /^#[0-9a-fA-F]{6}$/.test(p?.embed?.color) ? p.embed.color : '#5865f2',
      imageUrl: isHttpUrl(p?.embed?.imageUrl) ? p.embed.imageUrl : '',
      thumbnailUrl: isHttpUrl(p?.embed?.thumbnailUrl) ? p.embed.thumbnailUrl : '',
    },
    button: {
      label: str(p?.button?.label, 80) || 'Jegy nyitása',
      emoji: str(p?.button?.emoji, 40),
      style: BUTTON_STYLES.includes(p?.button?.style) ? p.button.style : 'primary',
    },
    access: {
      allowedRoleIds: idList(p?.access?.allowedRoleIds),
      deniedRoleIds: idList(p?.access?.deniedRoleIds),
    },
    maxOpenPerUser: clampInt(p?.maxOpenPerUser, 0, 50, 1),
    categories: catsIn.map(c => sanitizeCategory(c, genId)),
  };
}

function sanitizeCategory(c, genId) {
  const qIn = Array.isArray(c?.questions) ? c.questions.slice(0, TICKET_LIMITS.questionsPerCategory) : [];
  return {
    id: typeof c?.id === 'string' && c.id ? c.id : genId(),
    label: str(c?.label, 60) || 'Kategória',
    emoji: str(c?.emoji, 40),
    description: str(c?.description, 100),
    discordCategoryId: isChannelId(c?.discordCategoryId) ? c.discordCategoryId : '',
    staffRoleIds: idList(c?.staffRoleIds),
    pingRoleIds: idList(c?.pingRoleIds),
    openMessage: str(c?.openMessage, 3000),
    maxOpenPerUser: clampInt(c?.maxOpenPerUser, 0, 50, 0),
    questions: qIn.map(q => ({
      label: str(q?.label, 45) || 'Kérdés',
      placeholder: str(q?.placeholder, 100),
      style: QUESTION_STYLES.includes(q?.style) ? q.style : 'short',
      required: q?.required !== false,
      maxLength: clampInt(q?.maxLength, 1, 1024, 300),
    })),
  };
}

// ---- panel üzenet felépítése (nyers Discord API JSON, REST-hez) ----

export function buildPanelPayload(panel) {
  const p = panel;
  const embed = { color: hexToInt(p.embed?.color) };
  if (p.embed?.title) embed.title = String(p.embed.title).slice(0, 256);
  if (p.embed?.description) embed.description = String(p.embed.description).slice(0, 4096);
  if (isHttpUrl(p.embed?.imageUrl)) embed.image = { url: p.embed.imageUrl };
  if (isHttpUrl(p.embed?.thumbnailUrl)) embed.thumbnail = { url: p.embed.thumbnailUrl };
  if (!embed.title && !embed.description) embed.description = 'Nyiss egy jegyet a lenti gombbal.';

  const cats = (p.categories || []).filter(c => c && c.id);

  let row;
  if (cats.length <= 1) {
    const btn = {
      type: 2,
      style: STYLE_MAP[p.button?.style] || 1,
      label: (p.button?.label || 'Jegy nyitása').slice(0, 80),
      custom_id: `vht:o:${p.id}`,
    };
    const em = parseEmoji(p.button?.emoji);
    if (em) btn.emoji = em;
    row = { type: 1, components: [btn] };
  } else {
    row = {
      type: 1,
      components: [{
        type: 3,
        custom_id: `vht:s:${p.id}`,
        placeholder: (p.button?.label || 'Válassz kategóriát...').slice(0, 150),
        min_values: 1,
        max_values: 1,
        options: cats.slice(0, 25).map(c => {
          const opt = { label: (c.label || 'Kategória').slice(0, 100), value: c.id };
          if (c.description) opt.description = String(c.description).slice(0, 100);
          const em = parseEmoji(c.emoji);
          if (em) opt.emoji = em;
          return opt;
        }),
      }],
    };
  }

  return { embeds: [embed], components: [row] };
}

export function findPanel(config, panelId) {
  return (config?.panels ?? []).find(p => p.id === panelId) ?? null;
}

export function findCategory(panel, categoryId) {
  return (panel?.categories ?? []).find(c => c.id === categoryId) ?? null;
}
