const ACCESS_PERMS = [
  { f: 'canStart',       l: '▶ Indítás'  },
  { f: 'canStop',        l: '■ Leállítás' },
  { f: 'canRestart',     l: '↺ Újraindítás' },
  { f: 'canDelete',      l: '🗑 Törlés' },
  { f: 'canManageUsers', l: '👥 Felhasználók' },
  { f: 'canClearLogs',   l: '📋 Napló törlés' },
];

function AddMemberModal({ botId, onClose, onAdded }) {
  const [query, setQuery]     = useDState('');
  const [results, setResults] = useDState([]);
  const [adding, setAdding]   = useDState(null);
  const timerRef = React.useRef(null);

  function onQueryChange(v) {
    setQuery(v);
    clearTimeout(timerRef.current);
    if (v.trim().length < 2) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      const t = localStorage.getItem('vh_token');
      const r = await fetch(`/api/users/search?q=${encodeURIComponent(v.trim())}`, { headers: { Authorization: `Bearer ${t}` } });
      if (r.ok) setResults(await r.json());
    }, 300);
  }

  async function addUser(userId) {
    setAdding(userId);
    const t = localStorage.getItem('vh_token');
    const r = await fetch(`/api/bots/${botId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ userId }),
    });
    const data = await r.json();
    setAdding(null);
    if (!r.ok) { toast(data.error || 'Hiba történt.', 'err'); return; }
    onAdded();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Tag hozzáadása</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="cfg-field">
          <label>Felhasználó keresése</label>
          <input
            className="cfg-input"
            placeholder="Név vagy email..."
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            autoFocus
          />
          <div style={{fontSize:11,color:'var(--ink-faint)',marginTop:4}}>Legalább 2 karakter • csak verifikált felhasználók</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:4,maxHeight:220,overflowY:'auto'}}>
          {results.length === 0 && query.length >= 2 && (
            <div style={{color:'var(--ink-faint)',fontSize:13,textAlign:'center',padding:'16px 0'}}>Nincs találat</div>
          )}
          {results.map(u => (
            <div key={u.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:10,background:'var(--glass)',border:'1px solid var(--line)',cursor:'pointer'}}
              onClick={() => addUser(u.id)}>
              {u.avatar
                ? <img src={u.avatar} alt={u.name} style={{width:36,height:36,borderRadius:'50%',objectFit:'cover',flexShrink:0}} />
                : <div style={{width:36,height:36,borderRadius:'50%',background:'var(--glass-2)',border:'1px solid var(--line)',display:'grid',placeItems:'center',fontSize:15,fontWeight:700,flexShrink:0}}>{u.name[0].toUpperCase()}</div>
              }
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:14}}>{u.name}</div>
                <div style={{fontSize:12,color:'var(--ink-faint)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u.email}</div>
              </div>
              {adding === u.id
                ? <span style={{fontSize:12,color:'var(--ink-faint)'}}>...</span>
                : <span style={{fontSize:12,color:'var(--blue-soft)'}}>+ Hozzáadás</span>
              }
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MemberRow({ member, perms, onToggle, onRemove }) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:12,padding:'16px 18px',background:'var(--glass)',border:'1px solid var(--line)',borderRadius:14}}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        {member.avatar
          ? <img src={member.avatar} alt={member.name} style={{width:40,height:40,borderRadius:'50%',objectFit:'cover',flexShrink:0}} />
          : <div style={{width:40,height:40,borderRadius:'50%',background:'var(--glass-2)',border:'1px solid var(--line)',display:'grid',placeItems:'center',fontSize:16,fontWeight:700,flexShrink:0}}>{member.name[0].toUpperCase()}</div>
        }
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:600,fontSize:14}}>{member.name}</div>
          <div style={{fontSize:12,color:'var(--ink-faint)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{member.email}</div>
        </div>
        <button className="btn-icon-danger" title="Eltávolítás" onClick={onRemove}>{ICO.trash}</button>
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
        {ACCESS_PERMS.map(({ f, l }) => {
          const on = !!perms[f];
          return (
            <button key={f} onClick={() => onToggle(f)}
              style={{
                display:'inline-flex',alignItems:'center',gap:5,
                padding:'5px 11px',borderRadius:999,fontSize:12,fontWeight:500,
                border:`1px solid ${on ? 'rgba(77,124,255,0.4)' : 'var(--line)'}`,
                background: on ? 'rgba(77,124,255,0.15)' : 'transparent',
                color: on ? 'var(--blue-soft)' : 'var(--ink-faint)',
                cursor:'pointer',transition:'all .15s',
              }}
            >{l}</button>
          );
        })}
      </div>
    </div>
  );
}

function BotAccessPage({ bot, goBack, user, onUnsaved }) {
  const [members,  setMembers]  = useDState([]);
  const [original, setOriginal] = useDState([]);
  const [loading,  setLoading]  = useDState(true);
  const [saving,   setSaving]   = useDState(false);
  const [showAdd,  setShowAdd]  = useDState(false);

  const dirty = useDMemo(() => JSON.stringify(members) !== JSON.stringify(original), [members, original]);

  function loadMembers() {
    const t = localStorage.getItem('vh_token');
    return fetch(`/api/bots/${bot.id}/members`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const copy = JSON.parse(JSON.stringify(data));
        setMembers(copy);
        setOriginal(JSON.parse(JSON.stringify(data)));
      })
      .catch(() => {});
  }

  useDEffect(() => { loadMembers().finally(() => setLoading(false)); }, [bot.id]);
  useDEffect(() => { onUnsaved(dirty); }, [dirty]);
  useDEffect(() => () => onUnsaved(false), []);

  function togglePerm(userId, field) {
    setMembers(prev => prev.map(m =>
      m.userId === userId ? { ...m, perms: { ...m.perms, [field]: !m.perms[field] } } : m
    ));
  }

  async function removeMember(userId) {
    const t = localStorage.getItem('vh_token');
    await fetch(`/api/bots/${bot.id}/members/${userId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } });
    loadMembers();
  }

  function resetAll() {
    setMembers(JSON.parse(JSON.stringify(original)));
  }

  async function saveAll() {
    setSaving(true);
    const t = localStorage.getItem('vh_token');
    const changed = members.filter(m => {
      const orig = original.find(o => o.userId === m.userId);
      return orig && JSON.stringify(m.perms) !== JSON.stringify(orig.perms);
    });
    await Promise.all(changed.map(m =>
      fetch(`/api/bots/${bot.id}/members/${m.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify(m.perms),
      })
    ));
    setOriginal(JSON.parse(JSON.stringify(members)));
    setSaving(false);
  }

  const maxMembers  = user.maxBotMembers ?? 3;
  const limitReached = maxMembers > 0 && members.length >= maxMembers;

  return (
    <>
      {showAdd && <AddMemberModal botId={bot.id} onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); loadMembers(); }} />}

      <div className="page-head">
        <div>
          <button className="page-back" onClick={goBack}>{ICO.back} Vissza</button>
          <h1 className="page-title">Hozzáférések</h1>
          <div className="page-sub">Más felhasználók hozzárendelése a {bot.bot_name} bot kezeléséhez.</div>
        </div>
        <div className="page-actions">
          <span style={{fontSize:12,color:'var(--ink-faint)'}}>{members.length}{maxMembers > 0 ? ` / ${maxMembers}` : ''} tag</span>
          <button
            className="btn btn-primary"
            disabled={limitReached}
            style={limitReached ? {opacity:.45,cursor:'not-allowed'} : {}}
            title={limitReached ? `Elérted a korlátot (${members.length}/${maxMembers})` : ''}
            onClick={() => !limitReached && setShowAdd(true)}
          >{ICO.plus} Hozzáadás</button>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={3} />
      ) : members.length === 0 ? (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,padding:'60px 0',textAlign:'center'}}>
          <div style={{width:52,height:52,borderRadius:14,background:'var(--glass)',border:'1px solid var(--line)',display:'grid',placeItems:'center'}}>{ICO.shield}</div>
          <div>
            <div style={{fontSize:16,fontWeight:600,fontFamily:"'Space Grotesk',sans-serif"}}>Még nincs hozzárendelt tag</div>
            <div style={{fontSize:13,color:'var(--ink-faint)',marginTop:6}}>Adj hozzá felhasználókat és állítsd be jogosultságaikat.</div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>{ICO.plus} Első tag hozzáadása</button>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {members.map(m => (
            <MemberRow key={m.userId} member={m} perms={m.perms}
              onToggle={f => togglePerm(m.userId, f)}
              onRemove={() => removeMember(m.userId)}
            />
          ))}
        </div>
      )}

      {dirty && <UnsavedBar onReset={resetAll} onSave={saveAll} saving={saving} />}
    </>
  );
}

function UnsavedBar({ onReset, onSave, saving }) {
  return ReactDOM.createPortal(
    <div className="unsaved-bar">
      <div className="unsaved-left">
        <span className="unsaved-icon">⚠</span>
        <span>Óvatosan – Nem mentett változások vannak!</span>
      </div>
      <div className="unsaved-right">
        <button className="unsaved-reset-btn" onClick={onReset}>Visszaállítás</button>
        <button className="unsaved-save-btn" onClick={onSave} disabled={saving}>
          {saving ? 'Mentés...' : 'Módosítások mentése'}
        </button>
      </div>
    </div>,
    document.body
  );
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
