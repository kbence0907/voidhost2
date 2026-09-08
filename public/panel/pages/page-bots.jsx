const BC_STEPS = [
  'Token ellenőrzése',
  'Bot adatok lekérése',
  'Bot regisztrálása',
];

const PORTAL_FIXES = {
  public_bot: {
    name: 'Publikus bot',
    desc: 'Ha be van kapcsolva, bárki behívhatja a botodat. Kapcsold ki, hogy csak te telepíthesd.',
    want: false,
  },
  code_grant: {
    name: 'OAuth2-kód megadása szükséges',
    desc: 'Ha be van kapcsolva, a bot nem tud csatlakozni telepítéskor.',
    want: false,
  },
  members_intent: {
    name: 'Szervertagok szándéka',
    desc: 'Kötelező ahhoz, hogy a botod fogadni tudja a GUILD_MEMBERS eseményeket (üdvözlő modul, tagkezelés).',
    want: true,
  },
  msg_content: {
    name: 'Üzenettartalom-szándék',
    desc: 'Kötelező ahhoz, hogy a botod olvasni tudja az üzenetek tartalmát (parancsok, statisztika).',
    want: true,
  },
};

function AddBotModal({ onClose, onAdded }) {
  const [token, setToken]     = useDState('');
  const [guildId, setGuildId] = useDState('');
  const [agreed, setAgreed]   = useDState(false);
  const [phase, setPhase]     = useDState('form');
  const [stepIdx, setStepIdx] = useDState(-1);
  const [doneSteps, setDoneSteps] = useDState([]);
  const [portalProblems, setPortalProblems] = useDState([]);

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function submit(e) {
    e.preventDefault();
    if (!token.trim() || !guildId.trim()) { toast('Minden mező kötelező.', 'err'); return; }
    if (!agreed) { toast('El kell fogadnod az ÁSZF-et és az Adatvédelmi Tájékoztatót.', 'err'); return; }

    setPhase('creating');
    setStepIdx(0);
    setDoneSteps([]);

    const t = localStorage.getItem('vh_token');
    const apiPromise = fetch('/api/bots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ token: token.trim(), guild_id: guildId.trim() }),
    }).then(async r => ({ ok: r.ok, data: await r.json() }));

    await sleep(520);
    setDoneSteps([0]);
    setStepIdx(1);

    await sleep(540);
    setDoneSteps([0, 1]);
    setStepIdx(2);

    const { ok, data } = await apiPromise;

    if (!ok) {
      setStepIdx(-1);
      setDoneSteps([]);
      if (data.code === 'portal_settings' && Array.isArray(data.problems) && data.problems.length) {
        setPortalProblems(data.problems);
        setPhase('portal-help');
      } else {
        setPhase('form');
        toast(data.error || 'Hiba történt.', 'err');
      }
      return;
    }

    setDoneSteps([0, 1, 2]);
    setStepIdx(-1);
    await sleep(220);
    setPhase('success');
    await sleep(1400);
    onAdded();
  }

  function stepState(i) {
    if (doneSteps.includes(i)) return 'done';
    if (stepIdx === i)         return 'active';
    return 'pending';
  }

  return (
    <div className="modal-overlay" onClick={phase === 'form' || phase === 'portal-help' ? onClose : undefined}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={phase === 'portal-help' ? {maxWidth:520,width:'100%'} : undefined}>

        {phase === 'form' && (
          <>
            <div className="modal-head">
              <h3>Új bot hozzáadása</h3>
              <button className="modal-close" onClick={onClose}>✕</button>
            </div>
            <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
              <div className="cfg-field">
                <label>Bot token</label>
                <input
                  className="cfg-input"
                  type="password"
                  placeholder="MTAxMjM0NTY3ODkwMTIz..."
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  autoComplete="off"
                />
                <div style={{fontSize:11,color:'var(--ink-faint)',marginTop:5}}>A Discord Developer Portalon a botod Bot → Token szekciójából.</div>
              </div>
              <div className="cfg-field">
                <label>Discord szerver ID</label>
                <input
                  className="cfg-input"
                  placeholder="1234567890123456789"
                  value={guildId}
                  onChange={e => setGuildId(e.target.value)}
                />
                <div style={{fontSize:11,color:'var(--ink-faint)',marginTop:5}}>A szerver ahol a botot használni fogod. A botnak már bent kell lennie.</div>
              </div>
              <label style={{display:'flex',alignItems:'flex-start',gap:9,fontSize:12.5,color:'var(--ink-faint)',lineHeight:1.5,cursor:'pointer'}}>
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{marginTop:2,flexShrink:0,width:15,height:15,accentColor:'var(--accent, #7aa2ff)',cursor:'pointer'}}/>
                <span>Elfogadom az <a href="/aszf" target="_blank" rel="noopener" style={{color:'var(--accent, #7aa2ff)'}}>ÁSZF-et</a> és az <a href="/adatvedelem" target="_blank" rel="noopener" style={{color:'var(--accent, #7aa2ff)'}}>Adatvédelmi Tájékoztatót</a>. A bot tokent titkosítva tároljuk.</span>
              </label>
              <button className="btn btn-primary" type="submit" style={{marginTop:4}} disabled={!agreed}>
                Bot hozzáadása
              </button>
            </form>
          </>
        )}

        {phase === 'creating' && (
          <>
            <div className="modal-head" style={{marginBottom:24}}>
              <h3>Bot létrehozása…</h3>
            </div>
            <div className="bc-steps">
              {BC_STEPS.map((label, i) => {
                const s = stepState(i);
                return (
                  <div key={i} className="bc-step" style={{animationDelay: `${i * 0.08}s`}}>
                    <div className={`bc-step-icon ${s}`}>
                      {s === 'done' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                      )}
                    </div>
                    <span className={`bc-step-label ${s}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {phase === 'portal-help' && (
          <>
            <div className="modal-head">
              <h3>A bot beállításai nem megfelelőek</h3>
              <button className="modal-close" onClick={onClose}>✕</button>
            </div>
            <div className="dc-help-intro">
              A botodat így nem lehet hozzáadni. Nyisd meg a <b>Discord Developer Portalon</b> az alkalmazásod <b>Bot</b> fülét, és állítsd be a kapcsolókat az alábbiak szerint:
            </div>
            <div className="dc-help-list">
              {portalProblems.map(key => {
                const f = PORTAL_FIXES[key];
                if (!f) return null;
                return (
                  <div key={key} className="dc-help-row">
                    <div className="dc-help-txt">
                      <div className="dc-help-name">{f.name}</div>
                      <div className="dc-help-desc">{f.desc}</div>
                    </div>
                    <div className="dc-help-state">
                      <span className={`dc-want ${f.want ? 'on' : 'off'}`}>{f.want ? 'Kapcsold BE' : 'Kapcsold KI'}</span>
                      <div className={`dc-toggle ${f.want ? 'on' : ''}`}><div className="knob" /></div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{display:'flex',gap:10,marginTop:18}}>
              <a className="btn" href="https://discord.com/developers/applications" target="_blank" rel="noopener">Fejlesztői Portál megnyitása →</a>
              <button className="btn btn-primary" style={{flex:1,justifyContent:'center'}} onClick={() => setPhase('form')}>Kész, próbáljuk újra</button>
            </div>
          </>
        )}

        {phase === 'success' && (
          <div className="bc-success">
            <div className="bc-success-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <div className="bc-success-title">Bot sikeresen hozzáadva!</div>
            <div className="bc-success-sub">A bot megjelenik a listában.</div>
          </div>
        )}

      </div>
    </div>
  );
}

function BotsPage({ bots, openBot, onAddBot, maxBots }) {
  const [showModal, setShowModal] = useDState(false);
  const limitReached = maxBots > 0 && bots.length >= maxBots;

  function handleAdded() {
    setShowModal(false);
    onAddBot();
  }

  return (
    <>
      {showModal && <AddBotModal onClose={() => setShowModal(false)} onAdded={handleAdded} />}

      <div className="page-head">
        <div>
          <h1 className="page-title">Saját botok</h1>
          <div className="page-sub">A te tokeneddel futó botok. A funkciók a saját botod neve alatt jelennek meg.</div>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-primary"
            onClick={() => !limitReached && setShowModal(true)}
            disabled={limitReached}
            title={limitReached ? `Elérted a korlátot (${bots.length}/${maxBots} bot)` : ''}
            style={limitReached ? {opacity:.45,cursor:'not-allowed'} : {}}
          >{ICO.plus} Új bot {limitReached ? `(${bots.length}/${maxBots})` : ''}</button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          {ICO.search}
          <input placeholder="Keresés bot név vagy ID alapján..." />
        </div>
      </div>

      <div className="bot-grid">
        {bots.map(b => {
          const short = b.bot_name ? b.bot_name[0].toUpperCase() : '?';
          return (
            <div key={b.id} className="bot-card" onClick={() => openBot(b)}>
              <div className="top">
                {b.bot_avatar
                  ? <img src={b.bot_avatar} alt={b.bot_name} style={{width:44,height:44,borderRadius:12,objectFit:'cover',flexShrink:0}} />
                  : <div className="av">{short}</div>
                }
                <div>
                  <div className="name">{b.bot_name}</div>
                  <div className="id" style={{fontFamily:"'JetBrains Mono',monospace"}}>{b.bot_id}</div>
                </div>
              </div>
              <div className="stats" style={{borderTop:'1px solid var(--line)',paddingTop:10,marginTop:10}}>
                <span><b>{b.guild_name || b.guild_id}</b></span>
              </div>
              <div className="stats">
                <span><b>{b.guild_member_count?.toLocaleString('hu-HU') ?? 0}</b> tag</span>
                <span><b>{b.cmd_count ?? 0}</b> parancs</span>
              </div>
            </div>
          );
        })}
        {!limitReached && (
          <div className="bot-card new" onClick={() => setShowModal(true)}>
            <div className="plus">+</div>
            <div style={{fontSize:14,fontWeight:500,color:'var(--ink)'}}>Új bot hozzáadása</div>
            <div style={{fontSize:12,color:'var(--ink-faint)'}}>Token + szerver ID megadása</div>
          </div>
        )}
        {limitReached && (
          <div className="bot-card new" style={{cursor:'default',opacity:.5}}>
            <div className="plus" style={{fontSize:18,color:'var(--ink-faint)'}}>⊘</div>
            <div style={{fontSize:13,fontWeight:500,color:'var(--ink)'}}>Bot korlát elérve</div>
            <div style={{fontSize:12,color:'var(--ink-faint)'}}>{bots.length}/{maxBots} bot · rang feltétel</div>
          </div>
        )}
      </div>
    </>
  );
}
