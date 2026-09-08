const BAN_REASONS = [
  'Szabályszegés',
  'Spam / visszaélés',
  'Többszörös fiók',
  'Rendszer visszaélés',
  'Egyéb',
];

function BanModal({ onClose, onConfirm, busy }) {
  const [reason, setReason] = useDState('');
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{maxWidth:420}} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3 style={{color:'#f87171'}}>Felhasználó kitiltása</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{fontSize:13,color:'var(--ink-faint)',marginBottom:16}}>Válassz indokot. A felhasználó emailben értesítést kap.</div>
        <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20}}>
          {BAN_REASONS.map(r => (
            <div key={r}
              onClick={() => setReason(r)}
              style={{
                padding:'10px 14px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:500,
                border: `1px solid ${reason === r ? 'rgba(248,113,113,.5)' : 'var(--line)'}`,
                background: reason === r ? 'rgba(248,113,113,.1)' : 'var(--glass)',
                color: reason === r ? '#f87171' : 'var(--ink)',
                transition:'all .15s',
              }}>
              {r}
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button className="btn" onClick={onClose}>Mégse</button>
          <button
            className={`btn${busy ? ' btn-busy' : ''}`}
            style={{background:'rgba(248,113,113,.15)',border:'1px solid rgba(248,113,113,.3)',color:'#f87171',paddingRight: busy ? 32 : 14}}
            disabled={!reason || busy}
            onClick={() => onConfirm(reason)}>
            Kitiltás
          </button>
        </div>
      </div>
    </div>
  );
}

function UserDetailPage({ userId, onBack, openBot, userPerms }) {
  const [data, setData]       = useDState(null);
  const [loading, setLoading] = useDState(true);
  const [busy, setBusy]       = useDState('');
  const [editName, setEditName]   = useDState('');
  const [editEmail, setEditEmail] = useDState('');
  const [editingName, setEditingName]   = useDState(false);
  const [editingEmail, setEditingEmail] = useDState(false);
  const [banModal, setBanModal] = useDState(false);
  const tok = () => localStorage.getItem('vh_token');
  const auth = () => ({ Authorization: `Bearer ${tok()}` });

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const r = await fetch(`/api/users/${userId}`, { headers: auth() });
    if (r.ok) setData(await r.json());
    if (!silent) setLoading(false);
  }
  useDEffect(() => { load(); }, [userId]);

  async function action(endpoint, method = 'POST', body = null) {
    setBusy(endpoint);
    const r = await fetch(`/api/users/${userId}/${endpoint}`, {
      method,
      headers: body ? { ...auth(), 'Content-Type': 'application/json' } : auth(),
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await r.json();
    setBusy('');
    if (r.ok) { toast('Sikeres!'); load(true); }
    else toast(d.error || 'Hiba.', 'err');
  }

  async function doBan(reason) {
    setBusy('ban');
    const r = await fetch(`/api/users/${userId}/ban`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const d = await r.json();
    setBusy('');
    setBanModal(false);
    if (r.ok) { toast('Felhasználó kitiltva.', 'ok'); load(true); }
    else toast(d.error || 'Hiba.', 'err');
  }

  async function saveName() {
    const name = editName.trim();
    if (name.length < 2) return;
    setBusy('name');
    const r = await fetch(`/api/users/${userId}/name`, {
      method: 'PATCH',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const d = await r.json();
    setBusy('');
    if (r.ok) { toast('Név megváltoztatva!'); setEditingName(false); load(true); }
    else toast(d.error || 'Hiba.', 'err');
  }

  async function saveEmail() {
    const email = editEmail.trim();
    if (!email.includes('@')) return;
    setBusy('email');
    const r = await fetch(`/api/users/${userId}/email`, {
      method: 'PATCH',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const d = await r.json();
    setBusy('');
    if (r.ok) { toast('Email megváltoztatva!'); setEditingEmail(false); load(true); }
    else toast(d.error || 'Hiba.', 'err');
  }

  if (loading) return <SkeletonDetail />;
  if (!data) return <div style={{color:'var(--red)',padding:'40px 0'}}>Nem található.</div>;

  const isLocked = data.locked_until && Date.now() < data.locked_until;
  const unlockStr = isLocked ? new Date(data.locked_until).toLocaleString('hu-HU') : '';
  const isBanned = !!data.is_banned;

  return (
    <>
      {banModal && <BanModal onClose={() => setBanModal(false)} onConfirm={doBan} busy={busy === 'ban'} />}
      <div className="page-head">
        <div>
          <button className="page-back" onClick={onBack}>{ICO.back} Vissza</button>
          <h1 className="page-title">{data.name}</h1>
          <div className="page-sub">{data.email}</div>
        </div>
        <div className="page-actions" style={{alignItems:'center',gap:8}}>
          {data.is_online
            ? <span className="status-pill live"><span className="pdot"></span>Online</span>
            : <span className="status-pill off"><span className="pdot"></span>Offline</span>
          }
          {isLocked && <span className="status-pill" style={{background:'rgba(251,146,60,.12)',borderColor:'rgba(251,146,60,.3)',color:'#fb923c'}}><span className="pdot" style={{background:'#fb923c'}}></span>Zárolva</span>}
          {isBanned && <span className="status-pill" style={{background:'rgba(248,113,113,.12)',borderColor:'rgba(248,113,113,.3)',color:'#f87171'}}><span className="pdot" style={{background:'#f87171'}}></span>Kitiltva</span>}
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20,maxWidth:1060}}>

        <div className="cfg-card" style={{gridRow:'span 2'}}>
          <div className="cfg-head"><div className="ico">{ICO.user}</div><h3>Profil</h3></div>
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:18}}>
            {data.avatar
              ? <img src={data.avatar} alt={data.name} style={{width:56,height:56,borderRadius:'50%',objectFit:'cover',border:'2px solid #6c63ff',flexShrink:0}} />
              : <div style={{width:56,height:56,borderRadius:'50%',background:'#6c63ff',display:'grid',placeItems:'center',fontSize:22,fontWeight:700,color:'#fff',flexShrink:0}}>{data.name[0].toUpperCase()}</div>
            }
            <div>
              <div style={{fontWeight:700,fontSize:16}}>{data.name}</div>
              <div style={{fontSize:12,color:data.role_color||'var(--ink-faint)',marginTop:2,textTransform:'uppercase',letterSpacing:'0.1em',fontFamily:"'JetBrains Mono',monospace"}}>{data.role_name}</div>
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8,fontSize:13}}>
            <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--line)'}}>
              <span style={{color:'var(--ink-faint)'}}>Email</span>
              <span style={{fontFamily:'monospace'}}>{data.email}</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--line)'}}>
              <span style={{color:'var(--ink-faint)'}}>Verifikálva</span>
              <span style={{color: data.email_verified ? 'var(--green)' : 'var(--red)'}}>{data.email_verified ? 'Igen' : 'Nem'}</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--line)'}}>
              <span style={{color:'var(--ink-faint)'}}>Regisztráció</span>
              <span>{fmtDate(data.created_at)}</span>
            </div>
            {data.discord_username && (
              <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--line)'}}>
                <span style={{color:'var(--ink-faint)'}}>Discord</span>
                <span>{data.discord_username}</span>
              </div>
            )}
            {isLocked && (
              <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom: isBanned ? '1px solid var(--line)' : ''}}>
                <span style={{color:'#fb923c'}}>Zárolva eddig</span>
                <span style={{color:'#fb923c',fontSize:12}}>{unlockStr}</span>
              </div>
            )}
            {isBanned && (
              <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0'}}>
                <span style={{color:'#f87171'}}>Kitiltva</span>
                <span style={{color:'#f87171',fontSize:12}}>{data.ban_reason || 'DC + email alapján'}</span>
              </div>
            )}
          </div>
        </div>

        <div className="cfg-card">
          <div className="cfg-head"><div className="ico">{ICO.bots}</div><h3>Statisztikák</h3></div>
          <div className="stat-grid" style={{gridTemplateColumns:'1fr 1fr 1fr',margin:0}}>
            <div className="stat"><div className="l">Botok</div><div className="v">{data.stats.total_bots}</div></div>
            <div className="stat"><div className="l">Aktív</div><div className="v" style={{color:'var(--green)'}}>{data.stats.active_bots}</div></div>
            <div className="stat"><div className="l">Megosztott</div><div className="v">{data.stats.shared_bots}</div></div>
          </div>
        </div>

        <div className="cfg-card">
          <div className="cfg-head"><div className="ico">{ICO.settings}</div><h3>Műveletek</h3></div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {userPerms.deleteUsers && !isLocked && (
              <button className={`btn btn-block${busy==='lock' ? ' btn-busy' : ''}`} style={{justifyContent:'flex-start',borderColor:'rgba(251,146,60,.3)',color:'#fb923c',paddingRight: busy==='lock' ? 32 : ''}} onClick={() => action('lock')}>
                {ICO.shield}<span>Fiók zárolása (4 nap)</span>
              </button>
            )}
            {userPerms.deleteUsers && isLocked && (
              <button className={`btn btn-block btn-primary${busy==='unlock' ? ' btn-busy' : ''}`} style={{justifyContent:'flex-start',paddingRight: busy==='unlock' ? 32 : ''}} onClick={() => action('unlock')}>
                {ICO.check}<span>Zárolás feloldása</span>
              </button>
            )}
            {userPerms.banUsers && !isBanned && (
              <button className="btn btn-block" style={{justifyContent:'flex-start',borderColor:'rgba(248,113,113,.3)',color:'#f87171'}} onClick={() => setBanModal(true)}>
                {ICO.warn}<span>Felhasználó kitiltása</span>
              </button>
            )}
            {userPerms.unbanUsers && isBanned && (
              <button className={`btn btn-block btn-primary${busy==='unban' ? ' btn-busy' : ''}`} style={{justifyContent:'flex-start',paddingRight: busy==='unban' ? 32 : ''}} onClick={() => action('unban')}>
                {ICO.check}<span>Kitiltás feloldása</span>
              </button>
            )}
            {userPerms.resetPassword && (
              <button className={`btn btn-block${busy==='reset-password' ? ' btn-busy' : ''}`} style={{justifyContent:'flex-start',paddingRight: busy==='reset-password' ? 32 : ''}} onClick={() => action('reset-password')}>
                {ICO.key}<span>Jelszó csere küldése emailben</span>
              </button>
            )}
          </div>
        </div>

        {userPerms.changeEmail && (
          <div className="cfg-card" style={{gridColumn:'span 2'}}>
            <div className="cfg-head"><div className="ico">{ICO.edit}</div><h3>Adatok szerkesztése</h3></div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div className="cfg-field" style={{margin:0}}>
                <label>Felhasználónév</label>
                {editingName ? (
                  <div style={{display:'flex',gap:8,marginTop:6}}>
                    <input className="cfg-input" style={{flex:1}} value={editName} onChange={e => setEditName(e.target.value)} autoFocus />
                    <button className={`btn btn-primary${busy==='name' ? ' btn-busy' : ''}`} style={{padding:'6px 22px 6px 14px'}} onClick={saveName}>Mentés</button>
                    <button className="btn" style={{padding:'6px 10px'}} onClick={() => setEditingName(false)}>✕</button>
                  </div>
                ) : (
                  <div style={{display:'flex',gap:8,alignItems:'center',marginTop:6}}>
                    <input className="cfg-input" style={{flex:1,opacity:.6,cursor:'not-allowed'}} value={data.name} readOnly />
                    <button className="btn" style={{padding:'6px 12px'}} onClick={() => { setEditName(data.name); setEditingName(true); }}>{ICO.edit}</button>
                  </div>
                )}
              </div>
              <div className="cfg-field" style={{margin:0}}>
                <label>Email cím</label>
                {editingEmail ? (
                  <div style={{display:'flex',gap:8,marginTop:6}}>
                    <input className="cfg-input" style={{flex:1}} type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} autoFocus />
                    <button className={`btn btn-primary${busy==='email' ? ' btn-busy' : ''}`} style={{padding:'6px 22px 6px 14px'}} onClick={saveEmail}>Mentés</button>
                    <button className="btn" style={{padding:'6px 10px'}} onClick={() => setEditingEmail(false)}>✕</button>
                  </div>
                ) : (
                  <div style={{display:'flex',gap:8,alignItems:'center',marginTop:6}}>
                    <input className="cfg-input" style={{flex:1,opacity:.6,cursor:'not-allowed'}} value={data.email} readOnly />
                    <button className="btn" style={{padding:'6px 12px'}} onClick={() => { setEditEmail(data.email); setEditingEmail(true); }}>{ICO.edit}</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {data.bots.length > 0 && (
          <div className="cfg-card" style={{gridColumn:'1 / -1'}}>
            <div className="cfg-head"><div className="ico">{ICO.bots}</div><h3>Botok</h3><span style={{marginLeft:'auto',fontSize:12,color:'var(--ink-faint)'}}>{data.stats.total_bots} saját · {data.stats.shared_bots} megosztott</span></div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:12}}>
              {data.bots.map(b => {
                const short = b.bot_name ? b.bot_name[0].toUpperCase() : '?';
                return (
                  <div key={b.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'var(--glass)',border:'1px solid var(--line)',borderRadius:12}}>
                    {b.bot_avatar
                      ? <img src={b.bot_avatar} alt={b.bot_name} style={{width:36,height:36,borderRadius:10,objectFit:'cover',flexShrink:0}} />
                      : <div style={{width:36,height:36,borderRadius:10,background:'var(--glass-2)',border:'1px solid var(--line)',display:'grid',placeItems:'center',fontSize:14,fontWeight:700,flexShrink:0}}>{short}</div>
                    }
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.bot_name}</div>
                      <div style={{fontSize:11,color:'var(--ink-faint)',marginTop:2}}>{b.guild_name || b.bot_id}</div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4,flexShrink:0}}>
                      <span style={{fontSize:10,padding:'2px 6px',borderRadius:4,background: b.is_active ? 'rgba(74,222,128,.12)' : 'rgba(255,255,255,.06)', color: b.is_active ? '#4ade80' : 'var(--ink-faint)', border:`1px solid ${b.is_active ? 'rgba(74,222,128,.3)' : 'var(--line)'}`}}>
                        {b.is_active ? 'Online' : 'Offline'}
                      </span>
                      <button className="btn" style={{fontSize:11,padding:'3px 8px'}} onClick={() => openBot({ id: b.id, bot_name: b.bot_name, bot_avatar: b.bot_avatar, bot_id: b.bot_id, guild_name: b.guild_name, owned: false })}>
                        Megnyitás
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function UsersPage({ goBack, openBot, userPerms }) {
  const [users, setUsers]     = useDState([]);
  const [loading, setLoading] = useDState(true);
  const [search, setSearch]   = useDState('');
  const [selected, setSelected] = useDState(null);

  useDEffect(() => {
    const t = localStorage.getItem('vh_token');
    fetch('/api/users', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setUsers(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (selected) return (
    <UserDetailPage
      userId={selected}
      onBack={() => setSelected(null)}
      openBot={openBot}
      userPerms={userPerms}
    />
  );

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.discord_username || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-head">
        <div>
          <button className="page-back" onClick={goBack}>{ICO.back} Vissza</button>
          <h1 className="page-title">Felhasználók</h1>
          <div className="page-sub">{users.length} regisztrált fiók</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="search">{ICO.search}<input placeholder="Keresés név, email alapján..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      </div>

      {loading ? <SkeletonUserList /> : (
        <div className="user-list">
          <div className="user-list-head">
            <span>Felhasználó</span>
            <span>Discord</span>
            <span>Regisztráció</span>
            <span>Állapot</span>
          </div>
          {filtered.length === 0 && <div style={{color:'var(--ink-faint)',textAlign:'center',padding:40}}>Nincs találat.</div>}
          {filtered.map(u => {
            const isLocked = u.locked_until && Date.now() < u.locked_until;
            const isBanned = !!u.is_banned;
            return (
              <div key={u.id} className="user-row" onClick={() => setSelected(u.id)}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  {u.avatar
                    ? <img src={u.avatar} alt={u.name} style={{width:36,height:36,borderRadius:'50%',objectFit:'cover',flexShrink:0}} />
                    : <div style={{width:36,height:36,borderRadius:'50%',background:'#6c63ff',display:'grid',placeItems:'center',fontSize:14,fontWeight:700,color:'#fff',flexShrink:0}}>{u.name[0].toUpperCase()}</div>
                  }
                  <div>
                    <div style={{fontWeight:600,fontSize:14}}>{u.name}</div>
                    <div style={{fontSize:12,color:'var(--ink-faint)',marginTop:1}}>{u.email}</div>
                  </div>
                </div>
                <div style={{fontSize:13,color:'var(--ink-faint)'}}>{u.discord_username || '—'}</div>
                <div style={{fontSize:13,color:'var(--ink-faint)'}}>{fmtDate(u.created_at)}</div>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  {u.is_online && <span className="status-pill live" style={{fontSize:11,padding:'2px 8px'}}><span className="pdot"></span>Online</span>}
                  {isBanned && <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'rgba(248,113,113,.12)',border:'1px solid rgba(248,113,113,.3)',color:'#f87171'}}>Kitiltva</span>}
                  {!isBanned && isLocked && <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'rgba(251,146,60,.12)',border:'1px solid rgba(251,146,60,.3)',color:'#fb923c'}}>Zárolva</span>}
                  {!u.email_verified && <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'rgba(248,113,113,.1)',border:'1px solid rgba(248,113,113,.25)',color:'#f87171'}}>Nem verifikált</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
