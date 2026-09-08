function Sparkline({ data, color, gradId, max: forcedMax, height = 64 }) {
  const W = 400, H = height;
  if (!data || data.length < 2) {
    return (
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{display:'block'}}>
        <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke={color} strokeWidth="1" strokeOpacity="0.2" />
      </svg>
    );
  }
  const maxVal = forcedMax || Math.max(...data, 1);
  const pad = 3;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - pad - (v / maxVal) * (H - pad * 2);
    return [x, y];
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{display:'block'}}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function BotConsolePage({ bot, goBack, onUnsaved, user }) {
  const EMPTY = { running: false, cpu: 0, ram: 0, uptime: 0, history: [], logs: [] };
  const [status, setStatus]       = useDState(EMPTY);
  const [loading, setLoading]     = useDState(true);
  const [actionBusy, setActionBusy] = useDState(false);
  const [logOffset, setLogOffset] = useDState(0);
  const logRef    = React.useRef(null);
  const intervalRef = React.useRef(null);

  const mp           = bot.member_perms || null;
  const isAdminView  = bot.owned === false && !mp;
  const hasManage    = !!user?.perms?.manageOthersBots;
  const canStart     = isAdminView ? hasManage : (!mp || mp.canStart);
  const canStop      = isAdminView ? hasManage : (!mp || mp.canStop);
  const canRestart   = isAdminView ? hasManage : (!mp || mp.canRestart);
  const canClearLogs = isAdminView ? hasManage : (!mp || mp.canClearLogs);

  useDEffect(() => { onUnsaved(false); }, [bot.id]);

  function fetchStatus() {
    const t = localStorage.getItem('vh_token');
    return fetch(`/api/bots/${bot.id}/status`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStatus(data); })
      .catch(() => {});
  }

  useDEffect(() => {
    fetchStatus().finally(() => setLoading(false));
    intervalRef.current = setInterval(fetchStatus, 2000);
    return () => clearInterval(intervalRef.current);
  }, [bot.id]);

  useDEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [status.logs.length]);

  async function doAction(action) {
    setActionBusy(true);
    const t = localStorage.getItem('vh_token');
    await fetch(`/api/bots/${bot.id}/${action}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` },
    }).catch(() => {});
    await fetchStatus();
    setActionBusy(false);
  }

  function fmtUptime(s) {
    if (!s) return '0 mp';
    if (s < 60)   return `${s} mp`;
    if (s < 3600) return `${Math.floor(s/60)} p ${s%60} mp`;
    return `${Math.floor(s/3600)} ó ${Math.floor((s%3600)/60)} p`;
  }

  const cpuData = status.history.map(h => h.cpu);
  const ramData = status.history.map(h => h.ram);
  const maxRam  = Math.max(...ramData, 100);
  const visLogs = status.logs.slice(logOffset);
  const { running, cpu, ram, uptime } = status;

  if (loading) return <SkeletonCards />;

  if (isAdminView && !hasManage) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'60%',gap:12,textAlign:'center'}}>
      <div style={{width:48,height:48,borderRadius:14,background:'var(--glass)',border:'1px solid var(--line)',display:'grid',placeItems:'center'}}>{ICO.shield}</div>
      <div style={{fontWeight:600}}>Nincs hozzáférésed ehhez a konzolhoz.</div>
      <div style={{fontSize:13,color:'var(--ink-faint)'}}>A <b>Mások botját kezeli</b> jog szükséges.</div>
    </div>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <button className="page-back" onClick={goBack}>{ICO.back} Vissza</button>
          <h1 className="page-title">Konzol</h1>
          <div className="page-sub">A {bot.bot_name} bot vezérlése és élő monitoringja.</div>
        </div>
        <div className="page-actions">
          {canStart && <button
            className="btn btn-primary"
            disabled={running || actionBusy}
            style={running ? {opacity:.4,cursor:'not-allowed'} : {}}
            onClick={() => doAction('start')}
          >▶ Indítás</button>}
          {canStop && <button
            className="btn"
            disabled={!running || actionBusy}
            style={!running ? {opacity:.4,cursor:'not-allowed'} : {borderColor:'rgba(255,107,129,0.35)',color:'var(--red)'}}
            onClick={() => doAction('stop')}
          >■ Leállítás</button>}
          {canRestart && <button
            className="btn"
            disabled={actionBusy}
            onClick={() => doAction('restart')}
          >↺ Újraindítás</button>}
          {running
            ? <span className="status-pill live"><span className="pdot"></span>Online</span>
            : <span className="status-pill off"><span className="pdot"></span>Leállítva</span>
          }
        </div>
      </div>

      <div className="stat-grid" style={{marginBottom:20}}>
        <div className="stat">
          <div className="l">CPU</div>
          <div className="v" style={{color: running ? (cpu>60?'var(--red)':cpu>40?'var(--amber)':'var(--green)') : 'var(--ink-faint)'}}>
            {running ? cpu : 0}<em>%</em>
          </div>
        </div>
        <div className="stat">
          <div className="l">RAM</div>
          <div className="v">{running ? ram : 0}<em> MB</em></div>
        </div>
        <div className="stat">
          <div className="l">Uptime</div>
          <div className="v" style={{fontSize:20}}>{running ? fmtUptime(uptime) : '—'}</div>
        </div>
        <div className="stat">
          <div className="l">Állapot</div>
          <div className="v" style={{fontSize:18,color: running ? 'var(--green)' : 'var(--ink-faint)'}}>
            {running ? 'Fut' : 'Leáll.'}
          </div>
        </div>
      </div>

      <div className="split-2" style={{marginBottom:20}}>
        <div className="cfg-card" style={{padding:'16px 20px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:10}}>
            <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',color:'var(--ink-faint)',textTransform:'uppercase'}}>CPU Terhelés</span>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:14,color:'#4d7cff',fontWeight:700}}>
              {running ? cpu : 0}%
            </span>
          </div>
          <Sparkline data={cpuData} color="#4d7cff" gradId="grad-cpu" max={100} height={68} />
          <div style={{display:'flex',justifyContent:'space-between',marginTop:6,fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:'var(--ink-faint)'}}>
            <span>0%</span><span>100%</span>
          </div>
        </div>
        <div className="cfg-card" style={{padding:'16px 20px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:10}}>
            <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',color:'var(--ink-faint)',textTransform:'uppercase'}}>Memória (RAM)</span>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:14,color:'var(--green)',fontWeight:700}}>
              {running ? ram : 0} MB
            </span>
          </div>
          <Sparkline data={ramData} color="#6fe39a" gradId="grad-ram" max={maxRam} height={68} />
          <div style={{display:'flex',justifyContent:'space-between',marginTop:6,fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:'var(--ink-faint)'}}>
            <span>0 MB</span><span>{maxRam} MB</span>
          </div>
        </div>
      </div>

      <div className="cfg-card">
        <div className="cfg-head">
          <div className="ico">{ICO.log}</div>
          <h3>Napló</h3>
          <span style={{marginLeft:'auto',fontSize:11,color:'var(--ink-faint)',fontFamily:"'JetBrains Mono',monospace"}}>
            {visLogs.length} bejegyzés
          </span>
        </div>
        <div
          ref={logRef}
          style={{
            background:'rgba(0,0,0,0.4)',
            border:'1px solid var(--line)',
            borderRadius:10,
            padding:'12px 16px',
            height:360,
            overflowY:'auto',
            overscrollBehavior:'contain',
            fontFamily:"'JetBrains Mono',monospace",
            fontSize:12.5,
            lineHeight:1.85,
          }}
        >
          {visLogs.length === 0 && <span style={{color:'var(--ink-faint)'}}>— nincs bejegyzés —</span>}
          {visLogs.map((l, i) => {
            const TAG_COLORS = { 'meghívók': '#34d399', 'auto-start': '#60a5fa', 'hiba': '#f87171' };
            const tagMatch = l.msg.match(/^\[([^\]]+)\]\s*/);
            const tag  = tagMatch ? tagMatch[1] : null;
            const rest = tagMatch ? l.msg.slice(tagMatch[0].length) : l.msg;
            const tagColor = tag ? (TAG_COLORS[tag] ?? '#a78bfa') : null;
            return (
              <div key={i}>
                <span style={{color:'var(--ink-faint)'}}>{l.ts}</span>
                {l.user && <>{' '}<span style={{color:'#a78bfa',fontWeight:600}}>[{l.user}]</span></>}
                {tag && <>{' '}<span style={{color:tagColor,fontWeight:600}}>[{tag}]</span></>}
                {' '}
                <span style={{color:'var(--ink)'}}>{rest}</span>
              </div>
            );
          })}
        </div>
        {canClearLogs && (
          <div style={{display:'flex',justifyContent:'flex-end',marginTop:12}}>
            <button className="btn" style={{fontSize:12}} onClick={() => setLogOffset(status.logs.length)}>
              {ICO.trash} Törlés
            </button>
          </div>
        )}
      </div>
    </>
  );
}
