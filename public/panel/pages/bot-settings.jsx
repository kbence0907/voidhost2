const DEF_SETTINGS = { prefix: '!', autoRestart: true, region: 'eu-bp-2', brandingDisabled: false };
function BotSettingsPage({ bot, goBack, onDelete, onUnsaved, user }) {
  const [cfg, setCfg]   = useDState(DEF_SETTINGS);
  const [orig, setOrig] = useDState(DEF_SETTINGS);
  const [saving, setSaving] = useDState(false);
  const [delPhase, setDelPhase]   = useDState('idle');
  const [countdown, setCountdown] = useDState(5);
  const [delInput, setDelInput]   = useDState('');
  const [deleting, setDeleting]   = useDState(false);

  const tok = () => localStorage.getItem('vh_token');
  const isAdminView = bot.owned === false && !bot.member_perms;
  const canEdit     = !isAdminView && (user?.perms?.editBotSettings ?? true);
  const dirty = canEdit && JSON.stringify(cfg) !== JSON.stringify(orig);

  useDEffect(() => {
    fetch(`/api/bots/${bot.id}/settings`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : null).then(d => { if (d) { setCfg(d); setOrig(d); } });
  }, [bot.id]);

  useDEffect(() => { onUnsaved(dirty); }, [dirty]);
  useDEffect(() => () => onUnsaved(false), []);

  const set = (k, v) => { if (canEdit) setCfg(p => ({ ...p, [k]: v })); };
  function resetSettings() { setCfg({ ...orig }); }

  async function saveSettings() {
    setSaving(true);
    const r = await fetch(`/api/bots/${bot.id}/settings`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    });
    if (r.ok) setOrig({ ...cfg });
    setSaving(false);
  }

  function startDelete() {
    setDelPhase('countdown');
    setCountdown(5);
    let n = 5;
    const t = setInterval(() => {
      n--;
      setCountdown(n);
      if (n <= 0) { clearInterval(t); setDelPhase('confirm'); }
    }, 1000);
  }

  async function confirmDelete() {
    if (delInput !== bot.bot_name) return;
    setDeleting(true);
    await onDelete();
  }
  return (
    <>
      <div className="page-head">
        <div>
          <button className="page-back" onClick={goBack}>{ICO.back} Vissza</button>
          <h1 className="page-title">Beállítások</h1>
          <div className="page-sub">A {bot.bot_name} bot alap konfigurációja, futtatás, prefix és viselkedés.</div>
        </div>
        <div className="page-actions">
          <span className="status-pill live"><span className="pdot"></span>Online</span>
        </div>
      </div>

      <div className="config-grid" style={{maxWidth:860}}>
        <div className="cfg-card">
          <div className="cfg-head">
            <div className="ico">{ICO.settings}</div>
            <h3>Általános</h3>
          </div>
          <div className="cfg-field">
            <label>Bot név</label>
            <input className="cfg-input" value={bot.bot_name} readOnly
              style={{opacity:0.45,cursor:'not-allowed'}} />
          </div>
          <div className="cfg-field">
            <label>Parancs prefix</label>
            <input className="cfg-input" value={cfg.prefix} onChange={e => set('prefix', e.target.value.slice(0,10))} />
          </div>
          <div className="cfg-field">
            <label>Bot token <em>· olvasásra zárolva</em></label>
            <input className="cfg-input" type="password" defaultValue="••••••••••••••••••••••••" readOnly style={{opacity:0.45,cursor:'not-allowed',overflow:'hidden'}} />
          </div>
        </div>

        <div className="cfg-card">
          <div className="cfg-head">
            <div className="ico">{ICO.rocket}</div>
            <h3>Futtatás</h3>
          </div>
          <div className="row-toggle" onClick={() => set('autoRestart', !cfg.autoRestart)}>
            <div className={`toggle ${cfg.autoRestart ? 'on' : ''}`}></div>
            <div className="lbl">Automatikus indulás összeomlás után</div>
          </div>
          <div className="cfg-field" style={{marginTop:14}}>
            <label>Régió</label>
            <select className="cfg-input" value={cfg.region} onChange={e => set('region', e.target.value)}>
              <option value="eu-bp-2">EU · Budapest (eu-bp-2)</option>
              <option value="eu-fra-1">EU · Frankfurt (eu-fra-1)</option>
              <option value="eu-ams-1">EU · Amsterdam (eu-ams-1)</option>
            </select>
          </div>
        </div>

        {(() => {
          const canToggle = !!user?.perms?.disableBranding;
          const locked = !canToggle;
          return (
            <div className="cfg-card" style={{gridColumn:'1 / -1', ...(locked ? {borderColor:'rgba(245,197,66,0.35)',background:'rgba(245,197,66,0.03)'} : {})}}>
              <div className="cfg-head">
                <div className="ico" style={locked ? {background:'rgba(245,197,66,0.12)',borderColor:'rgba(245,197,66,0.3)'} : {}}>
                  {ICO.settings}
                </div>
                <h3>Egyéb</h3>
                {locked && (
                  <span style={{marginLeft:'auto',fontSize:11,padding:'3px 9px',borderRadius:6,background:'rgba(245,197,66,0.12)',border:'1px solid rgba(245,197,66,0.35)',color:'#f5c542',fontWeight:700,letterSpacing:'0.08em'}}>VIP+ szükséges</span>
                )}
              </div>
              <div
                className="rp-row"
                style={{cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.6 : 1}}
                onClick={() => { if (!locked) set('brandingDisabled', !cfg.brandingDisabled); }}
              >
                <div className="rp-row-label">
                  <div className="rp-row-name" style={{fontSize:13,fontWeight:500}}>VoidHost branding kikapcsolása</div>
                  <div className="rp-row-sub" style={{fontSize:12,color:'var(--ink-faint)',marginTop:2}}>Ha be van kapcsolva, a bot neve alatt nem jelenik meg hogy <b>Által: voidhost.hu</b></div>
                </div>
                <div className={`toggle ${cfg.brandingDisabled && !locked ? 'on' : ''}`} />
              </div>
            </div>
          );
        })()}

        {(isAdminView ? !!user?.perms?.deleteOthersBots : (user?.perms?.deleteOwnBots ?? true)) && (
        <div className="cfg-card" style={{gridColumn:'1 / -1',borderColor:'rgba(255,107,129,0.25)',background:'rgba(255,107,129,0.04)'}}>
          <div className="cfg-head">
            <div className="ico" style={{background:'rgba(255,107,129,0.15)',borderColor:'rgba(255,107,129,0.3)'}}>
              <svg viewBox="0 0 24 24" stroke="var(--red)" fill="none" strokeWidth="1.7"><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>
            </div>
            <h3>Veszélyes zóna</h3>
          </div>
          {delPhase === 'idle' && (
            <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:18,alignItems:'center'}}>
              <div>
                <div style={{fontSize:14,color:'var(--ink)'}}>Bot törlése a voidhost panelről</div>
                <div style={{fontSize:12.5,color:'var(--ink-faint)',marginTop:4}}>A Discord botod nem törlődik, csak a panelről kerül le. Vissza tudod hozni a tokennel.</div>
              </div>
              <button className="btn" style={{borderColor:'rgba(255,107,129,0.3)',color:'var(--red)'}} onClick={startDelete}>Eltávolítás</button>
            </div>
          )}
          {delPhase === 'countdown' && (
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <div style={{width:40,height:40,borderRadius:10,background:'rgba(255,107,129,0.12)',border:'1px solid rgba(255,107,129,0.25)',display:'grid',placeItems:'center',fontSize:18,fontWeight:700,color:'var(--red)',flexShrink:0}}>{countdown}</div>
              <div style={{fontSize:13.5,color:'var(--ink-faint)'}}>Tartsd nyomva a gondolatot... <b style={{color:'var(--ink)'}}>biztosan törölni akarod?</b></div>
            </div>
          )}
          {delPhase === 'confirm' && (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{fontSize:13,color:'var(--ink-faint)'}}>
                Megerősítéshez írd be a bot nevét: <b style={{color:'var(--red)'}}>{bot.bot_name}</b>
              </div>
              <div style={{display:'flex',gap:10,alignItems:'center'}}>
                <input
                  className="cfg-input"
                  placeholder={bot.bot_name}
                  value={delInput}
                  onChange={e => setDelInput(e.target.value)}
                  style={{borderColor: delInput && delInput !== bot.bot_name ? 'rgba(255,107,129,0.5)' : ''}}
                  autoFocus
                />
                <button
                  className="btn"
                  style={{borderColor:'rgba(255,107,129,0.35)',background:'rgba(255,107,129,0.12)',color:'var(--red)',flexShrink:0}}
                  disabled={delInput !== bot.bot_name || deleting}
                  onClick={confirmDelete}
                >{deleting ? 'Törlés...' : 'Törlés'}</button>
                <button className="btn" onClick={() => { setDelPhase('idle'); setDelInput(''); }} disabled={deleting}>Mégse</button>
              </div>
            </div>
          )}
        </div>
        )}

      </div>

      {dirty && <UnsavedBar onReset={resetSettings} onSave={saveSettings} saving={saving} />}
    </>
  );
}
