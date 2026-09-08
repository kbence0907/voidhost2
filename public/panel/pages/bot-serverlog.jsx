const MODLOG_LABELS = {
  ban: { l: '🔨 Kitiltás', c: '#ff6b81' },
  unban: { l: '✅ Kitiltás feloldva', c: '#34d399' },
  unbanall: { l: '✅ Összes kitiltás feloldva', c: '#34d399' },
  kick: { l: '👢 Kirúgás', c: '#fbbf24' },
  timeout: { l: '⏳ Felfüggesztés', c: '#fbbf24' },
  untimeout: { l: '✅ Felfüggesztés feloldva', c: '#34d399' },
  mute: { l: '🔇 Némítás', c: '#fbbf24' },
  unmute: { l: '🔊 Némítás feloldva', c: '#34d399' },
};

function modLogLabel(action) {
  if (action.startsWith('automod:')) {
    const sub = { profanity: 'káromkodás', gif: 'GIF', content: 'kép/videó', mentions: 'tömeges említés', emoji: 'emoji spam', repeated: 'ismételt üzenet' }[action.slice(8)] ?? action.slice(8);
    return { l: `🛡 AutoMod · ${sub}`, c: '#818cf8' };
  }
  return MODLOG_LABELS[action] ?? { l: action, c: 'var(--ink-dim)' };
}

const SL_EVENTS = [
  { key: 'messageDelete', label: 'Üzenet törlés',       desc: 'Törölt üzenetek naplózása (szöveg, szerző, csatorna).' },
  { key: 'messageEdit',   label: 'Üzenet szerkesztés',  desc: 'Szerkesztett üzenetek naplózása (régi és új szöveg).' },
  { key: 'messageSend',   label: 'Üzenet küldés',       desc: 'Minden elküldött üzenet naplózása. Nagy forgalomnál sok bejegyzést jelent!' },
  { key: 'voice',         label: 'Hangcsatorna mozgás', desc: 'Belépett, kilépett vagy átment egy másik hangcsatornába.' },
  { key: 'voiceMute',     label: 'Némítás / süketítés', desc: 'Lenémította / lesüketítette magát, vagy szerver oldali némítás történt.' },
  { key: 'member',        label: 'Tagok',               desc: 'Csatlakozás, kilépés, kitiltás, kitiltás feloldása, becenév változás.' },
  { key: 'memberRoles',   label: 'Tag rangjai',         desc: 'Rangot kapott vagy elvettek tőle egy rangot.' },
  { key: 'roles',         label: 'Rangok',              desc: 'Rang létrehozása, törlése, átnevezése, jogosultságok változása.' },
  { key: 'channels',      label: 'Csatornák',           desc: 'Csatorna létrehozása, törlése, átnevezése.' },
];

const SL_DEF = {
  channelId: '',
  embedColor: '#5865f2',
  events: Object.fromEntries(SL_EVENTS.map(e => [e.key, { enabled: e.key !== 'messageSend', channelId: '' }])),
};

function mergeSlConfig(raw) {
  const out = {
    channelId:  typeof raw?.channelId === 'string' ? raw.channelId : '',
    embedColor: typeof raw?.embedColor === 'string' ? raw.embedColor : SL_DEF.embedColor,
    events: {},
  };
  for (const e of SL_EVENTS) {
    const ev = raw?.events?.[e.key];
    out.events[e.key] = {
      enabled:   ev ? !!ev.enabled : SL_DEF.events[e.key].enabled,
      channelId: typeof ev?.channelId === 'string' ? ev.channelId : '',
    };
  }
  return out;
}

function SlChannelSelect({ value, onChange, channels, placeholder }) {
  const known = channels.some(c => c.id === value);
  return (
    <select className="cfg-input" value={known || !value ? value : '_manual'} onChange={e => onChange(e.target.value === '_manual' ? value : e.target.value)}>
      <option value="">{placeholder}</option>
      {!known && value && <option value="_manual">#ismeretlen ({value})</option>}
      {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
    </select>
  );
}

function ServerLogPage({ bot, goBack, onUnsaved, moduleOn = true, onToggleModule }) {
  const [cfg, setCfg]           = useDState(null);
  const [orig, setOrig]         = useDState(null);
  const [loading, setLoading]   = useDState(true);
  const [saving, setSaving]     = useDState(false);
  const [channels, setChannels] = useDState([]);

  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('vh_token')}` });

  useDEffect(() => {
    Promise.all([
      fetch(`/api/bots/${bot.id}/serverlog`, { headers: auth() }).then(r => r.ok ? r.json() : null),
      fetch(`/api/bots/${bot.id}/guild/channels`, { headers: auth() }).then(r => r.ok ? r.json() : []),
    ]).then(([data, chs]) => {
      const c = mergeSlConfig(data);
      setCfg(c); setOrig(JSON.parse(JSON.stringify(c)));
      setChannels(Array.isArray(chs) ? chs : []);
    }).catch(() => {
      const c = mergeSlConfig(null);
      setCfg(c); setOrig(JSON.parse(JSON.stringify(c)));
    }).finally(() => setLoading(false));
    return () => onUnsaved(false);
  }, [bot.id]);

  const dirty = useDMemo(() => cfg && orig && JSON.stringify(cfg) !== JSON.stringify(orig), [cfg, orig]);
  useDEffect(() => { onUnsaved(!!dirty); }, [dirty]);

  const set   = (field, val)      => setCfg(prev => ({ ...prev, [field]: val }));
  const setEv = (key, field, val) => setCfg(prev => ({ ...prev, events: { ...prev.events, [key]: { ...prev.events[key], [field]: val } } }));
  const setAll = (on) => setCfg(prev => ({ ...prev, events: Object.fromEntries(Object.entries(prev.events).map(([k, v]) => [k, { ...v, enabled: on }])) }));

  function reset() { setCfg(JSON.parse(JSON.stringify(orig))); }

  async function save() {
    setSaving(true);
    const snap = JSON.parse(JSON.stringify(cfg));
    const r = await fetch(`/api/bots/${bot.id}/serverlog`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...auth() },
      body: JSON.stringify(snap),
    }).catch(() => null);
    if (r?.ok) { setOrig(snap); toast('Szerver napló beállítások mentve!'); }
    else toast('Mentési hiba, próbáld újra.', 'err');
    setSaving(false);
  }

  if (loading) return <SkeletonCards />;

  const anyActive = Object.entries(cfg.events).some(([k, ev]) => ev.enabled && (ev.channelId || cfg.channelId));

  return (
    <>
      <div className="page-head">
        <div>
          <button className="page-back" onClick={goBack}>{ICO.back} Vissza</button>
          <h1 className="page-title">Szerver Napló</h1>
          <div className="page-sub">Szerver események naplózása Discord csatornába.</div>
        </div>
        <div className="page-actions" style={{alignItems:'center',gap:12}}>
          <span className={`status-pill ${moduleOn ? 'live' : 'off'}`}>
            <span className="pdot"></span>{moduleOn ? (anyActive ? 'Aktív' : 'Bekapcsolva') : 'Kikapcsolva'}
          </span>
          <div className={`toggle ${moduleOn ? 'on' : ''}`} onClick={onToggleModule} style={{cursor:'pointer'}} title={moduleOn ? 'Modul kikapcsolása' : 'Modul bekapcsolása'}></div>
        </div>
      </div>

      <div className={`module-body ${moduleOn ? '' : 'module-off'}`}>
      <div className="config-grid">

        <div className="cfg-card" style={{gridColumn:'1 / -1'}}>
          <div className="cfg-head"><div className="ico">{ICO.log}</div><h3>Globális beállítások</h3></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:20}}>
            <div className="cfg-field" style={{margin:0}}>
              <label>Globális napló csatorna</label>
              <SlChannelSelect value={cfg.channelId} onChange={v => set('channelId', v)} channels={channels} placeholder="— Válassz csatornát —" />
              <div style={{fontSize:11,color:'var(--ink-faint)',marginTop:6}}>Ide kerül minden esemény, aminél nincs külön csatorna megadva.</div>
            </div>
            <div className="cfg-field" style={{margin:0}}>
              <label>Embed szín</label>
              <div style={{display:'flex',gap:10,alignItems:'center',marginTop:6}}>
                <input type="color" value={cfg.embedColor} onChange={e => set('embedColor', e.target.value)} style={{width:36,height:36,border:'1px solid var(--line)',borderRadius:6,background:'none',cursor:'pointer',padding:2}} />
                <input className="cfg-input" style={{width:110,fontFamily:"'JetBrains Mono',monospace",fontSize:13}} value={cfg.embedColor} onChange={e => set('embedColor', e.target.value)} maxLength={7} />
              </div>
            </div>
            <div className="cfg-field" style={{margin:0}}>
              <label>Gyors kapcsolók</label>
              <div style={{display:'flex',gap:8,marginTop:6}}>
                <button className="btn" onClick={() => setAll(true)}>Összes be</button>
                <button className="btn" onClick={() => setAll(false)}>Összes ki</button>
              </div>
              <div style={{fontSize:11,color:'var(--ink-faint)',marginTop:6}}>Az összes esemény naplózásának be- vagy kikapcsolása egy kattintással.</div>
            </div>
          </div>
        </div>

        {SL_EVENTS.map(e => {
          const ev = cfg.events[e.key];
          return (
            <div className="cfg-card" key={e.key}>
              <div className="cfg-head"><div className="ico">{ICO.log}</div><h3>{e.label}</h3></div>
              <div className="row-toggle" onClick={() => setEv(e.key, 'enabled', !ev.enabled)}>
                <div className={`toggle ${ev.enabled ? 'on' : ''}`}></div>
                <div className="lbl">Engedélyezve</div>
              </div>
              <div style={{fontSize:12,color:'var(--ink-faint)',marginBottom:10}}>{e.desc}</div>
              <div className={`module-body ${ev.enabled ? '' : 'module-off'}`}>
                <div className="cfg-field">
                  <label>Csatorna <em>· opcionális</em></label>
                  <SlChannelSelect value={ev.channelId} onChange={v => setEv(e.key, 'channelId', v)} channels={channels} placeholder="— Globális csatorna —" />
                </div>
              </div>
            </div>
          );
        })}

      </div>
      </div>

      {dirty && <UnsavedBar onReset={reset} onSave={save} saving={saving} />}
    </>
  );
}

function ModLogPage({ bot, goBack, onUnsaved }) {
  const [logs, setLogs]       = useDState([]);
  const [loading, setLoading] = useDState(true);
  const [search, setSearch]   = useDState('');

  useDEffect(() => {
    onUnsaved?.(false);
    const t = localStorage.getItem('vh_token');
    fetch(`/api/bots/${bot.id}/modlogs`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => setLogs(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bot.id]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? logs.filter(l => [l.action, l.moderator, l.target, l.reason, l.detail].some(v => (v ?? '').toLowerCase().includes(q)))
    : logs;

  return (
    <>
      <div className="page-head">
        <div>
          <button className="page-back" onClick={goBack}>{ICO.back} Vissza</button>
          <h1 className="page-title">Parancs log</h1>
          <div className="page-sub">Ki, mikor, milyen moderációs parancsot használt.</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          {ICO.search}
          <input placeholder="Keresés (moderátor, célszemély, indok)..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? <SkeletonCards count={2} /> : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.length === 0 && (
            <div style={{color:'var(--ink-faint)',textAlign:'center',padding:40}}>Még nincs moderációs esemény.</div>
          )}
          {filtered.map((l, i) => {
            const lab = modLogLabel(l.action ?? '');
            return (
              <div key={i} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 16px',background:'var(--glass)',border:'1px solid var(--line)',borderRadius:12,flexWrap:'wrap'}}>
                <span style={{fontSize:12,fontWeight:600,color:lab.c,whiteSpace:'nowrap'}}>{lab.l}</span>
                <div style={{flex:1,minWidth:180,fontSize:13}}>
                  <span style={{fontWeight:600}}>{l.moderator || 'Ismeretlen'}</span>
                  {l.target && <span style={{color:'var(--ink-dim)'}}> → {l.target}</span>}
                  {l.reason && <span style={{color:'var(--ink-faint)'}}> · {l.reason}</span>}
                  {l.detail && <div style={{fontSize:12,color:'var(--ink-faint)',marginTop:2,fontFamily:"'JetBrains Mono',monospace",overflow:'hidden',textOverflow:'ellipsis'}}>{l.detail}</div>}
                </div>
                <span style={{fontSize:12,color:'var(--ink-faint)',whiteSpace:'nowrap'}}>{new Date(l.ts).toLocaleString('hu-HU')}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
