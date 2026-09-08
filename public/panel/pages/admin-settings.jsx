function SettingsPage({ goBack }) {
  const [maintenance, setMaintenance] = useDState(false);
  const [allowlist, setAllowlist]     = useDState([]);
  const [input, setInput]             = useDState('');
  const [loading, setLoading]         = useDState(true);
  const [saving, setSaving]           = useDState(false);

  useDEffect(() => {
    const t = localStorage.getItem('vh_token');
    fetch('/api/system/settings', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setMaintenance(!!d.maintenance); setAllowlist(Array.isArray(d.allowlist) ? d.allowlist : []); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function persist(nextMaintenance, nextAllowlist, okMsg) {
    if (saving) return false;
    const prevM = maintenance, prevL = allowlist;
    setMaintenance(nextMaintenance);
    setAllowlist(nextAllowlist);
    setSaving(true);
    const t = localStorage.getItem('vh_token');
    const r = await fetch('/api/system/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ maintenance: nextMaintenance, allowlist: nextAllowlist.map(x => x.id) }),
    }).catch(() => null);
    setSaving(false);
    if (!r?.ok) { setMaintenance(prevM); setAllowlist(prevL); toast('Nem sikerült menteni a beállítást.', 'err'); return false; }
    const d = await r.json().catch(() => null);
    if (d && Array.isArray(d.allowlist)) setAllowlist(d.allowlist);
    if (okMsg) toast(okMsg);
    return true;
  }

  function toggleMaintenance() {
    if (loading || saving) return;
    const next = !maintenance;
    persist(next, allowlist, next ? 'Karbantartás mód bekapcsolva.' : 'Karbantartás mód kikapcsolva.');
  }

  function addId() {
    const id = input.trim();
    if (!id) return;
    if (!/^[0-9]{5,30}$/.test(id)) { toast('Érvénytelen ID. Adj meg egy Discord felhasználó ID-t (csak számok).', 'err'); return; }
    if (allowlist.some(x => x.id === id)) { toast('Ez az ID már a listán van.', 'err'); return; }
    setInput('');
    persist(maintenance, [...allowlist, { id, name: id, avatar: null, role_name: null, role_color: null, registered: false }], 'Felhasználó hozzáadva az engedélyezettekhez.');
  }

  function removeId(id) {
    persist(maintenance, allowlist.filter(x => x.id !== id), 'Felhasználó eltávolítva.');
  }

  return (
    <>
      <div className="page-head">
        <div>
          <button className="page-back" onClick={goBack}>{ICO.back} Vissza</button>
          <h1 className="page-title">Beállítások</h1>
          <div className="page-sub">Rendszerszintű beállítások kezelése.</div>
        </div>
        <div className="page-actions">
          <span className={`status-pill ${maintenance ? 'warn' : 'live'}`}>
            <span className="pdot"></span>{maintenance ? 'Karbantartás aktív' : 'Üzemel'}
          </span>
        </div>
      </div>

      <div style={{background:'var(--glass)',border:'1px solid var(--line)',borderRadius:16,padding:'22px 24px',maxWidth:640,borderTop:maintenance?'2px solid #f0b429':'1px solid var(--line)'}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:16}}>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:600,fontFamily:"'Space Grotesk',sans-serif",marginBottom:6}}>Karbantartás mód</div>
            <div style={{fontSize:13,color:'var(--ink-faint)',lineHeight:1.6}}>
              Bekapcsolva a belépő/regisztrációs oldalon sárga sáv jelenik meg, a regisztráció
              letiltásra kerül, és <strong>csak az alább engedélyezett felhasználók</strong> tudnak
              belépni — mindenki más ki van zárva.
            </div>
          </div>
          <div
            className={`toggle ${maintenance ? 'on' : ''}`}
            onClick={toggleMaintenance}
            role="switch"
            aria-checked={maintenance}
            style={{ marginTop: 2, cursor: loading || saving ? 'default' : 'pointer', opacity: loading ? .5 : 1 }}
          />
        </div>
        {maintenance && (
          <div style={{marginTop:16,padding:'10px 14px',borderRadius:10,background:'rgba(240,180,41,.1)',border:'1px solid rgba(240,180,41,.3)',fontSize:12.5,color:'#f0b429',lineHeight:1.5}}>
            A karbantartás mód jelenleg <strong>aktív</strong>. Csak az engedélyezett listán szereplő felhasználók léphetnek be.
          </div>
        )}
      </div>

      <div style={{background:'var(--glass)',border:'1px solid var(--line)',borderRadius:16,padding:'22px 24px',maxWidth:640,marginTop:16}}>
        <div style={{fontSize:15,fontWeight:600,fontFamily:"'Space Grotesk',sans-serif",marginBottom:6}}>Engedélyezett felhasználók</div>
        <div style={{fontSize:13,color:'var(--ink-faint)',lineHeight:1.6,marginBottom:16}}>
          Karbantartás alatt csak az itt felsorolt <strong>Discord felhasználó ID</strong>-k léphetnek be.
          A Discord ID-t úgy másolhatod ki, hogy a Discordban bekapcsolod a Fejlesztői módot, jobbklikk a felhasználóra → „Felhasználói azonosító másolása".
        </div>

        <div style={{display:'flex',gap:8,marginBottom:allowlist.length?16:0}}>
          <input
            className="rp-num-input"
            style={{flex:1,minWidth:0}}
            placeholder="pl. 123456789012345678"
            value={input}
            onChange={e => setInput(e.target.value.replace(/[^0-9]/g,''))}
            onKeyDown={e => { if (e.key === 'Enter') addId(); }}
            disabled={saving}
          />
          <button className="btn btn-primary" onClick={addId} disabled={saving || !input.trim()}>Hozzáadás</button>
        </div>

        {allowlist.length === 0 ? (
          <div style={{fontSize:12.5,color:'var(--ink-faint)',padding:'2px 0'}}>Még nincs engedélyezett felhasználó. Karbantartás alatt senki sem tudna belépni.</div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {allowlist.map(u => {
              const initial = (u.name || u.id || '?')[0].toUpperCase();
              return (
                <div key={u.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:10,background:'var(--glass-2)',border:'1px solid var(--line)'}}>
                  {u.avatar
                    ? <img src={u.avatar} alt="" style={{width:38,height:38,borderRadius:'50%',objectFit:'cover',flexShrink:0}} />
                    : <span style={{width:38,height:38,borderRadius:'50%',flexShrink:0,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:700,background:'var(--glass)',border:'1px solid var(--line)',color:'var(--ink-dim)'}}>{initial}</span>
                  }
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <span style={{fontSize:14,fontWeight:600,color:'var(--ink)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u.name || u.id}</span>
                      {u.role_name && (
                        <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:999,color:u.role_color||'#8aa6ff',background:hexToRgba(u.role_color||'#8aa6ff',0.14),border:`1px solid ${hexToRgba(u.role_color||'#8aa6ff',0.35)}`}}>{u.role_name}</span>
                      )}
                      {!u.registered && <span style={{fontSize:10.5,color:'var(--ink-faint)',border:'1px solid var(--line)',borderRadius:999,padding:'2px 7px'}}>nincs fiók</span>}
                    </div>
                    <div style={{fontSize:11.5,color:'var(--ink-faint)',fontFamily:"'JetBrains Mono',monospace",marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u.id}</div>
                  </div>
                  <button
                    onClick={() => removeId(u.id)}
                    disabled={saving}
                    style={{background:'none',border:'none',color:'#ff6b81',cursor:saving?'default':'pointer',fontSize:13,fontFamily:'inherit',padding:'2px 6px',flexShrink:0}}
                  >Eltávolítás</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('hu-HU', { year:'numeric', month:'2-digit', day:'2-digit' });
}
