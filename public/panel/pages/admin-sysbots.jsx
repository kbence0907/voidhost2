function fmtUptime(sec) {
  if (!sec || sec < 1) return '—';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}n ${h}ó`;
  if (h > 0) return `${h}ó ${m}p`;
  return `${m}p`;
}

function fmtRam(mb) {
  if (!mb) return '0 MB';
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
}

function SysBotsPage({ goBack }) {
  const [data, setData]       = useDState(null);
  const [loading, setLoading] = useDState(true);
  const [search, setSearch]   = useDState('');
  const [err, setErr]         = useDState('');

  function load(silent) {
    if (!silent) setLoading(true);
    const t = localStorage.getItem('vh_token');
    fetch('/api/sys/bots', { headers: { Authorization: `Bearer ${t}` } })
      .then(async r => {
        if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Hiba'); }
        return r.json();
      })
      .then(d => { setData(d); setErr(''); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }

  useDEffect(() => {
    load();
    const iv = setInterval(() => load(true), 5000);
    return () => clearInterval(iv);
  }, []);

  const s = data?.summary ?? { total: 0, online: 0, offline: 0, total_ram: 0, total_members: 0, total_commands: 0 };
  const q = search.trim().toLowerCase();
  const bots = (data?.bots ?? []).filter(b =>
    !q ||
    (b.bot_name || '').toLowerCase().includes(q) ||
    (b.guild_name || '').toLowerCase().includes(q) ||
    (b.owner_name || '').toLowerCase().includes(q) ||
    (b.owner_email || '').toLowerCase().includes(q) ||
    (b.bot_id || '').includes(q)
  );

  return (
    <>
      <div className="page-head">
        <div>
          <button className="page-back" onClick={goBack}>{ICO.back} Vissza</button>
          <h1 className="page-title">Rendszer — botok</h1>
          <div className="page-sub">A platformon regisztrált összes bot valós státusza.</div>
        </div>
      </div>

      {err ? (
        <div style={{color:'var(--red)',background:'rgba(255,107,129,.08)',border:'1px solid rgba(255,107,129,.25)',borderRadius:12,padding:'14px 18px',fontSize:13}}>{err}</div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat"><div className="l">Összes bot</div><div className="v">{s.total}</div></div>
            <div className="stat"><div className="l">Online</div><div className="v" style={{color:'var(--green)'}}>{s.online}</div></div>
            <div className="stat"><div className="l">Leállítva</div><div className="v" style={{color:'var(--ink-faint)'}}>{s.offline}</div></div>
            <div className="stat"><div className="l">Memória (össz)</div><div className="v">{fmtRam(s.total_ram)}</div></div>
          </div>

          <div className="toolbar" style={{marginTop:20}}>
            <div className="search">{ICO.search}<input placeholder="Keresés bot, szerver, tulajdonos alapján..." value={search} onChange={e => setSearch(e.target.value)} /></div>
            <div style={{fontSize:12,color:'var(--ink-faint)'}}>{bots.length} / {s.total} bot · {s.total_members.toLocaleString('hu-HU')} tag · {s.total_commands} parancs</div>
          </div>

          {loading && !data ? (
            <div className="bot-grid">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bot-card" style={{display:'flex',flexDirection:'column',gap:12}}>
                  <div style={{display:'flex',gap:12,alignItems:'center'}}><Sk w={44} h={44} r={12}/><div style={{flex:1,display:'flex',flexDirection:'column',gap:6}}><Sk h={14} w="60%"/><Sk h={10} w="40%"/></div></div>
                  <Sk h={13}/><Sk h={30} r={8}/>
                </div>
              ))}
            </div>
          ) : bots.length === 0 ? (
            <div style={{textAlign:'center',color:'var(--ink-faint)',padding:'50px 0',fontSize:13}}>
              {s.total === 0 ? 'Még nincs egyetlen bot sem a rendszerben.' : 'Nincs találat a keresésre.'}
            </div>
          ) : (
            <div className="bot-grid">
              {bots.map(b => (
                <div key={b.id} className="bot-card">
                  <div className="top">
                    {b.bot_avatar
                      ? <img src={b.bot_avatar} alt={b.bot_name} className="av" style={{objectFit:'cover',padding:0}} />
                      : <div className="av">{(b.bot_name || '?')[0].toUpperCase()}</div>
                    }
                    <div style={{minWidth:0}}>
                      <div className="name" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.bot_name}</div>
                      <div className="id">{b.guild_name || b.bot_id}</div>
                    </div>
                  </div>

                  <div style={{fontSize:12,color:'var(--ink-faint)',marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
                    <span style={{width:6,height:6,borderRadius:'50%',flexShrink:0,background: b.owner_online ? 'var(--green)' : 'var(--ink-faint)'}} />
                    Tulaj: <span style={{color:'var(--ink-dim)'}}>{b.owner_name}</span>
                  </div>

                  <div className="stats">
                    <span><b>CPU</b> {b.is_active ? b.cpu + '%' : '—'}</span>
                    <span><b>RAM</b> {b.is_active ? fmtRam(b.ram) : '—'}</span>
                    <span><b>Tagok</b> {(b.guild_member_count || 0).toLocaleString('hu-HU')}</span>
                  </div>

                  <div className="footer">
                    <span className={b.is_active ? 'pill-on' : 'pill-off'}>
                      {b.is_active ? 'ONLINE' : 'LEÁLLÍTVA'}
                    </span>
                    <span style={{color:'var(--ink-faint)'}}>
                      {b.is_active ? `uptime ${fmtUptime(b.uptime)}` : `${b.cmd_count} parancs`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
