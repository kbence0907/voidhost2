const AM_DEF = {
  language: 'hu',
  disabledCommands: [],
  global:    { bypassRoleIds: [], bypassUserIds: [], appliedRoleIds: [] },
  profanity: { enabled: false, words: ['fasz','geci','kurva','picsa','buzi','köcsög','csicska','szar','baszd','ribanc'], deleteMessage: true, replyMessage: 'Kérlek, ne káromkodj! 🚫', timeoutEnabled: false, timeoutMinutes: 10, bypassRoleIds: [], bypassUserIds: [] },
  gif:       { enabled: false, allowedChannelIds: [], deleteMessage: true, replyMessage: 'Ebben a csatornában nem küldhetsz GIF-et.', timeoutEnabled: false, timeoutMinutes: 10, bypassRoleIds: [], bypassUserIds: [] },
  content:   { enabled: false, allowedChannelIds: [], deleteMessage: true, replyMessage: 'Ebben a csatornában nem küldhetsz képet vagy videót.', timeoutEnabled: false, timeoutMinutes: 10, bypassRoleIds: [], bypassUserIds: [] },
  mentions:  { enabled: false, maxMentions: 5, deleteMessage: true, replyMessage: 'Ne említs meg ennyi embert egyszerre!', timeoutEnabled: false, timeoutMinutes: 10, bypassRoleIds: [], bypassUserIds: [] },
  emoji:     { enabled: false, maxEmojis: 10, deleteMessage: true, replyMessage: 'Túl sok emojit használtál!', timeoutEnabled: false, timeoutMinutes: 5, bypassRoleIds: [], bypassUserIds: [] },
  repeated:  { enabled: false, maxRepeats: 3, intervalSec: 15, deleteMessage: true, replyMessage: 'Kérlek, ne küldd ugyanazt az üzenetet többször!', timeoutEnabled: false, timeoutMinutes: 5, bypassRoleIds: [], bypassUserIds: [] },
};
const AM_RULE_KEYS = ['profanity','gif','content','mentions','emoji','repeated'];

function mergeAmConfig(data) {
  const c = { ...AM_DEF, ...(data ?? {}) };
  c.global = { ...AM_DEF.global, ...(data?.global ?? {}) };
  for (const k of AM_RULE_KEYS) c[k] = { ...AM_DEF[k], ...(data?.[k] ?? {}) };
  return c;
}

function MultiPick({ label, items, value = [], onChange, placeholder = '— Válassz —', hint, prefix = '' }) {
  const [open, setOpen] = useDState(false);
  const [rect, setRect] = useDState(null);
  const triggerRef = React.useRef(null);
  const dropRef    = React.useRef(null);

  useDEffect(() => {
    function handler(e) {
      if (triggerRef.current?.contains(e.target)) return;
      if (dropRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function toggleOpen() {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen(o => !o);
  }

  function toggleItem(id) {
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  }

  const selected = items.filter(i => value.includes(i.id));

  return (
    <div className="cfg-field">
      <label>{label}</label>
      <div ref={triggerRef} onClick={toggleOpen}
        style={{width:'100%',minHeight:38,background:'var(--glass)',border:'1px solid var(--line)',borderRadius:10,color:'var(--ink)',padding:'6px 12px',fontSize:13,boxSizing:'border-box',cursor:'pointer',display:'flex',alignItems:'center',flexWrap:'wrap',gap:6}}>
        {selected.length === 0
          ? <span style={{color:'var(--ink-faint)'}}>{placeholder}</span>
          : selected.map(i => (
              <span key={i.id} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'2px 8px',borderRadius:999,fontSize:12,background:'rgba(88,101,242,0.15)',border:'1px solid rgba(88,101,242,0.35)',color:i.color ?? 'var(--blue-soft)'}}>
                {prefix}{i.name}
                <span onClick={e => { e.stopPropagation(); toggleItem(i.id); }} style={{cursor:'pointer',opacity:.7}}>✕</span>
              </span>
            ))}
        <span style={{marginLeft:'auto',color:'var(--ink-faint)',fontSize:10}}>{open ? '▲' : '▼'}</span>
      </div>
      {open && rect && ReactDOM.createPortal(
        <div ref={dropRef} style={{position:'fixed',top:rect.top,left:rect.left,width:rect.width,zIndex:9999,background:'rgba(10,14,32,0.98)',border:'1px solid var(--line)',borderRadius:12,maxHeight:240,overflowY:'auto',overscrollBehavior:'contain',boxShadow:'0 12px 48px rgba(0,0,0,0.75)'}}>
          {items.length === 0 && <div style={{padding:'10px 12px',color:'var(--ink-faint)',fontSize:13}}>Nincs elérhető elem</div>}
          {items.map(i => {
            const on = value.includes(i.id);
            return (
              <div key={i.id} onClick={() => toggleItem(i.id)}
                style={{padding:'8px 12px',cursor:'pointer',fontSize:13,fontWeight:600,color:i.color ?? 'var(--ink)',display:'flex',alignItems:'center',gap:8,
                  background:on?'rgba(88,101,242,0.15)':'transparent',borderLeft:on?'2px solid var(--blue-soft)':'2px solid transparent'}}>
                <span style={{width:14,textAlign:'center',color:'var(--blue-soft)'}}>{on ? '✓' : ''}</span>
                {prefix}{i.name}
              </div>
            );
          })}
        </div>,
        document.body
      )}
      {hint && <div style={{fontSize:11,color:'var(--ink-faint)',marginTop:5}}>{hint}</div>}
    </div>
  );
}

function ChipInput({ label, value = [], onChange, placeholder, hint, sanitize }) {
  const [text, setText] = useDState('');
  function add() {
    let v = text.trim();
    if (sanitize) v = sanitize(v);
    if (!v || value.includes(v)) { setText(''); return; }
    onChange([...value, v]);
    setText('');
  }
  return (
    <div className="cfg-field">
      <label>{label}</label>
      <div style={{display:'flex',gap:8,marginTop:6}}>
        <input className="cfg-input" style={{flex:1}} placeholder={placeholder} value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button className="btn" onClick={add}>+ Hozzáad</button>
      </div>
      {value.length > 0 && (
        <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:8}}>
          {value.map(v => (
            <span key={v} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 9px',borderRadius:999,fontSize:12,background:'var(--glass-2)',border:'1px solid var(--line)',color:'var(--ink-dim)',fontFamily:"'JetBrains Mono',monospace"}}>
              {v}
              <span onClick={() => onChange(value.filter(x => x !== v))} style={{cursor:'pointer',opacity:.7}}>✕</span>
            </span>
          ))}
        </div>
      )}
      {hint && <div style={{fontSize:11,color:'var(--ink-faint)',marginTop:5}}>{hint}</div>}
    </div>
  );
}

function RuleCommon({ rule, set, roles }) {
  return (
    <>
      <div className="row-toggle" onClick={() => set('deleteMessage', !rule.deleteMessage)}>
        <div className={`toggle ${rule.deleteMessage ? 'on' : ''}`}></div>
        <div className="lbl">Üzenet törlése</div>
      </div>
      <div className="cfg-field">
        <label>Válasz üzenet <em>· üresen hagyva nem válaszol</em></label>
        <input className="cfg-input" value={rule.replyMessage} onChange={e => set('replyMessage', e.target.value.slice(0,500))} placeholder="pl. Kérlek, ne káromkodj!" />
      </div>
      <div className="row-toggle" onClick={() => set('timeoutEnabled', !rule.timeoutEnabled)}>
        <div className={`toggle ${rule.timeoutEnabled ? 'on' : ''}`}></div>
        <div className="lbl">Felfüggesztés (timeout)</div>
      </div>
      {rule.timeoutEnabled && (
        <div className="cfg-field">
          <label>Felfüggesztés hossza (perc)</label>
          <input className="cfg-input" type="number" min={1} max={40320} style={{width:120}} value={rule.timeoutMinutes}
            onChange={e => set('timeoutMinutes', Math.max(1, Math.min(40320, parseInt(e.target.value,10) || 1)))} />
        </div>
      )}
      <MultiPick label="Felmentett rangok (bypass)" items={roles} value={rule.bypassRoleIds}
        onChange={v => set('bypassRoleIds', v)} placeholder="— Nincs felmentett rang —"
        hint="Ezekre a rangokra nem vonatkozik ez a szabály." />
      <ChipInput label="Felmentett személyek (Discord ID)" value={rule.bypassUserIds}
        onChange={v => set('bypassUserIds', v)} placeholder="pl. 123456789012345678"
        sanitize={v => v.replace(/\D/g, '').slice(0, 30)}
        hint="Ezekre a felhasználókra nem vonatkozik ez a szabály." />
    </>
  );
}

function AutoModPage({ bot, goBack, onUnsaved, moduleOn = true, onToggleModule }) {
  const [cfg, setCfg]         = useDState(null);
  const [orig, setOrig]       = useDState(null);
  const [loading, setLoading] = useDState(true);
  const [saving, setSaving]   = useDState(false);
  const [roles, setRoles]     = useDState([]);
  const [channels, setChannels] = useDState([]);

  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('vh_token')}` });

  useDEffect(() => {
    Promise.all([
      fetch(`/api/bots/${bot.id}/moderation`, { headers: auth() }).then(r => r.ok ? r.json() : null),
      fetch(`/api/bots/${bot.id}/guild/roles`, { headers: auth() }).then(r => r.ok ? r.json() : []),
      fetch(`/api/bots/${bot.id}/guild/channels`, { headers: auth() }).then(r => r.ok ? r.json() : []),
    ]).then(([data, rls, chs]) => {
      const c = mergeAmConfig(data);
      setCfg(c); setOrig(JSON.parse(JSON.stringify(c)));
      setRoles(Array.isArray(rls) ? rls : []);
      setChannels(Array.isArray(chs) ? chs : []);
    }).catch(() => {
      const c = mergeAmConfig(null);
      setCfg(c); setOrig(JSON.parse(JSON.stringify(c)));
    }).finally(() => setLoading(false));
    return () => onUnsaved(false);
  }, [bot.id]);

  const dirty = useDMemo(() => cfg && orig && JSON.stringify(cfg) !== JSON.stringify(orig), [cfg, orig]);
  useDEffect(() => { onUnsaved(!!dirty); }, [dirty]);

  const setRule = (key, field, val) => setCfg(prev => ({ ...prev, [key]: { ...prev[key], [field]: val } }));
  const setGlobal = (field, val)    => setCfg(prev => ({ ...prev, global: { ...prev.global, [field]: val } }));

  function reset() { setCfg(JSON.parse(JSON.stringify(orig))); }

  async function save() {
    setSaving(true);
    const snap = JSON.parse(JSON.stringify(cfg));
    const r = await fetch(`/api/bots/${bot.id}/moderation`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...auth() },
      body: JSON.stringify(snap),
    }).catch(() => null);
    if (r?.ok) { setOrig(snap); toast('Moderációs beállítások mentve!'); }
    else toast('Mentési hiba, próbáld újra.', 'err');
    setSaving(false);
  }

  if (loading) return <SkeletonCards />;

  const anyActive = AM_RULE_KEYS.some(k => cfg[k].enabled);
  const ruleHead = (key, title) => (
    <>
      <div className="cfg-head"><div className="ico">{ICO.shield}</div><h3>{title}</h3></div>
      <div className="row-toggle" onClick={() => setRule(key, 'enabled', !cfg[key].enabled)}>
        <div className={`toggle ${cfg[key].enabled ? 'on' : ''}`}></div>
        <div className="lbl">Engedélyezve</div>
      </div>
    </>
  );
  const channelHint = 'Ha üresen hagyod: sehol nem engedélyezett. Ha kiválasztasz csatornákat: csak ott engedélyezett.';

  return (
    <>
      <div className="page-head">
        <div>
          <button className="page-back" onClick={goBack}>{ICO.back} Vissza</button>
          <h1 className="page-title">Auto Moderáció</h1>
          <div className="page-sub">Automatikus szűrők és büntetések.</div>
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
          <div className="cfg-head"><div className="ico">{ICO.globe}</div><h3>Globális beállítások</h3></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:20}}>
            <MultiPick label="Globális felmentett rangok" items={roles} value={cfg.global.bypassRoleIds}
              onChange={v => setGlobal('bypassRoleIds', v)} placeholder="— Nincs —"
              hint="Ezekre a rangokra egyik automod szabály sem vonatkozik." />
            <ChipInput label="Globális felmentett személyek (ID)" value={cfg.global.bypassUserIds}
              onChange={v => setGlobal('bypassUserIds', v)} placeholder="pl. 123456789012345678"
              sanitize={v => v.replace(/\D/g, '').slice(0, 30)}
              hint="Ezekre a felhasználókra egyik szabály sem vonatkozik." />
            <MultiPick label="Szabályok csak ezekre a rangokra" items={roles} value={cfg.global.appliedRoleIds}
              onChange={v => setGlobal('appliedRoleIds', v)} placeholder="— Mindenkire vonatkozik —"
              hint="Ha kiválasztasz rangokat, a szabályok CSAK azokra vonatkoznak, mindenki más felmentést kap." />
          </div>
        </div>

        <div className="cfg-card">
          {ruleHead('profanity', 'Káromkodás szűrő')}
          <div className={`module-body ${cfg.profanity.enabled ? '' : 'module-off'}`}>
          <ChipInput label="Tiltott kifejezések" value={cfg.profanity.words}
            onChange={v => setRule('profanity', 'words', v)} placeholder="pl. csúnyaszó"
            sanitize={v => v.toLowerCase().slice(0, 60)}
            hint="Ha az üzenet tartalmazza bármelyik kifejezést, a bot közbelép." />
          <RuleCommon rule={cfg.profanity} set={(f,v) => setRule('profanity', f, v)} roles={roles} />
          </div>
        </div>

        <div className="cfg-card">
          {ruleHead('gif', 'GIF Moderáció')}
          <div className={`module-body ${cfg.gif.enabled ? '' : 'module-off'}`}>
          <MultiPick label="Engedélyezett csatornák" items={channels} value={cfg.gif.allowedChannelIds}
            onChange={v => setRule('gif', 'allowedChannelIds', v)} placeholder="— Sehol nem engedélyezett —"
            prefix="#" hint={channelHint} />
          <RuleCommon rule={cfg.gif} set={(f,v) => setRule('gif', f, v)} roles={roles} />
          </div>
        </div>

        <div className="cfg-card">
          {ruleHead('content', 'Tartalom Moderáció')}
          <div className={`module-body ${cfg.content.enabled ? '' : 'module-off'}`}>
          <div style={{fontSize:12,color:'var(--ink-faint)',marginBottom:8}}>Képekre és videókra vonatkozik.</div>
          <MultiPick label="Engedélyezett csatornák" items={channels} value={cfg.content.allowedChannelIds}
            onChange={v => setRule('content', 'allowedChannelIds', v)} placeholder="— Sehol nem engedélyezett —"
            prefix="#" hint={channelHint} />
          <RuleCommon rule={cfg.content} set={(f,v) => setRule('content', f, v)} roles={roles} />
          </div>
        </div>

        <div className="cfg-card">
          {ruleHead('mentions', 'Tömeges megemlítés')}
          <div className={`module-body ${cfg.mentions.enabled ? '' : 'module-off'}`}>
          <div className="cfg-field">
            <label>Max. említés egy üzenetben</label>
            <input className="cfg-input" type="number" min={2} max={50} style={{width:120}} value={cfg.mentions.maxMentions}
              onChange={e => setRule('mentions', 'maxMentions', Math.max(2, Math.min(50, parseInt(e.target.value,10) || 2)))} />
          </div>
          <RuleCommon rule={cfg.mentions} set={(f,v) => setRule('mentions', f, v)} roles={roles} />
          </div>
        </div>

        <div className="cfg-card">
          {ruleHead('emoji', 'Emoji spam')}
          <div className={`module-body ${cfg.emoji.enabled ? '' : 'module-off'}`}>
          <div className="cfg-field">
            <label>Max. emoji egy üzenetben</label>
            <input className="cfg-input" type="number" min={2} max={100} style={{width:120}} value={cfg.emoji.maxEmojis}
              onChange={e => setRule('emoji', 'maxEmojis', Math.max(2, Math.min(100, parseInt(e.target.value,10) || 2)))} />
          </div>
          <RuleCommon rule={cfg.emoji} set={(f,v) => setRule('emoji', f, v)} roles={roles} />
          </div>
        </div>

        <div className="cfg-card">
          {ruleHead('repeated', 'Ismételt üzenetek')}
          <div className={`module-body ${cfg.repeated.enabled ? '' : 'module-off'}`}>
          <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
            <div className="cfg-field">
              <label>Hány ismétlés után</label>
              <input className="cfg-input" type="number" min={2} max={20} style={{width:110}} value={cfg.repeated.maxRepeats}
                onChange={e => setRule('repeated', 'maxRepeats', Math.max(2, Math.min(20, parseInt(e.target.value,10) || 2)))} />
            </div>
            <div className="cfg-field">
              <label>Időablak (mp)</label>
              <input className="cfg-input" type="number" min={3} max={600} style={{width:110}} value={cfg.repeated.intervalSec}
                onChange={e => setRule('repeated', 'intervalSec', Math.max(3, Math.min(600, parseInt(e.target.value,10) || 3)))} />
            </div>
          </div>
          <RuleCommon rule={cfg.repeated} set={(f,v) => setRule('repeated', f, v)} roles={roles} />
          </div>
        </div>

      </div>
      </div>

      {dirty && <UnsavedBar onReset={reset} onSave={save} saving={saving} />}
    </>
  );
}
