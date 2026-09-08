const MODCMD_LIST = [
  { hu: 'kitiltás',              en: 'ban',       perm: 'Tagok kitiltása',      desc: 'Felhasználó kitiltása. Megadható indok és időtartam (pl. 30m, 2h, 7d) ha lejár, automatikusan feloldja. Üresen hagyva végleges.' },
  { hu: 'kitiltásfeloldás',      en: 'unban',     perm: 'Tagok kitiltása',      desc: 'Kitiltott felhasználó feloldása ID alapján.' },
  { hu: 'összkitiltásfeloldás',  en: 'unbanall',  perm: 'Tagok kitiltása',      desc: 'Az összes kitiltott felhasználó feloldása egyszerre.' },
  { hu: 'kirúgás',               en: 'kick',      perm: 'Tagok kirúgása',       desc: 'Kirakja a felhasználót a szerverről. Az indokot előtte privát üzenetben megkapja.' },
  { hu: 'felfüggesztés',         en: 'timeout',   perm: 'Tagok moderálása',     desc: 'Felfüggesztés (Discord timeout) megadott időre név, indok és időtartam adható meg. Lejáratkor automatikusan feloldódik.' },
  { hu: 'felfüggesztésfeloldás', en: 'untimeout', perm: 'Tagok moderálása',     desc: 'Aktív felfüggesztés azonnali feloldása.' },
  { hu: 'némítás',               en: 'mute',      perm: 'Tagok moderálása',     desc: 'A felhasználó megkapja a "Mute" rangot, amivel sehova nem tud írni. A rangot és a csatorna-tiltásokat a bot automatikusan létrehozza.' },
  { hu: 'némításfeloldás',       en: 'unmute',    perm: 'Tagok moderálása',     desc: 'Leveszi a Mute rangot a felhasználóról.' },
];

const CMD_PERM_DEF = { useDiscord: true, roleIds: [], userIds: [] };

function withCmdPerms(c) {
  const cp = c.commandPerms ?? {};
  return {
    ...c,
    commandPerms: {
      global:    { ...CMD_PERM_DEF, ...(cp.global ?? {}) },
      overrides: (cp.overrides && typeof cp.overrides === 'object') ? cp.overrides : {},
    },
  };
}

function effectivePerm(cfg, action) {
  const cp = cfg.commandPerms;
  const ov = cp.overrides?.[action];
  const src = (ov && ov.inherit === false) ? ov : cp.global;
  return { useDiscord: src?.useDiscord !== false, roleIds: src?.roleIds ?? [], userIds: src?.userIds ?? [], custom: !!(ov && ov.inherit === false) };
}

function PermEditor({ perm, roles, onChange, discordLabel }) {
  const set = (field, val) => onChange({ ...perm, [field]: val });
  return (
    <>
      <div className="row-toggle" onClick={() => set('useDiscord', !perm.useDiscord)}>
        <div className={`toggle ${perm.useDiscord ? 'on' : ''}`}></div>
        <div className="lbl">Discord alap jogosultság<br/><span style={{fontSize:11,color:'var(--ink-faint)',fontWeight:400}}>{discordLabel}</span></div>
      </div>
      <MultiPick label="Engedélyezett rangok (rang alapú)" items={roles} value={perm.roleIds}
        onChange={v => set('roleIds', v)} placeholder="— Nincs kiválasztott rang —"
        hint="Ezek a rangok akkor is használhatják a parancsot, ha nincs Discord joguk." />
      <ChipInput label="Engedélyezett személyek (Discord ID)" value={perm.userIds}
        onChange={v => set('userIds', v)} placeholder="pl. 123456789012345678"
        sanitize={v => v.replace(/\D/g, '').slice(0, 30)}
        hint="Ezek a felhasználók név szerint is használhatják a parancsot." />
    </>
  );
}

function ModCommandsPage({ bot, goBack, onUnsaved, moduleOn = true, onToggleModule }) {
  const [cfg, setCfg]         = useDState(null);
  const [orig, setOrig]       = useDState(null);
  const [roles, setRoles]     = useDState([]);
  const [loading, setLoading] = useDState(true);
  const [saving, setSaving]   = useDState(false);
  const [openCmd, setOpenCmd] = useDState(null);

  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('vh_token')}` });
  const clone = (o) => JSON.parse(JSON.stringify(o));

  useDEffect(() => {
    onUnsaved?.(false);
    Promise.all([
      fetch(`/api/bots/${bot.id}/moderation`, { headers: auth() }).then(r => r.ok ? r.json() : null),
      fetch(`/api/bots/${bot.id}/guild/roles`, { headers: auth() }).then(r => r.ok ? r.json() : []),
    ]).then(([data, rls]) => {
      const c = withCmdPerms(mergeAmConfig(data));
      setCfg(c); setOrig(clone(c));
      setRoles(Array.isArray(rls) ? rls : []);
    }).catch(() => {
      const c = withCmdPerms(mergeAmConfig(null));
      setCfg(c); setOrig(clone(c));
    }).finally(() => setLoading(false));
    return () => onUnsaved?.(false);
  }, [bot.id]);

  const dirty = useDMemo(() => cfg && orig && JSON.stringify(cfg) !== JSON.stringify(orig), [cfg, orig]);
  useDEffect(() => { onUnsaved?.(!!dirty); }, [dirty]);

  async function saveCfg(next, okMsg) {
    const r = await fetch(`/api/bots/${bot.id}/moderation`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...auth() },
      body: JSON.stringify(next),
    }).catch(() => null);
    if (r?.ok) { setCfg(next); setOrig(clone(next)); if (okMsg) toast(okMsg); return true; }
    toast('Nem sikerült menteni.', 'err');
    return false;
  }

  async function setLanguage(lang) {
    if (!cfg || cfg.language === lang || saving || dirty) return;
    setSaving(true);
    await saveCfg({ ...cfg, language: lang }, lang === 'en' ? 'A parancsok mostantól angolul érhetők el.' : 'A parancsok mostantól magyarul érhetők el.');
    setSaving(false);
  }

  async function toggleCmd(action) {
    if (!cfg || saving || dirty) return;
    setSaving(true);
    const disabled = cfg.disabledCommands ?? [];
    const turningOff = !disabled.includes(action);
    const next = { ...cfg, disabledCommands: turningOff ? [...disabled, action] : disabled.filter(a => a !== action) };
    await saveCfg(next, turningOff ? 'Parancs kikapcsolva. A Discordból pár perc múlva eltűnik.' : 'Parancs bekapcsolva. A Discordban pár perc múlva megjelenik.');
    setSaving(false);
  }

  const setGlobalPerm = (perm) => setCfg(prev => ({ ...prev, commandPerms: { ...prev.commandPerms, global: perm } }));

  function setCmdMode(action, mode) {
    setCfg(prev => {
      const overrides = { ...prev.commandPerms.overrides };
      if (mode === 'inherit') delete overrides[action];
      else overrides[action] = { inherit: false, ...clone(prev.commandPerms.global) };
      return { ...prev, commandPerms: { ...prev.commandPerms, overrides } };
    });
  }

  function setCmdPerm(action, perm) {
    setCfg(prev => ({
      ...prev,
      commandPerms: { ...prev.commandPerms, overrides: { ...prev.commandPerms.overrides, [action]: { inherit: false, ...perm } } },
    }));
  }

  async function save() {
    setSaving(true);
    await saveCfg(clone(cfg), 'Jogosultságok mentve! A Discordban pár perc múlva frissül.');
    setSaving(false);
  }
  function reset() { setCfg(clone(orig)); setOpenCmd(null); }

  if (loading || !cfg) return <SkeletonCards />;

  const lang = cfg.language === 'en' ? 'en' : 'hu';
  const g = cfg.commandPerms.global;
  const modeLocked = saving || dirty;

  const langBtn = (val, flag, label) => (
    <button onClick={() => setLanguage(val)} disabled={saving || dirty}
      style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'9px 18px',borderRadius:10,border:'1px solid',cursor: (saving||dirty)?'not-allowed':'pointer',fontSize:13,fontWeight:600,opacity:dirty?.6:1,
        borderColor: lang===val ? 'var(--blue-soft)' : 'var(--line)',
        background:  lang===val ? 'rgba(88,101,242,0.15)' : 'var(--glass)',
        color:       lang===val ? 'var(--blue-soft)' : 'var(--ink-dim)'}}>
      <span style={{fontSize:16}}>{flag}</span>{label}
    </button>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <button className="page-back" onClick={goBack}>{ICO.back} Vissza</button>
          <h1 className="page-title">Moderációs parancsok</h1>
          <div className="page-sub">Beépített kitiltás, kirúgás, felfüggesztés és némítás parancsok.</div>
        </div>
        <div className="page-actions" style={{alignItems:'center',gap:12}}>
          <span className={`status-pill ${moduleOn ? 'live' : 'off'}`}>
            <span className="pdot"></span>{moduleOn ? 'Bekapcsolva' : 'Kikapcsolva'}
          </span>
          <div className={`toggle ${moduleOn ? 'on' : ''}`} onClick={onToggleModule} style={{cursor:'pointer'}} title={moduleOn ? 'Modul kikapcsolása' : 'Modul bekapcsolása'}></div>
        </div>
      </div>

      <div className={`module-body ${moduleOn ? '' : 'module-off'}`}>

      <div className="cfg-card" style={{maxWidth:520,marginBottom:20}}>
        <div className="cfg-head"><div className="ico">{ICO.globe}</div><h3>Parancsok nyelve</h3></div>
        <div style={{display:'flex',gap:10}}>
          {langBtn('hu', '🇭🇺', 'Magyar')}
          {langBtn('en', '🇬🇧', 'Angol')}
        </div>
        <div style={{fontSize:12,color:'var(--ink-faint)',marginTop:10}}>
          Csak a parancsok neve változik (pl. <code>/kitiltás</code> ↔ <code>/ban</code>), a bot válaszai magyarok maradnak. A módosítás után a Discordban pár perc múlva frissülnek a parancsok.
          {dirty && <span style={{color:'#ffcf70'}}> Előbb mentsd vagy vesd el a jogosultság-módosításokat.</span>}
        </div>
      </div>

      <div className="cfg-card" style={{marginBottom:20}}>
        <div className="cfg-head"><div className="ico">{ICO.shield}</div><h3>Közös jogosultság</h3></div>
        <div style={{fontSize:12,color:'var(--ink-faint)',marginBottom:14,maxWidth:640}}>
          Ez vonatkozik minden moderációs parancsra, kivéve amelyiknél lentebb egyedit állítasz be. A források <strong>VAGY</strong> kapcsolatban vannak: akinek megvan a Discord joga, <em>vagy</em> benne van az engedélyezett rangokban, <em>vagy</em> a személyek közt. Az használhatja a parancsot.
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:20}}>
          <PermEditor perm={g} roles={roles} onChange={setGlobalPerm}
            discordLabel="Minden parancs a saját beépített jogát használja (Kitiltás / Kirúgás / Moderálás)." />
        </div>
      </div>

      <div className="cmd-list">
        {MODCMD_LIST.map(c => {
          const cmdOn = !(cfg.disabledCommands ?? []).includes(c.en);
          const eff   = effectivePerm(cfg, c.en);
          const open  = openCmd === c.en;
          const modeBadge = eff.custom
            ? { txt: 'Egyedi jog', bg: 'rgba(88,101,242,0.15)', col: 'var(--blue-soft)', bd: 'rgba(88,101,242,0.35)' }
            : { txt: 'Közös jog',  bg: 'var(--glass)',           col: 'var(--ink-dim)',  bd: 'var(--line)' };
          return (
            <div key={c.en} style={{marginBottom:8}}>
              <div className="cmd-row" style={{gridTemplateColumns:'auto 1fr auto auto auto',opacity:cmdOn?1:.5,transition:'opacity .2s'}}>
                <span style={{padding:'2px 8px',borderRadius:6,fontSize:11,fontFamily:'monospace',fontWeight:600,background:'rgba(255,107,129,0.15)',color:'#ff8fa3'}}>mod</span>
                <div>
                  <div className="name">/{lang === 'en' ? c.en : c.hu} <span style={{color:'var(--ink-faint)',fontWeight:400,fontSize:12}}>· {lang === 'en' ? `/${c.hu}` : `/${c.en}`}</span></div>
                  <div className="desc">{c.desc}</div>
                </div>
                <button onClick={() => setOpenCmd(open ? null : c.en)}
                  style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 10px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',
                    background:modeBadge.bg,border:`1px solid ${modeBadge.bd}`,color:modeBadge.col}}
                  title="Jogosultság beállítása">
                  {ICO.shield} {modeBadge.txt} <span style={{fontSize:10,opacity:.8}}>{open ? '▲' : '▼'}</span>
                </button>
                <span style={{padding:'2px 8px',borderRadius:6,fontSize:11,border:'1px solid var(--line)',color:'var(--ink-dim)',whiteSpace:'nowrap'}}>{c.perm}</span>
                <div className={`toggle ${cmdOn ? 'on' : ''}`} onClick={() => toggleCmd(c.en)}
                  style={{cursor: modeLocked ? 'not-allowed' : 'pointer', opacity: modeLocked ? .5 : 1}}
                  title={modeLocked ? 'Előbb mentsd a jogosultságokat' : (cmdOn ? 'Parancs kikapcsolása' : 'Parancs bekapcsolása')}></div>
              </div>

              {open && (
                <div className="cfg-card" style={{marginTop:6,marginLeft:0,borderColor:'var(--blue-soft)'}}>
                  <div style={{display:'flex',gap:10,marginBottom:eff.custom?16:0,flexWrap:'wrap'}}>
                    <button onClick={() => setCmdMode(c.en, 'inherit')}
                      style={{flex:1,minWidth:180,padding:'9px 14px',borderRadius:10,border:'1px solid',cursor:'pointer',fontSize:13,fontWeight:600,
                        borderColor:!eff.custom?'var(--blue-soft)':'var(--line)',background:!eff.custom?'rgba(88,101,242,0.15)':'var(--glass)',color:!eff.custom?'var(--blue-soft)':'var(--ink-dim)'}}>
                      Közös beállítás öröklése
                    </button>
                    <button onClick={() => setCmdMode(c.en, 'custom')}
                      style={{flex:1,minWidth:180,padding:'9px 14px',borderRadius:10,border:'1px solid',cursor:'pointer',fontSize:13,fontWeight:600,
                        borderColor:eff.custom?'var(--blue-soft)':'var(--line)',background:eff.custom?'rgba(88,101,242,0.15)':'var(--glass)',color:eff.custom?'var(--blue-soft)':'var(--ink-dim)'}}>
                      Egyedi jogosultság
                    </button>
                  </div>
                  {eff.custom && (
                    <PermEditor perm={cfg.commandPerms.overrides[c.en]} roles={roles}
                      onChange={p => setCmdPerm(c.en, p)}
                      discordLabel={`A parancs beépített joga: „${c.perm}".`} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{fontSize:12,color:'var(--ink-faint)',marginTop:16,display:'flex',gap:8,alignItems:'flex-start',maxWidth:760}}>
        {ICO.warn}
        <span>Ha egy parancshoz rangot vagy személyt is engedélyezel, az a Discordban mindenkinek látszani fog, de csak a jogosultak tudják ténylegesen használni — a többieknek a bot „Nincs jogosultságod" választ ad. IP alapú kitiltás nem lehetséges.</span>
      </div>

      </div>

      {dirty && <UnsavedBar onReset={reset} onSave={save} saving={saving} />}
    </>
  );
}
