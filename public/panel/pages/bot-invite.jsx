const WELCOME_DEF = {
  welcome: { enabled: false, channelId: '', type: 'plain', message: 'Üdvözlünk a szerveren, {user}! 🎮', embedColor: '#5865f2', embedTitle: '', embedFooter: '', pingBefore: false, showAvatar: true },
  dm:      { enabled: false, message: 'Szia {user}! Köszi, hogy csatlakoztál a {server} szerverhez.' },
  leave:   { enabled: false, channelId: '', type: 'plain', message: '{user} elhagyta a szerverünket. 👋', embedColor: '#ff6b81', embedTitle: '', embedFooter: '', pingBefore: false, showAvatar: false },
};

function MsgPreview({ section }) {
  const { type, message, embedColor, embedTitle, embedFooter, pingBefore, showAvatar } = section;
  const previewText = (message || '')
    .replace(/{user}/g,   '@ÚjTag_1234')
    .replace(/{nuser}/g,  'ÚjTag_1234')
    .replace(/{server}/g, 'Szerver neve')
    .replace(/{all}/g,    '1 234')
    .replace(/{time}/g,   new Date().toLocaleString('hu-HU'));

  const outer = {marginTop:10,fontSize:12.5,lineHeight:'1.6'};

  return (
    <div style={outer}>
      {pingBefore && (
        <div style={{color:'rgba(255,255,255,0.45)',marginBottom:5,fontSize:12,fontStyle:'italic'}}>
          ↑ külön üzenet: <span style={{color:'#a78bfa',fontStyle:'normal'}}>@ÚjTag_1234</span>
        </div>
      )}
      {type === 'embed' ? (
        <div style={{background:'#2b2d31',borderRadius:8,overflow:'hidden',border:'1px solid rgba(255,255,255,0.06)'}}>
          <div style={{display:'flex',gap:12,padding:'10px 14px',borderLeft:`4px solid ${embedColor || '#5865f2'}`}}>
            <div style={{flex:1,minWidth:0}}>
              {embedTitle && <div style={{fontWeight:700,fontSize:14,color:'#fff',marginBottom:5}}>{embedTitle}</div>}
              <div style={{color:'#dbdee1',whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
                {previewText || <span style={{color:'rgba(255,255,255,0.3)'}}>— üres leírás —</span>}
              </div>
              {embedFooter && (
                <div style={{marginTop:8,paddingTop:6,borderTop:'1px solid rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.38)',fontSize:11}}>
                  {embedFooter}
                </div>
              )}
            </div>
            {showAvatar && (
              <div style={{flexShrink:0,width:44,height:44,borderRadius:'50%',background:'linear-gradient(135deg,#6c63ff,#a78bfa)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,color:'#fff',fontWeight:700}}>Ú</div>
            )}
          </div>
        </div>
      ) : (
        <div style={{background:'#2b2d31',borderRadius:8,padding:'10px 14px',border:'1px solid rgba(255,255,255,0.06)',color:'#dbdee1',whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
          {previewText || <span style={{color:'rgba(255,255,255,0.3)'}}>— üres —</span>}
        </div>
      )}
    </div>
  );
}

const VARS_HINT = (
  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
    {['{user}','{nuser}','{server}','{all}','{time}'].map(v => (
      <code key={v} style={{fontSize:11,background:'rgba(108,99,255,0.12)',border:'1px solid rgba(108,99,255,0.25)',borderRadius:4,padding:'1px 6px',color:'#a78bfa'}}>{v}</code>
    ))}
  </div>
);

const ACT_BTN = (active) => active
  ? {background:'rgba(108,99,255,0.18)',borderColor:'rgba(108,99,255,0.5)',color:'#a78bfa'}
  : {};

function InvitePage({ bot, goBack, onUnsaved, moduleOn = true, onToggleModule }) {
  const [cfg, setCfg]         = useDState(null);
  const [orig, setOrig]       = useDState(null);
  const [loading, setLoading] = useDState(true);
  const [saving, setSaving]   = useDState(false);

  useDEffect(() => {
    const t = localStorage.getItem('vh_token');
    fetch(`/api/bots/${bot.id}/welcome`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const merge = (def, src) => ({ ...def, ...(src || {}) });
        const c = data ? {
          welcome: merge(WELCOME_DEF.welcome, data.welcome),
          dm:      merge(WELCOME_DEF.dm,      data.dm),
          leave:   merge(WELCOME_DEF.leave,   data.leave),
        } : { ...WELCOME_DEF };
        setCfg(c); setOrig(JSON.parse(JSON.stringify(c)));
      })
      .catch(() => {
        const c = JSON.parse(JSON.stringify(WELCOME_DEF));
        setCfg(c); setOrig(c);
      })
      .finally(() => setLoading(false));
    return () => onUnsaved(false);
  }, [bot.id]);

  const dirty = useDMemo(() => cfg && orig && JSON.stringify(cfg) !== JSON.stringify(orig), [cfg, orig]);
  useDEffect(() => { onUnsaved(!!dirty); }, [dirty]);

  function set(sec, key, val) {
    setCfg(prev => {
      const next = { ...prev, [sec]: { ...prev[sec], [key]: val } };
      return next;
    });
  }

  function resetInvite() { setCfg(JSON.parse(JSON.stringify(orig))); }

  async function saveInvite() {
    setSaving(true);
    const snap = JSON.parse(JSON.stringify(cfg));
    const t = localStorage.getItem('vh_token');
    const r = await fetch(`/api/bots/${bot.id}/welcome`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify(snap),
    }).catch(() => null);
    if (r?.ok) { setOrig(snap); }
    else { toast('Mentési hiba, próbáld újra.', 'err'); }
    setSaving(false);
  }

  if (loading) return <SkeletonCards />;

  const anyActive = cfg.welcome.enabled || cfg.dm.enabled || cfg.leave.enabled;
  const W = cfg.welcome;
  const D = cfg.dm;
  const L = cfg.leave;

  return (
    <>
      <div className="page-head">
        <div>
          <button className="page-back" onClick={goBack}>{ICO.back} Vissza</button>
          <h1 className="page-title">Üdvözlő modul</h1>
          <div className="page-sub">Üdvözlés, búcsú, privát DM.</div>
        </div>
        <div className="page-actions" style={{alignItems:'center',gap:12}}>
          <span className={`status-pill ${moduleOn ? 'live' : 'off'}`}>
            <span className="pdot"></span>{moduleOn ? (anyActive ? 'Aktív' : 'Bekapcsolva') : 'Kikapcsolva'}
          </span>
          <div className={`toggle ${moduleOn ? 'on' : ''}`} onClick={onToggleModule} style={{cursor:'pointer'}} title={moduleOn ? 'Modul kikapcsolása' : 'Modul bekapcsolása'}></div>
        </div>
      </div>

      <div className={`module-body ${moduleOn ? '' : 'module-off'}`}>

      <div style={{fontSize:12,color:'var(--ink-faint)',marginBottom:20,display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
        <span>Elérhető változók:</span>{VARS_HINT}
      </div>

      <div className="config-grid">

        <div className="cfg-card">
          <div className="cfg-head"><div className="ico">{ICO.invite}</div><h3>Üdvözlő üzenet</h3></div>
          <div className="row-toggle" onClick={() => set('welcome','enabled',!W.enabled)}>
            <div className={`toggle ${W.enabled ? 'on' : ''}`}></div>
            <div className="lbl">Engedélyezve</div>
          </div>
          <div className="cfg-field">
            <label>Csatorna ID</label>
            <input className="cfg-input" placeholder="pl. 1234567890123456789" value={W.channelId} onChange={e => set('welcome','channelId',e.target.value)} />
          </div>
          <div className="cfg-field">
            <label>Üzenet típusa</label>
            <div style={{display:'flex',gap:8,marginTop:6}}>
              <button className="btn" style={ACT_BTN(W.type==='plain')} onClick={() => set('welcome','type','plain')}>Sima üzenet</button>
              <button className="btn" style={ACT_BTN(W.type==='embed')} onClick={() => set('welcome','type','embed')}>Embed</button>
            </div>
          </div>
          {W.type === 'embed' && (<>
            <div className="cfg-field">
              <label>Embed cím <em>· opcionális</em></label>
              <input className="cfg-input" placeholder="pl. Üdvözlünk!" value={W.embedTitle} onChange={e => set('welcome','embedTitle',e.target.value)} />
            </div>
            <div className="cfg-field">
              <label>Footer szöveg <em>· opcionális</em></label>
              <input className="cfg-input" placeholder="pl. Szerver neve · ma" value={W.embedFooter} onChange={e => set('welcome','embedFooter',e.target.value)} />
            </div>
            <div className="cfg-field">
              <label>Embed szín</label>
              <div style={{display:'flex',gap:10,alignItems:'center',marginTop:6}}>
                <input type="color" value={W.embedColor} onChange={e => set('welcome','embedColor',e.target.value)} style={{width:36,height:36,border:'1px solid var(--line)',borderRadius:6,background:'none',cursor:'pointer',padding:2}} />
                <input className="cfg-input cfg-input-mono" value={W.embedColor} onChange={e => set('welcome','embedColor',e.target.value)} maxLength={7} />
              </div>
            </div>
            <div className="row-toggle" onClick={() => set('welcome','showAvatar',!W.showAvatar)}>
              <div className={`toggle ${W.showAvatar ? 'on' : ''}`}></div>
              <div className="lbl">DC profilkép (jobb sarok)</div>
            </div>
          </>)}
          <div className="row-toggle" onClick={() => set('welcome','pingBefore',!W.pingBefore)}>
            <div className={`toggle ${W.pingBefore ? 'on' : ''}`}></div>
            <div className="lbl">Üzenet előtt ping?</div>
          </div>
          <div className="cfg-field">
            <label>Üzenet szövege</label>
            <textarea className="cfg-textarea" value={W.message} onChange={e => set('welcome','message',e.target.value)} />
          </div>
          <div style={{fontSize:11,color:'var(--ink-faint)',marginTop:6,marginBottom:2}}>Előnézet</div>
          <MsgPreview section={W} />
        </div>

        <div className="cfg-card">
          <div className="cfg-head"><div className="ico">{ICO.mail}</div><h3>Privát DM üzenet</h3></div>
          <div className="row-toggle" onClick={() => set('dm','enabled',!D.enabled)}>
            <div className={`toggle ${D.enabled ? 'on' : ''}`}></div>
            <div className="lbl">Engedélyezve</div>
          </div>
          <div className="cfg-field">
            <label>DM szövege</label>
            <textarea className="cfg-textarea tall" value={D.message} onChange={e => set('dm','message',e.target.value)} />
          </div>
          <div style={{fontSize:11,color:'var(--ink-faint)',marginTop:6,marginBottom:2}}>Előnézet</div>
          <MsgPreview section={{ ...D, type:'plain', pingBefore:false, showAvatar:false }} />
          <div style={{fontSize:12,color:'var(--ink-faint)',marginTop:10}}>Csak akkor kapja meg, ha a privát üzenetei nyitva vannak.</div>
        </div>

        <div className="cfg-card" style={{gridColumn:'1 / -1'}}>
          <div className="cfg-head"><div className="ico">{ICO.exit}</div><h3>Kilépő üzenet</h3></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:24}}>
            <div>
              <div className="row-toggle" onClick={() => set('leave','enabled',!L.enabled)}>
                <div className={`toggle ${L.enabled ? 'on' : ''}`}></div>
                <div className="lbl">Engedélyezve</div>
              </div>
              <div className="cfg-field">
                <label>Csatorna ID</label>
                <input className="cfg-input" placeholder="pl. 1234567890123456789" value={L.channelId} onChange={e => set('leave','channelId',e.target.value)} />
              </div>
              <div className="cfg-field">
                <label>Üzenet típusa</label>
                <div style={{display:'flex',gap:8,marginTop:6}}>
                  <button className="btn" style={ACT_BTN(L.type==='plain')} onClick={() => set('leave','type','plain')}>Sima üzenet</button>
                  <button className="btn" style={ACT_BTN(L.type==='embed')} onClick={() => set('leave','type','embed')}>Embed</button>
                </div>
              </div>
              {L.type === 'embed' && (<>
                <div className="cfg-field">
                  <label>Embed cím <em>· opcionális</em></label>
                  <input className="cfg-input" placeholder="pl. Viszlát!" value={L.embedTitle} onChange={e => set('leave','embedTitle',e.target.value)} />
                </div>
                <div className="cfg-field">
                  <label>Footer szöveg <em>· opcionális</em></label>
                  <input className="cfg-input" placeholder="pl. Szerver neve · ma" value={L.embedFooter} onChange={e => set('leave','embedFooter',e.target.value)} />
                </div>
                <div className="cfg-field">
                  <label>Embed szín</label>
                  <div style={{display:'flex',gap:10,alignItems:'center',marginTop:6}}>
                    <input type="color" value={L.embedColor} onChange={e => set('leave','embedColor',e.target.value)} style={{width:36,height:36,border:'1px solid var(--line)',borderRadius:6,background:'none',cursor:'pointer',padding:2}} />
                    <input className="cfg-input cfg-input-mono" value={L.embedColor} onChange={e => set('leave','embedColor',e.target.value)} maxLength={7} />
                  </div>
                </div>
                <div className="row-toggle" onClick={() => set('leave','showAvatar',!L.showAvatar)}>
                  <div className={`toggle ${L.showAvatar ? 'on' : ''}`}></div>
                  <div className="lbl">DC profilkép (jobb sarok)</div>
                </div>
              </>)}
            </div>
            <div>
              <div className="cfg-field" style={{margin:0}}>
                <label>Kilépő üzenet szövege</label>
                <textarea className="cfg-textarea" value={L.message} onChange={e => set('leave','message',e.target.value)} />
              </div>
              <div style={{fontSize:11,color:'var(--ink-faint)',marginTop:10,marginBottom:2}}>Előnézet</div>
              <MsgPreview section={L} />
            </div>
          </div>
        </div>

      </div>

      </div>

      {dirty && <UnsavedBar onReset={resetInvite} onSave={saveInvite} saving={saving} />}
    </>
  );
}
