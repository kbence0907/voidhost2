function AnimStat({ label, value, loading }) {
  const displayed = useCountUp(loading ? null : (value ?? 0));
  const fmt = (n) => n.toLocaleString('hu-HU');
  return (
    <div className="stat">
      <div className="l">{label}</div>
      <div className="v">{loading ? '—' : fmt(displayed)}</div>
    </div>
  );
}

function HomePage({ user, setRoute }) {
  const [stats, setStats]     = useDState(null);
  const [loading, setLoading] = useDState(true);

  function loadStats() {
    const t = localStorage.getItem('vh_token');
    fetch('/api/home', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStats(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useDEffect(() => {
    loadStats();
    const iv = setInterval(loadStats, 30000);
    return () => clearInterval(iv);
  }, []);

  function eventLabel(ev) {
    if (ev.event === 'register') return { icon: ICO.user,   cls: '',     title: 'Új felhasználó regisztrált a panelra' };
    if (ev.event === 'user_ban') return { icon: ICO.shield, cls: 'warn', title: 'Egy felhasználó ki lett tiltva' };
    return null;
  }

  const events = (stats?.events ?? []).map(ev => ({ ...ev, label: eventLabel(ev) })).filter(ev => ev.label);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title-row">
            <h1 className="page-title">Üdv vissza, {user?.name || 'Felhasználó'}.</h1>
          </div>
          <div className="page-sub">Saját botjaid és tevékenységek áttekintése</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setRoute('bots')}>Saját botok <span className="arr">→</span></button>
        </div>
      </div>

      <div className="stat-grid">
        <AnimStat label="Saját botjaim"      value={stats?.my_bot_count}     loading={loading} />
        <AnimStat label="Aktív bot"          value={stats?.active_bot_count} loading={loading} />
        <AnimStat label="Összes üzenet"      value={stats?.total_messages}   loading={loading} />
        <AnimStat label="Regisztrált felhasználók" value={stats?.total_registered} loading={loading} />
      </div>

      <div className="cfg-card" style={{maxWidth:620}}>
        <div className="cfg-head">
          <div className="ico">{ICO.log}</div>
          <h3>Legutóbbi események</h3>
        </div>
        {loading ? (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {[1,2,3].map(i => <div key={i} style={{height:44,borderRadius:8,background:'var(--glass)',border:'1px solid var(--line)'}} />)}
          </div>
        ) : events.length === 0 ? (
          <div style={{textAlign:'center',padding:'28px 0',color:'var(--ink-faint)',fontSize:13}}>Nincs esemény</div>
        ) : (
          <div className="activity-list">
            {events.map((ev, i) => (
              <div key={i} className="activity-item">
                <div className={`dot-ico ${ev.label.cls}`}>{ev.label.icon}</div>
                <div className="body">
                  <div className="title">{ev.label.title}</div>
                </div>
                <div className="time">{fmtRelative(ev.ts)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
