const TK_BTN_STYLES = [
  { v: 'primary',   l: 'Kék' },
  { v: 'success',   l: 'Zöld' },
  { v: 'secondary', l: 'Szürke' },
  { v: 'danger',    l: 'Piros' },
];

function tkId(prefix) {
  try { return crypto.randomUUID(); } catch { return prefix + Date.now().toString(16) + Math.random().toString(16).slice(2, 8); }
}

function tkEmptyQuestion() {
  return { label: 'Kérdés', placeholder: '', style: 'short', required: true, maxLength: 300 };
}

function tkEmptyCategory() {
  return {
    id: tkId('c_'),
    label: 'Általános',
    emoji: '❓',
    description: 'Általános kérdések és segítségkérés',
    discordCategoryId: '',
    staffRoleIds: [],
    pingRoleIds: [],
    openMessage: 'Köszönjük, hogy jegyet nyitottál! A csapatunk hamarosan válaszol. Kérlek, addig is írd le részletesen a problémádat.',
    maxOpenPerUser: 0,
    questions: [],
  };
}

function tkEmptyPanel() {
  return {
    id: tkId('p_'),
    name: 'Új panel',
    channelId: '',
    messageId: '',
    embed: {
      title: '🎫 Támogatás',
      description: 'Nyiss egy jegyet a lenti gombbal, és a csapatunk hamarosan válaszol.',
      color: '#5865f2',
      imageUrl: '',
      thumbnailUrl: '',
    },
    button: { label: 'Jegy nyitása', emoji: '🎫', style: 'primary' },
    access: { allowedRoleIds: [], deniedRoleIds: [] },
    maxOpenPerUser: 1,
    categories: [tkEmptyCategory()],
  };
}

function tkMerge(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  return {
    logChannelId: typeof d.logChannelId === 'string' ? d.logChannelId : '',
    transcript: {
      enabled: d.transcript?.enabled !== false,
      deleteDelaySec: Number.isFinite(+d.transcript?.deleteDelaySec) ? +d.transcript.deleteDelaySec : 5,
    },
    panels: Array.isArray(d.panels) ? d.panels.map(p => ({
      ...tkEmptyPanel(),
      ...p,
      id: p.id || tkId('p_'),
      embed: { ...tkEmptyPanel().embed, ...(p.embed || {}) },
      button: { ...tkEmptyPanel().button, ...(p.button || {}) },
      access: { allowedRoleIds: [], deniedRoleIds: [], ...(p.access || {}) },
      categories: Array.isArray(p.categories) ? p.categories.map(c => ({
        ...tkEmptyCategory(), ...c, id: c.id || tkId('c_'),
        staffRoleIds: c.staffRoleIds || [], pingRoleIds: c.pingRoleIds || [],
        questions: Array.isArray(c.questions) ? c.questions.map(q => ({ ...tkEmptyQuestion(), ...q })) : [],
      })) : [],
    })) : [],
  };
}

function TkNativeSelect({ value, onChange, options, placeholder, prefix = '' }) {
  const known = options.some(o => o.id === value);
  return (
    <select className="cfg-input" value={known || !value ? value : '_x'} onChange={e => onChange(e.target.value === '_x' ? value : e.target.value)}>
      <option value="">{placeholder}</option>
      {!known && value && <option value="_x">ismeretlen ({value})</option>}
      {options.map(o => <option key={o.id} value={o.id}>{prefix}{o.name}</option>)}
    </select>
  );
}

function TkColorField({ value, onChange }) {
  return (
    <div style={{display:'flex',gap:10,alignItems:'center',marginTop:6}}>
      <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#5865f2'} onChange={e => onChange(e.target.value)}
        style={{width:36,height:36,border:'1px solid var(--line)',borderRadius:6,background:'none',cursor:'pointer',padding:2}} />
      <input className="cfg-input" style={{width:110,fontFamily:"'JetBrains Mono',monospace",fontSize:13}} value={value} onChange={e => onChange(e.target.value)} maxLength={7} />
    </div>
  );
}

function TkPanelPreview({ panel }) {
  const e = panel.embed;
  const multi = panel.categories.length > 1;
  const styleColor = { primary:'#5865f2', success:'#248046', secondary:'#4e5058', danger:'#da373c' }[panel.button.style] || '#5865f2';
  return (
    <div style={{background:'#313338',borderRadius:8,padding:'12px 14px',border:'1px solid rgba(255,255,255,0.06)'}}>
      <div style={{display:'flex',gap:12}}>
        <div style={{flex:1,minWidth:0,borderLeft:`4px solid ${/^#[0-9a-fA-F]{6}$/.test(e.color)?e.color:'#5865f2'}`,paddingLeft:12}}>
          {e.title && <div style={{fontWeight:700,fontSize:14,color:'#fff',marginBottom:6}}>{e.title}</div>}
          <div style={{color:'#dbdee1',fontSize:13,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{e.description || <span style={{color:'rgba(255,255,255,0.3)'}}>— nincs leírás —</span>}</div>
          {e.imageUrl && <div style={{marginTop:8,fontSize:11,color:'#949ba4'}}>🖼 kép: {e.imageUrl.slice(0,60)}</div>}
        </div>
        {e.thumbnailUrl && <div style={{width:56,height:56,borderRadius:6,background:'#1e1f22',flexShrink:0,display:'grid',placeItems:'center',fontSize:10,color:'#949ba4'}}>thumb</div>}
      </div>
      <div style={{marginTop:12}}>
        {multi ? (
          <div style={{background:'#1e1f22',border:'1px solid #232428',borderRadius:6,padding:'9px 12px',color:'#b5bac1',fontSize:13,display:'flex',justifyContent:'space-between'}}>
            <span>{panel.button.label || 'Válassz kategóriát...'}</span><span>▾</span>
          </div>
        ) : (
          <span style={{display:'inline-flex',alignItems:'center',gap:6,background:styleColor,color:'#fff',fontSize:13,fontWeight:600,padding:'8px 14px',borderRadius:4}}>
            {panel.button.emoji} {panel.button.label || 'Jegy nyitása'}
          </span>
        )}
      </div>
    </div>
  );
}

function TkQuestionRow({ q, onChange, onRemove }) {
  const set = (k, v) => onChange({ ...q, [k]: v });
  return (
    <div style={{border:'1px solid var(--line)',borderRadius:10,padding:12,marginBottom:8,background:'rgba(0,0,0,0.15)'}}>
      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
        <input className="cfg-input" style={{flex:1}} placeholder="Kérdés címe (pl. Rendelési azonosító)" value={q.label} onChange={e => set('label', e.target.value.slice(0,45))} />
        <button className="btn btn-icon-danger" title="Törlés" onClick={onRemove}>{ICO.trash}</button>
      </div>
      <input className="cfg-input" style={{marginBottom:8}} placeholder="Segítő szöveg (placeholder) – opcionális" value={q.placeholder} onChange={e => set('placeholder', e.target.value.slice(0,100))} />
      <div style={{display:'flex',gap:14,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',gap:6}}>
          {[['short','Rövid'],['paragraph','Hosszú']].map(([v,l]) => (
            <button key={v} className="btn" style={q.style===v?{background:'rgba(108,99,255,0.18)',borderColor:'rgba(108,99,255,0.5)',color:'#a78bfa'}:{}} onClick={() => set('style', v)}>{l}</button>
          ))}
        </div>
        <div className="row-toggle" style={{margin:0}} onClick={() => set('required', !q.required)}>
          <div className={`toggle ${q.required ? 'on' : ''}`}></div><div className="lbl" style={{fontSize:12.5}}>Kötelező</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--ink-faint)'}}>
          max<input className="cfg-input" type="number" min={1} max={1024} style={{width:80}} value={q.maxLength} onChange={e => set('maxLength', Math.max(1, Math.min(1024, parseInt(e.target.value,10)||300)))} />kar.
        </div>
      </div>
    </div>
  );
}

function TkCategoryCard({ cat, idx, roles, dcCategories, onChange, onRemove }) {
  const set = (k, v) => onChange({ ...cat, [k]: v });
  const [open, setOpen] = useDState(false);
  return (
    <div style={{border:'1px solid var(--line)',borderRadius:12,padding:16,marginBottom:12,background:'rgba(8,12,28,0.4)'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}} onClick={() => setOpen(o => !o)}>
        <span style={{fontSize:16}}>{cat.emoji || '🎫'}</span>
        <span style={{fontWeight:600,fontSize:14,flex:1}}>{cat.label || 'Kategória'} <span style={{color:'var(--ink-faint)',fontWeight:400,fontSize:12}}>· {cat.questions.length} kérdés</span></span>
        <button className="btn btn-icon-danger" title="Kategória törlése" onClick={e => { e.stopPropagation(); onRemove(); }}>{ICO.trash}</button>
        <span style={{color:'var(--ink-faint)',fontSize:10}}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{marginTop:14}}>
          <div style={{display:'grid',gridTemplateColumns:'80px 1fr',gap:10,marginBottom:12}}>
            <div className="cfg-field" style={{margin:0}}>
              <label>Emoji</label>
              <input className="cfg-input" value={cat.emoji} onChange={e => set('emoji', e.target.value.slice(0,40))} placeholder="🎫" />
            </div>
            <div className="cfg-field" style={{margin:0}}>
              <label>Kategória neve</label>
              <input className="cfg-input" value={cat.label} onChange={e => set('label', e.target.value.slice(0,60))} placeholder="pl. Panasz" />
            </div>
          </div>

          <div className="cfg-field">
            <label>Leírás <em>· a legördülő menüben jelenik meg</em></label>
            <input className="cfg-input" value={cat.description} onChange={e => set('description', e.target.value.slice(0,100))} placeholder="Rövid leírás..." />
          </div>

          <div className="cfg-field">
            <label>Discord kategória (a jegy csatornák ide kerülnek)</label>
            <TkNativeSelect value={cat.discordCategoryId} onChange={v => set('discordCategoryId', v)} options={dcCategories} placeholder="— Nincs (a szerver tetején jön létre) —" />
          </div>

          <MultiPick label="Support rangok (ők látják és kezelik a jegyet)" items={roles} value={cat.staffRoleIds}
            onChange={v => set('staffRoleIds', v)} placeholder="— Nincs support rang —"
            hint="Ezek a rangok látják a jegy csatornáját, tudnak írni, átvenni és lezárni." />

          <MultiPick label="Értesítendő rangok jegynyitáskor (ping)" items={roles} value={cat.pingRoleIds}
            onChange={v => set('pingRoleIds', v)} placeholder="— Nincs ping —" />

          <div className="cfg-field">
            <label>Nyitó üzenet a jegyben</label>
            <textarea className="cfg-textarea" value={cat.openMessage} onChange={e => set('openMessage', e.target.value.slice(0,3000))} />
          </div>

          <div className="cfg-field">
            <label>Max. egyszerre nyitott jegy / felhasználó ebben a kategóriában</label>
            <input className="cfg-input" type="number" min={0} max={50} style={{width:120}} value={cat.maxOpenPerUser}
              onChange={e => set('maxOpenPerUser', Math.max(0, Math.min(50, parseInt(e.target.value,10)||0)))} />
            <div style={{fontSize:11,color:'var(--ink-faint)',marginTop:5}}>0 = korlátlan</div>
          </div>

          <div className="cfg-field">
            <label>Kérdések jegynyitáskor <em>· max 5 (Discord űrlap)</em></label>
            {cat.questions.map((q, qi) => (
              <TkQuestionRow key={qi} q={q}
                onChange={nq => set('questions', cat.questions.map((x,i) => i===qi ? nq : x))}
                onRemove={() => set('questions', cat.questions.filter((_,i) => i!==qi))} />
            ))}
            {cat.questions.length < 5 && (
              <button className="btn" onClick={() => set('questions', [...cat.questions, tkEmptyQuestion()])}>{ICO.plus} Kérdés hozzáadása</button>
            )}
            {cat.questions.length === 0 && (
              <div style={{fontSize:11,color:'var(--ink-faint)',marginTop:6}}>Ha nincs kérdés, a jegy kattintásra azonnal létrejön.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TkPanelCard({ panel, idx, roles, channels, dcCategories, dirty, onChange, onRemove, onPublish, publishing }) {
  const set = (k, v) => onChange({ ...panel, [k]: v });
  const setEmbed = (k, v) => onChange({ ...panel, embed: { ...panel.embed, [k]: v } });
  const setBtn = (k, v) => onChange({ ...panel, button: { ...panel.button, [k]: v } });
  const setAccess = (k, v) => onChange({ ...panel, access: { ...panel.access, [k]: v } });
  const setCat = (ci, nc) => onChange({ ...panel, categories: panel.categories.map((c,i) => i===ci ? nc : c) });
  const [open, setOpen] = useDState(idx === 0);

  return (
    <div className="cfg-card" style={{gridColumn:'1 / -1'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,cursor:'pointer'}} onClick={() => setOpen(o => !o)}>
        <div className="ico" style={{width:32,height:32,borderRadius:9,border:'1px solid var(--line)',background:'rgba(45,80,200,0.18)',display:'grid',placeItems:'center'}}>{ICO.ticket || ICO.mail}</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:600,fontSize:15}}>{panel.name || 'Panel'}</div>
          <div style={{fontSize:11,color:'var(--ink-faint)'}}>
            {panel.categories.length} kategória · {panel.messageId ? 'közzétéve' : 'nincs közzétéve'}
          </div>
        </div>
        <button className="btn btn-primary" disabled={dirty || publishing || !panel.channelId || !panel.categories.length}
          onClick={e => { e.stopPropagation(); onPublish(); }}
          title={dirty ? 'Előbb mentsd a változásokat' : 'Panel elküldése / frissítése a Discordra'}>
          {publishing ? 'Küldés...' : (panel.messageId ? 'Panel frissítése' : 'Közzététel')}
        </button>
        <button className="btn btn-icon-danger" title="Panel törlése" onClick={e => { e.stopPropagation(); onRemove(); }}>{ICO.trash}</button>
        <span style={{color:'var(--ink-faint)',fontSize:11}}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{marginTop:18,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:20}}>

          <div>
            <div className="cfg-field">
              <label>Panel neve <em>· csak a panelen belül</em></label>
              <input className="cfg-input" value={panel.name} onChange={e => set('name', e.target.value.slice(0,60))} />
            </div>
            <div className="cfg-field">
              <label>Csatorna (ide kerül a panel üzenet)</label>
              <TkNativeSelect value={panel.channelId} onChange={v => set('channelId', v)} options={channels} placeholder="— Válassz csatornát —" prefix="#" />
            </div>
            <div className="cfg-field">
              <label>Embed cím</label>
              <input className="cfg-input" value={panel.embed.title} onChange={e => setEmbed('title', e.target.value.slice(0,256))} />
            </div>
            <div className="cfg-field">
              <label>Embed leírás</label>
              <textarea className="cfg-textarea" value={panel.embed.description} onChange={e => setEmbed('description', e.target.value.slice(0,4000))} />
            </div>
            <div className="cfg-field">
              <label>Embed szín</label>
              <TkColorField value={panel.embed.color} onChange={v => setEmbed('color', v)} />
            </div>
            <div className="cfg-field">
              <label>Nagy kép URL <em>· opcionális</em></label>
              <input className="cfg-input" value={panel.embed.imageUrl} onChange={e => setEmbed('imageUrl', e.target.value.trim().slice(0,500))} placeholder="https://..." />
            </div>
            <div className="cfg-field">
              <label>Bélyegkép (thumbnail) URL <em>· opcionális</em></label>
              <input className="cfg-input" value={panel.embed.thumbnailUrl} onChange={e => setEmbed('thumbnailUrl', e.target.value.trim().slice(0,500))} placeholder="https://..." />
            </div>
            <div style={{fontSize:11,color:'var(--ink-faint)'}}>A panel embednek nincs footer szövege.</div>
          </div>

          <div>
            <div className="cfg-field">
              <label>Gomb felirat {panel.categories.length > 1 && <em>· több kategóriánál a legördülő menü szövege</em>}</label>
              <input className="cfg-input" value={panel.button.label} onChange={e => setBtn('label', e.target.value.slice(0,80))} />
            </div>
            <div className="cfg-field">
              <label>Gomb emoji <em>· egy kategóriánál</em></label>
              <input className="cfg-input" style={{width:120}} value={panel.button.emoji} onChange={e => setBtn('emoji', e.target.value.slice(0,40))} placeholder="🎫" />
            </div>
            <div className="cfg-field">
              <label>Gomb szín</label>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:6}}>
                {TK_BTN_STYLES.map(s => (
                  <button key={s.v} className="btn" style={panel.button.style===s.v?{background:'rgba(108,99,255,0.18)',borderColor:'rgba(108,99,255,0.5)',color:'#a78bfa'}:{}} onClick={() => setBtn('style', s.v)}>{s.l}</button>
                ))}
              </div>
            </div>

            <MultiPick label="Kik nyithatnak jegyet (engedélyezett rangok)" items={roles} value={panel.access.allowedRoleIds}
              onChange={v => setAccess('allowedRoleIds', v)} placeholder="— Mindenki —"
              hint="Ha üres, bárki nyithat jegyet. Ha kiválasztasz rangokat, csak ők." />
            <MultiPick label="Tiltott rangok" items={roles} value={panel.access.deniedRoleIds}
              onChange={v => setAccess('deniedRoleIds', v)} placeholder="— Nincs tiltott rang —"
              hint="Ezek a rangok soha nem nyithatnak jegyet ezen a panelen." />

            <div className="cfg-field">
              <label>Max. egyszerre nyitott jegy / felhasználó (az egész panelen)</label>
              <input className="cfg-input" type="number" min={0} max={50} style={{width:120}} value={panel.maxOpenPerUser}
                onChange={e => set('maxOpenPerUser', Math.max(0, Math.min(50, parseInt(e.target.value,10)||0)))} />
              <div style={{fontSize:11,color:'var(--ink-faint)',marginTop:5}}>0 = korlátlan</div>
            </div>

            <div className="cfg-field">
              <label>Előnézet</label>
              <TkPanelPreview panel={panel} />
            </div>
          </div>

          <div style={{gridColumn:'1 / -1'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
              <label style={{margin:0,font:"500 11px 'JetBrains Mono',monospace",color:'var(--ink-faint)',textTransform:'uppercase',letterSpacing:'0.14em'}}>Kategóriák</label>
              {panel.categories.length < 15 && (
                <button className="btn" onClick={() => set('categories', [...panel.categories, tkEmptyCategory()])}>{ICO.plus} Új kategória</button>
              )}
            </div>
            {panel.categories.length === 0 && <div style={{fontSize:12,color:'var(--ink-faint)',marginBottom:10}}>Legalább egy kategória kell a közzétételhez.</div>}
            {panel.categories.map((c, ci) => (
              <TkCategoryCard key={c.id} cat={c} idx={ci} roles={roles} dcCategories={dcCategories}
                onChange={nc => setCat(ci, nc)}
                onRemove={() => set('categories', panel.categories.filter((_,i) => i!==ci))} />
            ))}
          </div>

        </div>
      )}
    </div>
  );
}

function TicketsPage({ bot, goBack, onUnsaved, moduleOn = true, onToggleModule }) {
  const [cfg, setCfg]         = useDState(null);
  const [orig, setOrig]       = useDState(null);
  const [loading, setLoading] = useDState(true);
  const [saving, setSaving]   = useDState(false);
  const [roles, setRoles]     = useDState([]);
  const [channels, setChannels] = useDState([]);
  const [dcCategories, setDcCategories] = useDState([]);
  const [publishing, setPublishing] = useDState(null);

  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('vh_token')}` });

  useDEffect(() => {
    Promise.all([
      fetch(`/api/bots/${bot.id}/tickets`, { headers: auth() }).then(r => r.ok ? r.json() : null),
      fetch(`/api/bots/${bot.id}/guild/roles`, { headers: auth() }).then(r => r.ok ? r.json() : []),
      fetch(`/api/bots/${bot.id}/guild/channels`, { headers: auth() }).then(r => r.ok ? r.json() : []),
      fetch(`/api/bots/${bot.id}/guild/categories`, { headers: auth() }).then(r => r.ok ? r.json() : []),
    ]).then(([data, rls, chs, cats]) => {
      const c = tkMerge(data);
      setCfg(c); setOrig(JSON.parse(JSON.stringify(c)));
      setRoles(Array.isArray(rls) ? rls : []);
      setChannels(Array.isArray(chs) ? chs : []);
      setDcCategories(Array.isArray(cats) ? cats : []);
    }).catch(() => {
      const c = tkMerge(null);
      setCfg(c); setOrig(JSON.parse(JSON.stringify(c)));
    }).finally(() => setLoading(false));
    return () => onUnsaved(false);
  }, [bot.id]);

  const dirty = useDMemo(() => cfg && orig && JSON.stringify(cfg) !== JSON.stringify(orig), [cfg, orig]);
  useDEffect(() => { onUnsaved(!!dirty); }, [dirty]);

  const setTop = (k, v) => setCfg(p => ({ ...p, [k]: v }));
  const setTr  = (k, v) => setCfg(p => ({ ...p, transcript: { ...p.transcript, [k]: v } }));
  const setPanelAt = (pi, np) => setCfg(p => ({ ...p, panels: p.panels.map((x, i) => i === pi ? np : x) }));

  function reset() { setCfg(JSON.parse(JSON.stringify(orig))); }

  async function save() {
    setSaving(true);
    const r = await fetch(`/api/bots/${bot.id}/tickets`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...auth() },
      body: JSON.stringify(cfg),
    }).catch(() => null);
    const d = r && await r.json().catch(() => null);
    if (r?.ok) {
      const merged = tkMerge(d?.config ?? cfg);
      setCfg(merged); setOrig(JSON.parse(JSON.stringify(merged)));
      toast('Hibajegy beállítások mentve!');
    } else {
      toast(d?.error || 'Mentési hiba, próbáld újra.', 'err');
    }
    setSaving(false);
  }

  async function publishPanel(panelId) {
    setPublishing(panelId);
    const r = await fetch(`/api/bots/${bot.id}/tickets/panels/${panelId}/publish`, {
      method: 'POST', headers: auth(),
    }).catch(() => null);
    const d = r && await r.json().catch(() => null);
    if (r?.ok) {
      const patch = list => list.map(x => x.id === panelId ? { ...x, messageId: d.messageId } : x);
      setCfg(p => ({ ...p, panels: patch(p.panels) }));
      setOrig(o => ({ ...o, panels: patch(o.panels) }));
      toast('Panel közzétéve a Discordon!');
    } else {
      toast(d?.error || 'Nem sikerült a közzététel.', 'err');
    }
    setPublishing(null);
  }

  if (loading) return <SkeletonCards />;

  return (
    <>
      <div className="page-head">
        <div>
          <button className="page-back" onClick={goBack}>{ICO.back} Vissza</button>
          <h1 className="page-title">Hibajegy</h1>
          <div className="page-sub">Jegy panelek, kategóriák, support rangok és átiratok.</div>
        </div>
        <div className="page-actions" style={{alignItems:'center',gap:12}}>
          <span className={`status-pill ${moduleOn ? 'live' : 'off'}`}>
            <span className="pdot"></span>{moduleOn ? (cfg.panels.some(p => p.messageId) ? 'Aktív' : 'Bekapcsolva') : 'Kikapcsolva'}
          </span>
          <div className={`toggle ${moduleOn ? 'on' : ''}`} onClick={onToggleModule} style={{cursor:'pointer'}} title={moduleOn ? 'Modul kikapcsolása' : 'Modul bekapcsolása'}></div>
        </div>
      </div>

      <div className={`module-body ${moduleOn ? '' : 'module-off'}`}>

        <div style={{fontSize:12,color:'var(--ink-faint)',marginBottom:16,lineHeight:1.6}}>
          A botnak <strong>Csatornák kezelése</strong> joga kell, hogy jegy csatornákat tudjon létrehozni.
          Minden jegy külön privát csatorna a kategória alatt; lezáráskor a bot átiratot ment a log csatornába, majd törli a csatornát.
        </div>

        <div className="config-grid">

          <div className="cfg-card" style={{gridColumn:'1 / -1'}}>
            <div className="cfg-head"><div className="ico">{ICO.log}</div><h3>Globális beállítások</h3></div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:20}}>
              <div className="cfg-field" style={{margin:0}}>
                <label>Log / átirat csatorna</label>
                <TkNativeSelect value={cfg.logChannelId} onChange={v => setTop('logChannelId', v)} options={channels} placeholder="— Válassz csatornát —" prefix="#" />
                <div style={{fontSize:11,color:'var(--ink-faint)',marginTop:6}}>Ide kerül minden lezárt jegy összegzése és átirata.</div>
              </div>
              <div className="cfg-field" style={{margin:0}}>
                <label>Átirat készítése lezáráskor</label>
                <div className="row-toggle" style={{marginTop:6}} onClick={() => setTr('enabled', !cfg.transcript.enabled)}>
                  <div className={`toggle ${cfg.transcript.enabled ? 'on' : ''}`}></div>
                  <div className="lbl">HTML átirat a log csatornába</div>
                </div>
              </div>
              <div className="cfg-field" style={{margin:0}}>
                <label>Csatorna törlése lezárás után (mp)</label>
                <input className="cfg-input" type="number" min={0} max={3600} style={{width:120}} value={cfg.transcript.deleteDelaySec}
                  onChange={e => setTr('deleteDelaySec', Math.max(0, Math.min(3600, parseInt(e.target.value,10)||0)))} />
              </div>
            </div>
          </div>

          <div style={{gridColumn:'1 / -1',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{fontSize:15,fontWeight:600}}>Panelek <span style={{color:'var(--ink-faint)',fontWeight:400,fontSize:13}}>({cfg.panels.length}/10)</span></div>
            {cfg.panels.length < 10 && (
              <button className="btn btn-primary" onClick={() => setCfg(p => ({ ...p, panels: [...p.panels, tkEmptyPanel()] }))}>{ICO.plus} Új panel</button>
            )}
          </div>

          {cfg.panels.length === 0 && (
            <div className="cfg-card" style={{gridColumn:'1 / -1',textAlign:'center',color:'var(--ink-faint)',fontSize:13}}>
              Még nincs panel. Hozz létre egyet a jegynyitáshoz.
            </div>
          )}

          {cfg.panels.map((panel, pi) => (
            <TkPanelCard key={panel.id} panel={panel} idx={pi} roles={roles} channels={channels} dcCategories={dcCategories}
              dirty={dirty} publishing={publishing === panel.id}
              onChange={np => setPanelAt(pi, np)}
              onRemove={() => setCfg(p => ({ ...p, panels: p.panels.filter((_, i) => i !== pi) }))}
              onPublish={() => publishPanel(panel.id)} />
          ))}

        </div>
      </div>

      {dirty && <UnsavedBar onReset={reset} onSave={save} saving={saving} />}
    </>
  );
}
