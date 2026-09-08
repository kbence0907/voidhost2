function RolePicker({ roles, loading, value, onChange }) {
  const [open, setOpen] = useDState(false);
  const [rect, setRect]  = useDState(null);
  const triggerRef = React.useRef(null);
  const dropRef    = React.useRef(null);
  const selected   = roles.find(r => r.id === value);

  useDEffect(() => {
    function handler(e) {
      if (triggerRef.current?.contains(e.target)) return;
      if (dropRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function toggle() {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen(o => !o);
  }

  const boxStyle = { width:'100%', background:'var(--glass)', border:'1px solid var(--line)', borderRadius:10, color:'var(--ink)', padding:'9px 12px', fontSize:13, boxSizing:'border-box', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' };

  return (
    <div style={{marginBottom:20}}>
      <div style={{fontSize:12,color:'var(--ink-dim)',marginBottom:6}}>Szükséges rang <span style={{color:'var(--ink-faint)'}}>(opcionális)</span></div>
      {loading
        ? <div style={{color:'var(--ink-faint)',fontSize:13}}>Rangok betöltése...</div>
        : <>
            <div style={boxStyle} ref={triggerRef} onClick={toggle}>
              {selected
                ? <><span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:selected.color??'#99aab5',marginRight:8,verticalAlign:'middle'}} /><span style={{color:selected.color??'var(--ink)',fontWeight:600}}>{selected.name}</span></>
                : <span style={{color:'var(--ink-faint)'}}>— Bárki használhatja —</span>}
              <span style={{color:'var(--ink-faint)',fontSize:10}}>{open?'▲':'▼'}</span>
            </div>
            {open && rect && (
              <div ref={dropRef} style={{position:'fixed',top:rect.top,left:rect.left,width:rect.width,zIndex:9999,background:'rgba(10,14,32,0.98)',border:'1px solid var(--line)',borderRadius:12,maxHeight:240,overflowY:'auto',overscrollBehavior:'contain',boxShadow:'0 12px 48px rgba(0,0,0,0.75)'}}>
                <div style={{padding:'8px 12px',cursor:'pointer',color:'var(--ink-faint)',fontSize:13,borderBottom:'1px solid var(--line)'}}
                  onClick={() => { onChange('',''); setOpen(false); }}>
                  — Bárki használhatja —
                </div>
                {roles.map(r => (
                  <div key={r.id}
                    style={{padding:'8px 12px',cursor:'pointer',fontSize:13,fontWeight:600,color:r.color??'var(--ink)',
                      background:value===r.id?'rgba(88,101,242,0.15)':'transparent',
                      borderLeft:value===r.id?'2px solid var(--blue-soft)':'2px solid transparent'}}
                    onClick={() => { onChange(r.id, r.name); setOpen(false); }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background=value===r.id?'rgba(88,101,242,0.15)':'transparent'}>
                    <span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:r.color??'#99aab5',marginRight:8,verticalAlign:'middle'}} />
                    {r.name}
                  </div>
                ))}
              </div>
            )}
          </>
      }
    </div>
  );
}

const CMD_EMPTY = { name:'', type:'slash', description:'', response:'', responseType:'plain', embedColor:'#5865f2', embedTitle:'', embedFooter:'', ephemeral:false, deleteTrigger:false, requiredRoleId:'', requiredRoleName:'' };

function CmdModal({ cmd, onClose, onSave, saving, roles, rolesLoading }) {
  const [form, setForm] = useDState({ ...CMD_EMPTY, ...cmd });
  const [nameError, setNameError] = useDState('');
  const set = (k, v) => { if (k === 'name') setNameError(''); setForm(p => ({ ...p, [k]: v })); };
  const isNew = !cmd.id;
  const inpStyle = { width:'100%', background:'var(--glass)', border:'1px solid var(--line)', borderRadius:10, color:'var(--ink)', padding:'9px 12px', fontSize:13, boxSizing:'border-box' };
  const tabBtn = (val, cur, label) => (
    <button onClick={() => set(val === 'type' ? 'type' : 'responseType', cur)}
      style={{flex:1,padding:'8px 0',borderRadius:10,border:'1px solid',cursor:'pointer',fontSize:13,fontWeight:500,
        borderColor:form[val === 'type' ? 'type' : 'responseType']===cur?'var(--blue-soft)':'var(--line)',
        background:form[val === 'type' ? 'type' : 'responseType']===cur?'rgba(88,101,242,0.15)':'var(--glass)',
        color:form[val === 'type' ? 'type' : 'responseType']===cur?'var(--blue-soft)':'var(--ink-dim)'}}>
      {label}
    </button>
  );
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{maxWidth:520,maxHeight:'90vh',overflowY:'auto',overscrollBehavior:'contain'}}>
        <div className="modal-head">
          <h3>{isNew ? 'Új parancs' : 'Parancs szerkesztése'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{marginBottom:14}}>
          <div style={{fontSize:12,color:'var(--ink-dim)',marginBottom:6}}>Típus</div>
          <div style={{display:'flex',gap:8}}>
            {[['slash','/ Slash'],['prefix','! Prefix']].map(([v,l]) => (
              <button key={v} onClick={() => set('type', v)}
                style={{flex:1,padding:'8px 0',borderRadius:10,border:'1px solid',cursor:'pointer',fontSize:13,fontWeight:500,
                  borderColor:form.type===v?'var(--blue-soft)':'var(--line)',
                  background:form.type===v?'rgba(88,101,242,0.15)':'var(--glass)',
                  color:form.type===v?'var(--blue-soft)':'var(--ink-dim)'}}>{l}</button>
            ))}
          </div>
        </div>

        <div style={{marginBottom:14}}>
          <div style={{fontSize:12,color:'var(--ink-dim)',marginBottom:6}}>Parancs neve</div>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{color:'var(--ink-faint)',fontSize:15,fontFamily:'monospace'}}>{form.type==='slash'?'/':'!'}</span>
            <input value={form.name} onChange={e => set('name', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,32))}
              placeholder="parancs-neve"
              style={{...inpStyle, flex:1, borderColor: nameError ? 'rgba(248,113,113,.5)' : undefined}} />
          </div>
          {nameError && <div style={{fontSize:12,color:'#f87171',marginTop:5,display:'flex',alignItems:'center',gap:5}}>{ICO.warn}{nameError}</div>}
        </div>

        {form.type === 'slash' && (
          <div style={{marginBottom:14}}>
            <div style={{fontSize:12,color:'var(--ink-dim)',marginBottom:6}}>Leírás <span style={{color:'var(--ink-faint)'}}>(Discord-ban jelenik meg)</span></div>
            <input value={form.description} onChange={e => set('description', e.target.value.slice(0,100))}
              placeholder="Rövid leírás..." style={inpStyle} />
          </div>
        )}

        <div style={{marginBottom:14}}>
          <div style={{fontSize:12,color:'var(--ink-dim)',marginBottom:6}}>Válasz típusa</div>
          <div style={{display:'flex',gap:8}}>
            {[['plain','Szöveg'],['embed','Embed']].map(([v,l]) => (
              <button key={v} onClick={() => set('responseType', v)}
                style={{flex:1,padding:'8px 0',borderRadius:10,border:'1px solid',cursor:'pointer',fontSize:13,fontWeight:500,
                  borderColor:form.responseType===v?'var(--blue-soft)':'var(--line)',
                  background:form.responseType===v?'rgba(88,101,242,0.15)':'var(--glass)',
                  color:form.responseType===v?'var(--blue-soft)':'var(--ink-dim)'}}>{l}</button>
            ))}
          </div>
        </div>

        <div style={{marginBottom:14}}>
          <div style={{fontSize:12,color:'var(--ink-dim)',marginBottom:6}}>Válasz üzenet</div>
          <textarea value={form.response} onChange={e => set('response', e.target.value)} rows={4}
            placeholder="A bot válasza..."
            style={{...inpStyle,resize:'vertical',fontFamily:'inherit'}} />
        </div>

        {form.responseType === 'embed' && <>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:12,color:'var(--ink-dim)',marginBottom:6}}>Embed cím</div>
            <input value={form.embedTitle} onChange={e => set('embedTitle', e.target.value.slice(0,256))} placeholder="Cím (opcionális)" style={inpStyle} />
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:12,color:'var(--ink-dim)',marginBottom:6}}>Embed footer</div>
            <input value={form.embedFooter} onChange={e => set('embedFooter', e.target.value.slice(0,2048))} placeholder="Footer szöveg (opcionális)" style={inpStyle} />
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:12,color:'var(--ink-dim)',marginBottom:6}}>Embed szín</div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <input type="color" value={form.embedColor} onChange={e => set('embedColor', e.target.value)}
                style={{width:38,height:38,borderRadius:8,border:'1px solid var(--line)',cursor:'pointer',background:'none',padding:2}} />
              <input value={form.embedColor} onChange={e => set('embedColor', e.target.value)} maxLength={7}
                style={{...inpStyle,flex:1,fontFamily:"'JetBrains Mono',monospace",fontSize:13}} />
            </div>
          </div>
        </>}

        {form.type === 'slash' && (
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div>
              <div style={{fontSize:13,fontWeight:500}}>Csak neki látható</div>
              <div style={{fontSize:12,color:'var(--ink-faint)'}}>Csak a parancsot küldő látja</div>
            </div>
            <div className={`toggle ${form.ephemeral?'on':''}`} onClick={() => set('ephemeral', !form.ephemeral)} />
          </div>
        )}

        {form.type === 'prefix' && (
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div>
              <div style={{fontSize:13,fontWeight:500}}>Indító üzenet törlése</div>
              <div style={{fontSize:12,color:'var(--ink-faint)'}}>A parancsot tartalmazó üzenet törlése</div>
            </div>
            <div className={`toggle ${form.deleteTrigger?'on':''}`} onClick={() => set('deleteTrigger', !form.deleteTrigger)} />
          </div>
        )}

        <RolePicker
          roles={roles}
          loading={rolesLoading}
          value={form.requiredRoleId ?? ''}
          onChange={(id, name) => { set('requiredRoleId', id); set('requiredRoleName', name); }}
        />

        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button className="btn" onClick={onClose}>Mégse</button>
          <button className="btn btn-primary" onClick={async () => {
            const err = await onSave(form);
            if (err) setNameError(err);
          }} disabled={saving || !form.name.trim()}>
            {saving ? 'Mentés...' : 'Mentés'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CommandsPage({ bot, goBack, onUnsaved, moduleOn = true, onToggleModule }) {
  const [cmds, setCmds]           = useDState([]);
  const [loading, setLoading]     = useDState(true);
  const [prefix, setPrefix]       = useDState('!');
  const [maxCmds, setMaxCmds]     = useDState(25);
  const [editing, setEditing]     = useDState(null);
  const [saving, setSaving]       = useDState(false);
  const [roles, setRoles]         = useDState([]);
  const [rolesLoading, setRolesLoading] = useDState(false);
  const [search, setSearch]       = useDState('');

  const tok = () => localStorage.getItem('vh_token');
  const auth = () => ({ 'Authorization': `Bearer ${tok()}` });
  const jsonHdrs = () => ({ ...auth(), 'Content-Type': 'application/json' });

  useDEffect(() => { onUnsaved?.(false); fetchAll(); }, [bot.id]);

  async function fetchAll() {
    setLoading(true);
    const [cr, sr, br] = await Promise.all([
      fetch(`/api/bots/${bot.id}/commands`, { headers: auth() }),
      fetch(`/api/bots/${bot.id}/commands/settings`, { headers: auth() }),
      fetch(`/api/bots/${bot.id}/settings`, { headers: auth() }),
    ]);
    if (cr.ok) setCmds(await cr.json());
    if (sr.ok) { const d = await sr.json(); setMaxCmds(d.maxCommands); }
    if (br.ok) { const d = await br.json(); setPrefix(d.prefix || '!'); }
    setLoading(false);
  }

  async function fetchRoles() {
    setRolesLoading(true);
    const r = await fetch(`/api/bots/${bot.id}/guild/roles`, { headers: auth() });
    if (r.ok) setRoles(await r.json());
    setRolesLoading(false);
  }

  function openNew() { setEditing({}); fetchRoles(); }
  function openEdit(cmd) { setEditing(cmd); fetchRoles(); }

  async function saveCmd(form) {
    setSaving(true);
    const isNew = !editing?.id;
    const url = isNew ? `/api/bots/${bot.id}/commands` : `/api/bots/${bot.id}/commands/${editing.id}`;
    const r = await fetch(url, { method: isNew ? 'POST' : 'PUT', headers: jsonHdrs(), body: JSON.stringify(form) });
    const d = await r.json();
    if (r.ok) { await fetchAll(); setEditing(null); setSaving(false); return null; }
    setSaving(false);
    return d.error || 'Hiba történt.';
  }

  async function deleteCmd(id) {
    const r = await fetch(`/api/bots/${bot.id}/commands/${id}`, { method: 'DELETE', headers: auth() });
    if (r.ok) setCmds(p => p.filter(c => c.id !== id));
  }

  const filtered = cmds.filter(c => c.name.includes(search.toLowerCase()) || (c.description||'').toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="page-head">
        <div>
          <button className="page-back" onClick={goBack}>{ICO.back} Vissza</button>
          <h1 className="page-title">Saját parancsok</h1>
          <div className="page-sub">A {bot.bot_name} bot egyedi parancsai.</div>
        </div>
        <div className="page-actions" style={{alignItems:'center',gap:10}}>
          <span style={{fontSize:12,color:'var(--ink-faint)'}}>{cmds.length} / {maxCmds}</span>
          <span className={`status-pill ${moduleOn ? 'live' : 'off'}`}>
            <span className="pdot"></span>{moduleOn ? 'Bekapcsolva' : 'Kikapcsolva'}
          </span>
          <div className={`toggle ${moduleOn ? 'on' : ''}`} onClick={onToggleModule} style={{cursor:'pointer'}} title={moduleOn ? 'Modul kikapcsolása' : 'Modul bekapcsolása'}></div>
          <button className="btn btn-primary" onClick={openNew} disabled={cmds.length >= maxCmds || !moduleOn}>{ICO.plus} Új parancs</button>
        </div>
      </div>

      <div className={`module-body ${moduleOn ? '' : 'module-off'}`}>

      <div className="toolbar">
        <div className="search">
          {ICO.search}
          <input placeholder="Parancs neve vagy leírása..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading
        ? <SkeletonCards count={2} />
        : <div className="cmd-list">
            {filtered.length === 0 && <div style={{color:'var(--ink-faint)',textAlign:'center',padding:40}}>Nincs parancs</div>}
            {filtered.map(c => (
              <div key={c.id} className="cmd-row" style={{gridTemplateColumns:'auto 1fr auto auto auto'}}>
                <span style={{padding:'2px 8px',borderRadius:6,fontSize:11,fontFamily:'monospace',fontWeight:600,
                  background:c.type==='slash'?'rgba(88,101,242,0.18)':'rgba(52,211,153,0.18)',
                  color:c.type==='slash'?'#818cf8':'#34d399'}}>
                  {c.type === 'slash' ? '/slash' : '!prefix'}
                </span>
                <div>
                  <div className="name">{c.type==='slash'?'/':prefix}{c.name}</div>
                  {c.description && <div className="desc">{c.description}</div>}
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center',fontSize:12}}>
                  {c.requiredRoleName && <span style={{padding:'2px 8px',borderRadius:6,border:'1px solid var(--line)',color:'var(--ink-dim)'}}>{c.requiredRoleName}</span>}
                  {c.createdBy && <span style={{color:'var(--ink-faint)'}}>– {c.createdBy}</span>}
                </div>
                <button className="icon-btn" title="Szerkesztés" onClick={() => openEdit(c)}>{ICO.edit}</button>
                <button className="icon-btn" title="Törlés" style={{color:'var(--red)'}} onClick={() => deleteCmd(c.id)}>{ICO.trash}</button>
              </div>
            ))}
          </div>
      }

      </div>

      {editing !== null && (
        <CmdModal
          cmd={editing}
          onClose={() => setEditing(null)}
          onSave={saveCmd}
          saving={saving}
          roles={roles}
          rolesLoading={rolesLoading}
        />
      )}
    </>
  );
}
