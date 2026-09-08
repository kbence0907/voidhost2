const { useState, useEffect, useMemo } = React;

const Eye = ({ open }) => (
  open ? (
    <svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
  ) : (
    <svg viewBox="0 0 24 24"><path d="M3 3l18 18"/><path d="M10.6 6.2A10 10 0 0112 6c6.5 0 10 7 10 7a16 16 0 01-3.5 4.2"/><path d="M6.6 7.4A16 16 0 002 13s3.5 6 10 6c1.6 0 3-.3 4.3-.8"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/></svg>
  )
);

const ArrowSwap = () => (
  <svg viewBox="0 0 24 24"><path d="M7 7h11M14 3l4 4-4 4M17 17H6M10 21l-4-4 4-4"/></svg>
);

const DCMark = () => (
  <span className="dc-badge">DC</span>
);

function strengthOf(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}
const strengthLabels = ['', 'gyenge', 'közepes', 'jó', 'erős'];

function LoginForm({ onSubmit }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);

  const valid = email.includes('@') && pw.length >= 6;

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit && onSubmit({email}); }}>
      <button type="button" className="btn-discord">
        <DCMark />
        Folytatás Discorddal
      </button>

      <div className="auth-divider">vagy email-lel</div>

      <div className="field-group">
        <div>
          <div className="field-label">Email</div>
          <input
            type="email"
            className="field-input"
            placeholder="te@valami.hu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div>
          <div className="field-label">
            <span>Jelszó</span>
            <a href="#">Elfelejtetted?</a>
          </div>
          <div className="password-wrap">
            <input
              type={showPw ? 'text' : 'password'}
              className="field-input"
              placeholder="••••••••"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="current-password"
              style={{paddingRight: 40}}
            />
            <button type="button" className="eye" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
              <Eye open={showPw} />
            </button>
          </div>
        </div>

        <label className={`checkbox-row ${remember ? 'checked' : ''}`} onClick={() => setRemember(v => !v)}>
          <span className="box"></span>
          <span>Maradjak bejelentkezve ezen a gépen 30 napig.</span>
        </label>
      </div>

      <button type="submit" className="auth-submit" disabled={!valid}>
        Belépés <span className="arr">→</span>
      </button>
    </form>
  );
}

function RegisterForm({ onSubmit }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [accept, setAccept] = useState(false);

  const s = strengthOf(pw);
  const pwMatch = pw && pw === pw2;
  const valid = email.includes('@') && name.length >= 3 && s >= 2 && pwMatch && accept;

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit && onSubmit({email, name}); }}>
      <button type="button" className="btn-discord">
        <DCMark />
        Regisztráció Discorddal
      </button>

      <div className="auth-divider">vagy kézzel</div>

      <div className="field-group">
        <div>
          <div className="field-label">Felhasználónév</div>
          <input
            type="text"
            className="field-input"
            placeholder="pl. lexonix"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div>
          <div className="field-label">Email</div>
          <input
            type="email"
            className="field-input"
            placeholder="te@valami.hu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div>
          <div className="field-label">Jelszó</div>
          <div className="password-wrap">
            <input
              type={showPw ? 'text' : 'password'}
              className="field-input"
              placeholder="legalább 8 karakter"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="new-password"
              style={{paddingRight: 40}}
            />
            <button type="button" className="eye" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
              <Eye open={showPw} />
            </button>
          </div>
          <div className={`field-strength s${s}`}>
            <i></i><i></i><i></i><i></i>
          </div>
          {pw && <div className="strength-label">{`Erősség: ${strengthLabels[s]}`}</div>}
        </div>
        <div>
          <div className="field-label">Jelszó újra</div>
          <input
            type={showPw ? 'text' : 'password'}
            className={`field-input ${pw2 && !pwMatch ? 'invalid' : ''}`}
            placeholder="ugyanaz, mint fent"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        <label className={`checkbox-row ${accept ? 'checked' : ''}`} onClick={() => setAccept(v => !v)}>
          <span className="box"></span>
          <span>Elolvastam és elfogadom az <a href="#" onClick={(e)=>e.stopPropagation()}>Általános Feltételeket</a> és az <a href="#" onClick={(e)=>e.stopPropagation()}>Adatvédelmi nyilatkozatot</a>.</span>
        </label>
      </div>

      <button type="submit" className="auth-submit" disabled={!valid}>
        Fiók létrehozása <span className="arr">→</span>
      </button>
    </form>
  );
}

function ResetForm({ onDone }) {
  const [email, setEmail] = useState('');
  const [code, setCode]   = useState('');
  const [pw, setPw]       = useState('');
  const [pw2, setPw2]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [ok, setOk]           = useState(false);
  const s = strengthOf(pw);
  const valid = email.includes('@') && code.length === 6 && s >= 2 && pw === pw2;

  async function submit(e) {
    e.preventDefault();
    if (!valid) return;
    setLoading(true); setError('');
    const r = await fetch('/auth/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, password: pw }),
    }).catch(() => null);
    setLoading(false);
    if (!r?.ok) { const d = await r?.json().catch(() => ({})); setError(d?.error || 'Hiba.'); return; }
    setOk(true);
  }

  if (ok) return (
    <div style={{textAlign:'center',padding:'20px 0'}}>
      <div style={{fontSize:32,marginBottom:12}}>✓</div>
      <div style={{fontWeight:600,marginBottom:8}}>Jelszó megváltoztatva!</div>
      <button className="auth-submit" style={{marginTop:16}} onClick={onDone}>Belépés →</button>
    </div>
  );

  return (
    <form onSubmit={submit}>
      <div className="field-group">
        <div>
          <div className="field-label">Email</div>
          <input type="email" className="field-input" placeholder="te@valami.hu" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <div className="field-label">Visszaállítási kód <span style={{color:'rgba(255,255,255,.35)',fontSize:11}}>(emailben kaptad)</span></div>
          <input className="field-input" placeholder="123456" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g,''))} />
        </div>
        <div>
          <div className="field-label">Új jelszó</div>
          <input type="password" className="field-input" placeholder="••••••••" value={pw} onChange={e => setPw(e.target.value)} />
          {pw && <div className={`strength s${s}`} style={{height:3,borderRadius:2,marginTop:4,background:['#333','#f87171','#fb923c','#4ade80','#22d3ee'][s],transition:'all .2s'}} />}
        </div>
        <div>
          <div className="field-label">Jelszó megerősítése</div>
          <input type="password" className="field-input" placeholder="••••••••" value={pw2} onChange={e => setPw2(e.target.value)} />
        </div>
      </div>
      {error && <div style={{color:'#f87171',fontSize:13,marginBottom:12,background:'rgba(248,113,113,.08)',border:'1px solid rgba(248,113,113,.2)',borderRadius:8,padding:'8px 12px'}}>{error}</div>}
      <button className="auth-submit" type="submit" disabled={!valid || loading}>{loading ? 'Feldolgozás...' : 'Jelszó megváltoztatása'}</button>
    </form>
  );
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [transitioning, setTransitioning] = useState(false);

  const swap = () => {
    setTransitioning(true);
    setTimeout(() => {
      setMode(m => m === 'login' ? 'register' : 'login');
      setTransitioning(false);
    }, 220);
  };

  return (
    <div className="auth-wrap">
      <div className="auth-top">
        <span className="brand-name">VOIDHOST</span>
        <span>Segítség kell? <a href="#">Discordon szólj</a></span>
      </div>

      <div className="auth-card">
        <div className="auth-head">
          <div>
            <div className="eyebrow">// {mode === 'login' ? 'Belépés' : mode === 'register' ? 'Regisztráció' : 'Jelszó visszaállítás'}</div>
            <h2 style={{marginTop: 8}}>
              {mode === 'login' ? <>Üdv vissza, <em>parancsnok</em>.</> : mode === 'register' ? <>Csatlakozz a <em>voidhost</em>-hoz.</> : <>Új <em>jelszó</em> beállítása.</>}
            </h2>
          </div>
          {mode !== 'reset' && (
            <button className={`auth-swap ${mode === 'register' ? 'flipped' : ''}`} onClick={swap} title={mode === 'login' ? 'Váltás regisztrációra' : 'Váltás belépésre'}>
              <ArrowSwap />
            </button>
          )}
        </div>

        {mode !== 'reset' && (
          <div className="auth-tabs">
            <div className="indicator" style={{ left: mode === 'login' ? 4 : 'calc(50% + 0px)' }}></div>
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => mode !== 'login' && swap()}>Belépés</button>
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => mode !== 'register' && swap()}>Regisztráció</button>
          </div>
        )}

        <div style={{ opacity: transitioning ? 0 : 1, transform: transitioning ? `translateX(${mode === 'login' ? -16 : 16}px)` : 'translateX(0)', transition: 'opacity .22s ease, transform .22s ease' }}>
          {mode === 'login'    && <LoginForm onSubmit={onAuth} />}
          {mode === 'register' && <RegisterForm onSubmit={onAuth} />}
          {mode === 'reset'    && <ResetForm onDone={() => setMode('login')} />}
        </div>

        <div className="auth-foot">
          {mode === 'login'    && <><button onClick={() => setMode('reset')} style={{color:'rgba(255,255,255,.5)'}}>Elfejtetted a jelszavad?</button> · <button onClick={swap}>Regisztrálj →</button></>}
          {mode === 'register' && <>Már van fiókod? <button onClick={swap}>← Lépj be</button></>}
          {mode === 'reset'    && <><button onClick={() => setMode('login')}>← Vissza a belépéshez</button></>}
        </div>
      </div>
    </div>
  );
}

window.AuthScreen = AuthScreen;
