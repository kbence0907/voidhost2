const EVENT_LEVEL = {
  login:         'ok',
  verified:      'ok',
  bot_start:     'ok',
  bot_restart:   'ok',
  bot_create:    'ok',
  register:      'info',
  member_add:    'info',
  perm_change:   'info',
  rank_edit:     'info',
  bot_stop:      'warn',
  bot_delete:    'warn',
  member_remove: 'warn',
};

function fmtTs(ts) {
  const d = new Date(ts);
  return d.toLocaleString('hu-HU', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function LogsPage({ goBack }) {
  const [logs, setLogs]       = useDState([]);
  const [loading, setLoading] = useDState(true);
  const [query, setQuery]     = useDState('');
  const timerRef              = React.useRef(null);

  function fetchLogs(q = '') {
    const t = localStorage.getItem('vh_token');
    const url = q ? `/api/logs?q=${encodeURIComponent(q)}` : '/api/logs';
    fetch(url, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setLogs(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useDEffect(() => { fetchLogs(); }, []);

  function onSearch(v) {
    setQuery(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchLogs(v.trim()), 300);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <button className="page-back" onClick={goBack}>{ICO.back} Vissza</button>
          <h1 className="page-title">Napló</h1>
          <div className="page-sub">Minden tevékenység rögzítve. Nem törölhető.</div>
        </div>
        <div className="page-actions">
          <span className="status-pill live"><span className="pdot"></span>{logs.length} bejegyzés</span>
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          {ICO.search}
          <input
            placeholder="Keresés a naplóban..."
            value={query}
            onChange={e => onSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="log-list">
        {loading && [...Array(8)].map((_,i) => <div key={i} className="log-item" style={{gap:10}}><Sk w={90} h={12}/><Sk w={70} h={18} r={4}/><Sk h={12}/><Sk w={60} h={12}/></div>)}
        {!loading && logs.length === 0 && <div style={{color:'var(--ink-faint)',padding:'40px 0'}}>Nincs találat.</div>}
        {logs.map(l => {
          const level = EVENT_LEVEL[l.event] ?? 'info';
          return (
            <div key={l.id} className="log-item">
              <span className="ts">{fmtTs(l.ts)}</span>
              <span className={`level ${level}`}>{l.event}</span>
              <span className="msg">{l.msg}</span>
              <span className="src">{l.src}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
