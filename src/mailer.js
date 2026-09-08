import nodemailer from 'nodemailer';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.MAIL_HOST  ?? 'smtp.gmail.com',
    port:   Number(process.env.MAIL_PORT ?? '587'),
    secure: false,
    auth: {
      user: process.env.MAIL_USER ?? '',
      pass: process.env.MAIL_PASS ?? '',
    },
  });
}

export async function sendBotAccessEmail(to, { botName, ownerName }) {
  const from = process.env.MAIL_FROM ?? 'VoidHost <noreply@voidhost.hu>';
  const transport = createTransport();
  try {
    await transport.sendMail({
      from,
      to,
      subject: `Hozzáadtak a(z) ${botName} bothoz`,
      html: `
        <div style="font-family:Inter,sans-serif;background:#050818;padding:40px;border-radius:16px;max-width:480px;margin:auto">
          <h2 style="color:#fff;margin:0 0 16px">Bot hozzáférés</h2>
          <p style="color:#8b94b8;margin:0 0 20px"><b style="color:#fff">${esc(ownerName)}</b> hozzáadott téged a(z) <b style="color:#fff">${esc(botName)}</b> bothoz a VoidHost panelen.</p>
          <p style="color:#8b94b8;margin:0 0 20px">A botot mostantól a <b style="color:#fff">Megosztott botok</b> szekcióban éred el a panelen.</p>
          <p style="color:#5a6388;font-size:13px;margin-top:24px">Ha ez nem te voltál, hagyd figyelmen kívül ezt az emailt.</p>
        </div>`,
    });
  } catch (err) {
    console.warn('Email küldési hiba:', to, err);
  }
}

export async function sendAccountLockedEmail(to, { name, unlockDate }) {
  const from = process.env.MAIL_FROM ?? 'VoidHost <noreply@voidhost.hu>';
  const transport = createTransport();
  const dateStr = new Date(unlockDate).toLocaleString('hu-HU', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  try {
    await transport.sendMail({
      from, to,
      subject: 'Fiókodat zárolták',
      html: `
        <div style="font-family:Inter,sans-serif;background:#050818;padding:40px;border-radius:16px;max-width:480px;margin:auto">
          <h2 style="color:#ff6b81;margin:0 0 16px">Fiók zárolva</h2>
          <p style="color:#8b94b8;margin:0 0 12px">Kedves <b style="color:#fff">${esc(name)}</b>,</p>
          <p style="color:#8b94b8;margin:0 0 12px">Fiókodat a VoidHost adminisztrátorai zárolták. <b style="color:#fff">${esc(dateStr)}</b>-ig nem tudsz belépni.</p>
          <p style="color:#8b94b8;margin:0 0 20px">Ha úgy véled, ez tévedés, fellebbezhetsz a Discord szerverünkön.</p>
          <p style="color:#5a6388;font-size:13px">VoidHost csapat</p>
        </div>`,
    });
  } catch (err) { console.warn('Email küldési hiba:', to, err); }
}

export async function sendTwoFAFailEmail(to, { name, ip }) {
  const from = process.env.MAIL_FROM ?? 'VoidHost <noreply@voidhost.hu>';
  const transport = createTransport();
  const dateStr = new Date().toLocaleString('hu-HU');
  try {
    await transport.sendMail({
      from, to,
      subject: 'Gyanús bejelentkezési kísérlet',
      html: `
        <div style="font-family:Inter,sans-serif;background:#050818;padding:40px;border-radius:16px;max-width:480px;margin:auto">
          <h2 style="color:#f87171;margin:0 0 16px">Gyanús belépési kísérlet</h2>
          <p style="color:#8b94b8;margin:0 0 12px">Kedves <b style="color:#fff">${esc(name)}</b>,</p>
          <p style="color:#8b94b8;margin:0 0 12px">Valaki sikertelenül próbált belépni a fiókodhoz kétlépéses hitelesítéssel.</p>
          <div style="background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.2);border-radius:10px;padding:14px 18px;margin:16px 0">
            <div style="color:#8b94b8;font-size:13px;margin-bottom:4px">Időpont</div>
            <div style="color:#fff;font-weight:600">${esc(dateStr)}</div>
            ${ip ? `<div style="color:#8b94b8;font-size:13px;margin-top:8px;margin-bottom:4px">IP cím</div><div style="color:#fff;font-weight:600">${esc(ip)}</div>` : ''}
          </div>
          <p style="color:#8b94b8;margin:0 0 20px">Ha ez te voltál, hagyd figyelmen kívül. Ha nem, javasoljuk a jelszavad azonnali megváltoztatását.</p>
          <p style="color:#5a6388;font-size:13px">VoidHost csapat</p>
        </div>`,
    });
  } catch (err) { console.warn('Email küldési hiba:', to, err); }
}

export async function sendEmailChangeCode(to, { name, code }) {
  const from = process.env.MAIL_FROM ?? 'VoidHost <noreply@voidhost.hu>';
  const transport = createTransport();
  try {
    await transport.sendMail({
      from, to,
      subject: 'Email cím megerősítés',
      html: `
        <div style="font-family:Inter,sans-serif;background:#050818;padding:40px;border-radius:16px;max-width:480px;margin:auto">
          <h2 style="color:#fff;margin:0 0 16px">Email cím megerősítés</h2>
          <p style="color:#8b94b8;margin:0 0 12px">Kedves <b style="color:#fff">${esc(name)}</b>,</p>
          <p style="color:#8b94b8;margin:0 0 24px">Az alábbi kóddal erősítsd meg az új email címedet. A kód <b style="color:#fff">5 percig</b> érvényes.</p>
          <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:20px;text-align:center;font-size:36px;font-weight:700;letter-spacing:12px;color:#fff">${esc(code)}</div>
          <p style="color:#5a6388;font-size:13px;margin-top:20px">Ha nem kérted, hagyd figyelmen kívül. Az email cím nem változik meg.</p>
        </div>`,
    });
  } catch (err) { console.warn('Email küldési hiba:', to, err); }
}

export async function sendBannedEmail(to, { name, reason }) {
  const from = process.env.MAIL_FROM ?? 'VoidHost <noreply@voidhost.hu>';
  const transport = createTransport();
  try {
    await transport.sendMail({
      from, to,
      subject: 'Fiókodat kitiltották',
      html: `
        <div style="font-family:Inter,sans-serif;background:#050818;padding:40px;border-radius:16px;max-width:480px;margin:auto">
          <h2 style="color:#f87171;margin:0 0 16px">Fiók kitiltva</h2>
          <p style="color:#8b94b8;margin:0 0 12px">Kedves <b style="color:#fff">${esc(name)}</b>,</p>
          <p style="color:#8b94b8;margin:0 0 12px">Fiókodat a VoidHost adminisztrátorai kitiltották a rendszerből. Többé nem tudsz bejelentkezni.</p>
          ${reason ? `<div style="background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.2);border-radius:10px;padding:14px 18px;margin:16px 0"><span style="color:#8b94b8;font-size:13px">Indok:</span><br/><span style="color:#fff;font-weight:600">${esc(reason)}</span></div>` : ''}
          <p style="color:#8b94b8;margin:0 0 20px">Ha úgy véled, ez tévedés, fellebbezhetsz a Discord szerverünkön.</p>
          <p style="color:#5a6388;font-size:13px">VoidHost csapat</p>
        </div>`,
    });
  } catch (err) { console.warn('Email küldési hiba:', to, err); }
}

export async function sendUnbannedEmail(to, { name }) {
  const from = process.env.MAIL_FROM ?? 'VoidHost <noreply@voidhost.hu>';
  const transport = createTransport();
  try {
    await transport.sendMail({
      from, to,
      subject: 'Kitiltásod feloldva',
      html: `
        <div style="font-family:Inter,sans-serif;background:#050818;padding:40px;border-radius:16px;max-width:480px;margin:auto">
          <h2 style="color:#4ade80;margin:0 0 16px">Kitiltás feloldva</h2>
          <p style="color:#8b94b8;margin:0 0 12px">Kedves <b style="color:#fff">${esc(name)}</b>,</p>
          <p style="color:#8b94b8;margin:0 0 20px">Fiókodat az adminisztrációs csapat feloldotta, ismét bejelentkezhetsz a VoidHost panelre.</p>
          <p style="color:#5a6388;font-size:13px">VoidHost csapat</p>
        </div>`,
    });
  } catch (err) { console.warn('Email küldési hiba:', to, err); }
}

export async function sendPasswordResetEmail(to, { name, code }) {
  const from = process.env.MAIL_FROM ?? 'VoidHost <noreply@voidhost.hu>';
  const origin = process.env.FRONTEND_ORIGIN?.split(',')[0]?.trim() ?? 'https://voidhost.hu';
  const link = `${origin}/panel/auth?pwreset=${encodeURIComponent(code)}&email=${encodeURIComponent(to)}`;
  const transport = createTransport();
  try {
    await transport.sendMail({
      from, to,
      subject: 'Jelszó visszaállítás',
      html: `
        <div style="font-family:Inter,sans-serif;background:#050818;padding:40px;border-radius:16px;max-width:480px;margin:auto">
          <h2 style="color:#fff;margin:0 0 16px">Jelszó visszaállítás</h2>
          <p style="color:#8b94b8;margin:0 0 12px">Kedves <b style="color:#fff">${esc(name)}</b>,</p>
          <p style="color:#8b94b8;margin:0 0 24px">Jelszó visszaállítást igényeltek a fiókodhoz. Kattints az alábbi gombra az új jelszó beállításához:</p>
          <a href="${link}" style="display:block;background:#6c63ff;border-radius:12px;padding:16px;text-align:center;font-size:16px;font-weight:700;color:#fff;text-decoration:none">Új jelszó beállítása</a>
          <p style="color:#5a6388;font-size:12px;margin-top:16px;word-break:break-all">Ha a gomb nem működik, másold be ezt a címet a böngészőbe:<br/><a href="${link}" style="color:#7aa2ff">${link}</a></p>
          <p style="color:#5a6388;font-size:13px;margin-top:20px">A link 1 óráig érvényes. Ha nem te kérted, hagyd figyelmen kívül.</p>
        </div>`,
    });
  } catch (err) { console.warn('Email küldési hiba:', to, err); }
}

export async function sendApprovalPendingEmail(to, { name, applicantName, applicantEmail }) {
  const from = process.env.MAIL_FROM ?? 'VoidHost <noreply@voidhost.hu>';
  const origin = process.env.FRONTEND_ORIGIN?.split(',')[0]?.trim() ?? 'https://voidhost.hu';
  const transport = createTransport();
  try {
    await transport.sendMail({
      from, to,
      subject: 'Új fiók jóváhagyásra vár',
      html: `
        <div style="font-family:Inter,sans-serif;background:#050818;padding:40px;border-radius:16px;max-width:480px;margin:auto">
          <h2 style="color:#fff;margin:0 0 16px">Jóváhagyásra váró regisztráció</h2>
          <p style="color:#8b94b8;margin:0 0 12px">Kedves <b style="color:#fff">${esc(name)}</b>,</p>
          <p style="color:#8b94b8;margin:0 0 12px">Egy új felhasználó regisztrált és jóváhagyásra vár:</p>
          <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:14px 18px;margin:16px 0">
            <div style="color:#fff;font-weight:600">${esc(applicantName)}</div>
            <div style="color:#8b94b8;font-size:13px;margin-top:4px">${esc(applicantEmail)}</div>
          </div>
          <a href="${origin}/panel" style="display:block;background:#6c63ff;border-radius:12px;padding:14px;text-align:center;font-size:15px;font-weight:700;color:#fff;text-decoration:none">Megnyitás a panelen</a>
          <p style="color:#5a6388;font-size:13px;margin-top:20px">A Jóváhagyás oldalon tudod jóváhagyni vagy elutasítani.</p>
        </div>`,
    });
  } catch (err) { console.warn('Email küldési hiba:', to, err); }
}

export async function sendApprovedEmail(to, { name }) {
  const from = process.env.MAIL_FROM ?? 'VoidHost <noreply@voidhost.hu>';
  const origin = process.env.FRONTEND_ORIGIN?.split(',')[0]?.trim() ?? 'https://voidhost.hu';
  const transport = createTransport();
  try {
    await transport.sendMail({
      from, to,
      subject: 'Fiókod jóváhagyva',
      html: `
        <div style="font-family:Inter,sans-serif;background:#050818;padding:40px;border-radius:16px;max-width:480px;margin:auto">
          <h2 style="color:#4ade80;margin:0 0 16px">Fiók jóváhagyva</h2>
          <p style="color:#8b94b8;margin:0 0 12px">Kedves <b style="color:#fff">${esc(name)}</b>,</p>
          <p style="color:#8b94b8;margin:0 0 20px">A fiókodat egy adminisztrátor jóváhagyta. Mostantól bejelentkezhetsz a VoidHost panelre.</p>
          <a href="${origin}/panel/auth" style="display:block;background:#6c63ff;border-radius:12px;padding:14px;text-align:center;font-size:15px;font-weight:700;color:#fff;text-decoration:none">Bejelentkezés</a>
          <p style="color:#5a6388;font-size:13px;margin-top:20px">VoidHost csapat</p>
        </div>`,
    });
  } catch (err) { console.warn('Email küldési hiba:', to, err); }
}

export async function sendRejectedEmail(to, { name, reason }) {
  const from = process.env.MAIL_FROM ?? 'VoidHost <noreply@voidhost.hu>';
  const transport = createTransport();
  try {
    await transport.sendMail({
      from, to,
      subject: 'Regisztrációd elutasítva',
      html: `
        <div style="font-family:Inter,sans-serif;background:#050818;padding:40px;border-radius:16px;max-width:480px;margin:auto">
          <h2 style="color:#ff6b81;margin:0 0 16px">Regisztráció elutasítva</h2>
          <p style="color:#8b94b8;margin:0 0 12px">Kedves <b style="color:#fff">${esc(name)}</b>,</p>
          <p style="color:#8b94b8;margin:0 0 12px">A VoidHost panelre beadott regisztrációdat egy adminisztrátor elutasította.</p>
          ${reason ? `<div style="background:rgba(255,107,129,.08);border:1px solid rgba(255,107,129,.2);border-radius:10px;padding:14px 18px;margin:16px 0"><span style="color:#8b94b8;font-size:13px">Indok:</span><br/><span style="color:#fff;font-weight:600">${esc(reason)}</span></div>` : ''}
          <p style="color:#8b94b8;margin:0 0 20px">Ha úgy véled, ez tévedés, keress minket a Discord szerverünkön.</p>
          <p style="color:#5a6388;font-size:13px">VoidHost csapat</p>
        </div>`,
    });
  } catch (err) { console.warn('Email küldési hiba:', to, err); }
}

export async function sendVerificationEmail(to, code) {
  const from = process.env.MAIL_FROM ?? 'VoidHost <noreply@voidhost.hu>';
  const transport = createTransport();
  try {
    await transport.sendMail({
      from,
      to,
      subject: 'Email hitelesítés',
      html: `
        <div style="font-family:Inter,sans-serif;background:#050818;padding:40px;border-radius:16px;max-width:480px;margin:auto">
          <h2 style="color:#fff;margin:0 0 16px">VoidHost hitelesítés</h2>
          <p style="color:#8b94b8;margin:0 0 24px">A kódod az email ellenőrzéséhez:</p>
          <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:20px;text-align:center;font-size:36px;font-weight:700;letter-spacing:12px;color:#fff">${esc(code)}</div>
          <p style="color:#5a6388;font-size:13px;margin-top:20px">Ez a kód 15 percig érvényes. Ne oszd meg senkivel.</p>
        </div>`,
    });
  } catch (err) {
    console.warn('Email küldési hiba:', to, err);
  }
}
