// VoidHost gazda-felügyelő (supervisor).
// A GAZDA gépen fut folyamatosan (indítsd: gazda.bat).
// Figyeli a .control mappát; a kliensről küldött parancsokat itt, a gazdán hajtja végre.
//   indit   -> elindítja a szervert (ha nem fut)
//   ujra    -> leállítja és újraindítja a szervert
//   leallit -> leállítja a szervert
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT   = path.dirname(fileURLToPath(import.meta.url)); // a projekt gyökere a gazdán
const CTRL   = path.join(ROOT, '.control');
const STATUS = path.join(CTRL, 'status.txt');

fs.mkdirSync(CTRL, { recursive: true });

let child = null;         // a futó node szerver process-e
let restarting = false;

function ts() { return new Date().toISOString().slice(11, 19); }
function log(...a) { console.log(`[${ts()}]`, ...a); }

function writeStatus(state) {
  try {
    fs.writeFileSync(STATUS,
      `allapot=${state}\npid=${child ? child.pid : '-'}\nfrissitve=${new Date().toISOString()}\n`);
  } catch {}
}

function startServer() {
  if (child) { log(`Mar fut (pid ${child.pid}).`); return; }
  log('Indit: node --use-system-ca src/index.js');
  child = spawn(process.execPath, ['--use-system-ca', 'src/index.js'], { cwd: ROOT, stdio: 'inherit' });
  const self = child;
  child.on('exit', (code, sig) => {
    log(`Szerver leallt (code=${code} sig=${sig}).`);
    if (child === self) { child = null; writeStatus('leallt'); }
  });
  child.on('error', (e) => { log('Indit hiba: ' + e.message); if (child === self) child = null; });
  writeStatus('fut');
}

function killTree(pid) {
  return new Promise((res) => {
    const tk = spawn('taskkill', ['/PID', String(pid), '/T', '/F']);
    tk.on('exit', res);
    tk.on('error', res);
  });
}

async function stopServer() {
  if (!child) { log('Nem fut semmi.'); writeStatus('leallt'); return; }
  const pid = child.pid, self = child;
  child = null;
  log(`Leallitas (pid ${pid})...`);
  await killTree(pid);
  writeStatus('leallt');
}

async function restartServer() {
  if (restarting) { log('Ujrainditas mar folyamatban.'); return; }
  restarting = true;
  log('Ujrainditas...');
  await stopServer();
  await new Promise((r) => setTimeout(r, 1500)); // hagyjuk felszabadulni a portot
  startServer();
  restarting = false;
}

async function dispatch(cmd) {
  switch (cmd) {
    case 'indit':   startServer(); break;
    case 'ujra':    await restartServer(); break;
    case 'leallit': await stopServer(); break;
    default:        log('Ismeretlen parancs: ' + JSON.stringify(cmd));
  }
}

function poll() {
  let files;
  try { files = fs.readdirSync(CTRL).filter((f) => f.endsWith('.cmd')).sort(); }
  catch { return; }
  for (const f of files) {
    const fp = path.join(CTRL, f);
    let cmd;
    try { cmd = fs.readFileSync(fp, 'utf8').trim().toLowerCase(); }
    catch { continue; }              // lehet, hogy epp irjak -> kovetkezo korben
    try { fs.unlinkSync(fp); } catch {}
    if (cmd) { log('Parancs: ' + cmd); dispatch(cmd); }
  }
}

process.on('SIGINT', async () => { log('Felugyelo leall (Ctrl+C).'); await stopServer(); process.exit(0); });

log('Gazda felugyelo fut. Parancsok: indit / ujra / leallit. Varakozas...');
writeStatus('kesz');
setInterval(poll, 1000);
