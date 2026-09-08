import 'dotenv/config';
import mysql from 'mysql2/promise';

// Minden rangnak TELJES jogot ad (a vh_rank_permissions tábla feltöltése),
// hogy a panel Rangok oldaláról utána finomhangolni lehessen.
// Futtatás:  node scripts/seed-ranks.js

const FULL_PERMS = {
  maxBots:          9999,
  maxBotMembers:    9999,
  maxCommands:      9999,
  manageOthersBots: true,
  createBots:       true,
  deleteOwnBots:    true,
  editBotSettings:  true,
  verifyUsers:      true,
  deleteUsers:      true,
  changeEmail:      true,
  resetPassword:    true,
  editRanks:        true,
  viewLogs:         true,
  viewSysBots:      true,
  viewRanks:        true,
  disableBranding:  true,
  viewUsers:        true,
  deleteOthersBots: true,
  manageBotAccess:  true,
  banUsers:         true,
  unbanUsers:       true,
  manageSystem:     true,
};

const rankRoleIds = (process.env.DISCORD_RANK_ROLE_IDS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// 'default' = fallback minden olyan usernek, akinek a top rangjához nincs külön sor
const roleIds = ['default', ...rankRoleIds];

const conn = await mysql.createConnection(process.env.DATABASE_URL);

await conn.query(`CREATE TABLE IF NOT EXISTS vh_rank_permissions (
  role_id VARCHAR(30) NOT NULL,
  perms TEXT NOT NULL,
  PRIMARY KEY (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

const json = JSON.stringify(FULL_PERMS);
for (const roleId of roleIds) {
  await conn.query(
    'INSERT INTO vh_rank_permissions (role_id, perms) VALUES (?, ?) ON DUPLICATE KEY UPDATE perms = VALUES(perms)',
    [roleId, json]
  );
  console.log(`  ✔ ${roleId}`);
}

console.log(`\nKész — ${roleIds.length} rang kapott teljes jogot.`);
await conn.end();
