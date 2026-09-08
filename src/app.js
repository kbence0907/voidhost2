import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { rateLimit } from 'express-rate-limit';
import authRouter from './routes/auth.js';
import apiRouter from './routes/api.js';
import { startBot } from './bot.js';

startBot();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TRUST_PROXY = process.env.TRUST_PROXY ?? '';
if (TRUST_PROXY === 'true' || TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
} else if (TRUST_PROXY === 'false' || TRUST_PROXY === '0') {
  app.set('trust proxy', false);
} else if (TRUST_PROXY) {
  app.set('trust proxy', TRUST_PROXY);
} else {
  app.set('trust proxy', 'loopback');
}

app.disable('x-powered-by');

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (process.env.ENABLE_HSTS === '1' || process.env.ENABLE_HSTS === 'true') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://cdn.discordapp.com; connect-src 'self' https://unpkg.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
  );
  next();
});

const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? '')
  .split(',').map(s => s.trim()).filter(Boolean);
app.use(cors(allowedOrigins.length
  ? { origin: allowedOrigins, credentials: false }
  : false
));

app.use(rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Túl sok kérés. Próbáld újra később.' },
}));

app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));
app.get('/panel/auth.html', (_req, res) => res.redirect(301, '/panel/auth'));
app.get('/panel/Voidhost Panel.html', (_req, res) => res.redirect(301, '/panel'));
app.get('/panel/dashboard.html', (_req, res) => res.redirect(301, '/panel'));
app.get('/index.html', (_req, res) => res.redirect(301, '/'));

app.get('/panel/auth', (_req, res) => res.sendFile(path.join(__dirname, '../public/panel/auth.html')));
app.get('/panel', (_req, res) => res.sendFile(path.join(__dirname, '../public/panel/dashboard.html')));

app.use(express.static(path.join(__dirname, '../public'), { extensions: ['html'] }));

app.use('/auth', authRouter);
app.use('/api', apiRouter);

app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'A kérés túl nagy.' });
  }
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Érvénytelen JSON.' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Belső szerverhiba.' });
});

export default app;
