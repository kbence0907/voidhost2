const CLIENT_ID     = process.env.DISCORD_CLIENT_ID     ?? '';
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET ?? '';
const BOT_TOKEN     = process.env.DISCORD_BOT_TOKEN     ?? '';
const GUILD_ID      = process.env.DISCORD_GUILD_ID      ?? '';

function colorHex(c) {
  return c === 0 ? '#99aab5' : '#' + c.toString(16).padStart(6, '0');
}

export function getAllWatchedRoleIds() {
  const ids = new Set();
  if (process.env.DISCORD_RANK_ROLE_IDS)
    process.env.DISCORD_RANK_ROLE_IDS.split(',').map(s => s.trim()).filter(Boolean).forEach(id => ids.add(id));
  if (process.env.DISCORD_REQUIRED_ROLE_ID?.trim())
    ids.add(process.env.DISCORD_REQUIRED_ROLE_ID.trim());
  return [...ids];
}

export function getRedirectUri() {
  return process.env.DISCORD_REDIRECT_URI ?? 'http://localhost:8080/auth/discord/callback';
}

export function buildOAuthUrl(state) {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  getRedirectUri(),
    response_type: 'code',
    scope:         'identify email guilds.join',
    state,
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

export async function exchangeCode(code) {
  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    'authorization_code',
      code,
      redirect_uri:  getRedirectUri(),
    }),
  });
  if (!res.ok) throw new Error('discord token exchange failed');
  const data = await res.json();
  return data.access_token;
}

export async function getDiscordUser(accessToken) {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('discord user fetch failed');
  const u = await res.json();
  return { id: u.id, username: u.username, email: u.email, avatar: u.avatar ?? null };
}

export async function fetchDiscordProfile(discordId) {
  if (!BOT_TOKEN || !discordId) return null;
  try {
    const res = await fetch(`https://discord.com/api/users/${discordId}`, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` },
    });
    if (!res.ok) return null;
    const u = await res.json();
    return { username: u.username, avatar: u.avatar ?? null };
  } catch (err) {
    console.warn('fetchDiscordProfile hiba:', err);
    return null;
  }
}

async function fetchRequiredRoleInfo(allRoles) {
  const rid = process.env.DISCORD_REQUIRED_ROLE_ID?.trim();
  if (!rid) return null;
  const r = allRoles.find(x => x.id === rid);
  if (!r) return null;
  return { id: 'default', name: r.name, color: colorHex(r.color) };
}

export async function getGuildRoles() {
  if (!BOT_TOKEN || !GUILD_ID) return [];

  const rankIds = process.env.DISCORD_RANK_ROLE_IDS
    ? new Set(process.env.DISCORD_RANK_ROLE_IDS.split(',').map(s => s.trim()).filter(Boolean))
    : null;

  try {
    const res = await fetch(
      `https://discord.com/api/guilds/${GUILD_ID}/roles`,
      { headers: { Authorization: `Bot ${BOT_TOKEN}` } },
    );
    if (!res.ok) return [];
    const roles = await res.json();

    const upper = roles
      .filter(r => r.id !== GUILD_ID && (!rankIds || rankIds.has(r.id)))
      .sort((a, b) => b.position - a.position)
      .map(r => ({ id: r.id, name: r.name, color: colorHex(r.color) }));

    const base = await fetchRequiredRoleInfo(roles);
    if (base) upper.push(base);

    return upper;
  } catch (err) {
    console.warn('getGuildRoles hiba:', err);
    return [];
  }
}

export async function getUserTopRole(discordId) {
  if (!BOT_TOKEN || !GUILD_ID || !discordId) return null;

  const rankIds = process.env.DISCORD_RANK_ROLE_IDS
    ? new Set(process.env.DISCORD_RANK_ROLE_IDS.split(',').map(s => s.trim()).filter(Boolean))
    : null;

  const requiredId = process.env.DISCORD_REQUIRED_ROLE_ID?.trim() ?? '';

  try {
    const [memberRes, rolesRes] = await Promise.all([
      fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/${discordId}`,
        { headers: { Authorization: `Bot ${BOT_TOKEN}` } }),
      fetch(`https://discord.com/api/guilds/${GUILD_ID}/roles`,
        { headers: { Authorization: `Bot ${BOT_TOKEN}` } }),
    ]);
    if (!memberRes.ok || !rolesRes.ok) return null;

    const [member, allRoles] = await Promise.all([memberRes.json(), rolesRes.json()]);
    const memberRoleIds = new Set(member.roles);

    if (rankIds?.size) {
      const matched = allRoles
        .filter(r => memberRoleIds.has(r.id) && r.id !== GUILD_ID && rankIds.has(r.id))
        .sort((a, b) => b.position - a.position);
      if (matched.length) {
        const top = matched[0];
        return { id: top.id, name: top.name, color: colorHex(top.color), position: top.position };
      }
    }

    if (requiredId && memberRoleIds.has(requiredId)) {
      const r = allRoles.find(x => x.id === requiredId);
      if (r) return { id: 'default', name: r.name, color: colorHex(r.color), position: r.position };
    }

    return null;
  } catch (err) {
    console.warn('getUserTopRole hiba:', err);
    return null;
  }
}

export async function isGuildMember(discordId) {
  if (!BOT_TOKEN || !GUILD_ID || !discordId) return false;
  try {
    const res = await fetch(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${discordId}`,
      { headers: { Authorization: `Bot ${BOT_TOKEN}` } },
    );
    return res.ok;
  } catch (err) {
    console.warn('isGuildMember hiba:', err);
    return false;
  }
}

export async function addGuildMember(discordId, accessToken, roleIds = []) {
  if (!BOT_TOKEN || !GUILD_ID || !discordId || !accessToken) return false;
  try {
    const body = { access_token: accessToken };
    if (roleIds.length) body.roles = roleIds;
    const res = await fetch(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${discordId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.warn(`addGuildMember sikertelen (${res.status}): ${txt}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('addGuildMember hiba:', err);
    return false;
  }
}

export async function postApprovalRequest(user) {
  const channelId = process.env.DISCORD_APPROVAL_CHANNEL_ID?.trim();
  if (!BOT_TOKEN || !channelId) return null;

  const dcLine = user.discordUsername
    ? `${user.discordUsername}${user.discordId ? ` (<@${user.discordId}>)` : ''}`
    : (user.discordId ? `<@${user.discordId}>` : '—');

  const embed = {
    title: '🕓 Új fiók jóváhagyásra vár',
    color: 0x5865f2,
    fields: [
      { name: 'Név',     value: user.name  || '—', inline: true },
      { name: 'Email',   value: user.email || '—', inline: true },
      { name: 'Discord', value: dcLine,            inline: false },
    ],
    timestamp: new Date(user.createdAt || Date.now()).toISOString(),
    footer: { text: `user:${user.id}` },
  };
  if (user.discordId && user.discordAvatar) {
    embed.thumbnail = { url: `https://cdn.discordapp.com/avatars/${user.discordId}/${user.discordAvatar}.png?size=128` };
  }

  const components = [{
    type: 1,
    components: [
      { type: 2, style: 3, label: 'Jóváhagyás', custom_id: `vh_approve:${user.id}` },
      { type: 2, style: 4, label: 'Elutasítás', custom_id: `vh_reject:${user.id}` },
    ],
  }];

  try {
    const r = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed], components }),
    });
    if (!r.ok) {
      console.warn(`postApprovalRequest sikertelen (${r.status}):`, await r.text().catch(() => ''));
      return null;
    }
    return await r.json();
  } catch (err) {
    console.warn('postApprovalRequest hiba:', err.message);
    return null;
  }
}

export async function hasRequiredRole(discordId) {
  const watched = getAllWatchedRoleIds();

  if (!watched.length) return true;
  if (!BOT_TOKEN || !GUILD_ID) return true;
  if (!discordId) return false;

  try {
    const res = await fetch(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${discordId}`,
      { headers: { Authorization: `Bot ${BOT_TOKEN}` } },
    );
    if (!res.ok) return false;
    const member = await res.json();
    return watched.some(id => member.roles.includes(id));
  } catch (err) {
    console.warn('hasRequiredRole hiba:', err);
    return false;
  }
}
