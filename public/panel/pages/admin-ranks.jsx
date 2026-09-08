const RANK_ROWS = [
  { section: 'BOT KEZELÉS',        fields: [
    { f: 'manageOthersBots',  l: 'Mások botját kezeli',        s: 'indítás · leállítás · konzol hozzáférés' },
    { f: 'createBots',        l: 'Bot létrehozás',              s: 'létrehozhat új botot' },
    { f: 'deleteOwnBots',     l: 'Bot törlés (saját)',          s: 'törölheti saját botját' },
    { f: 'deleteOthersBots',  l: 'Bot törlés (mások botjai)',   s: 'törölhet más felhasználók botjait is' },
    { f: 'editBotSettings',   l: 'Bot beállítások',             s: 'módosíthatja a bot moduljait és beállításait' },
    { f: 'manageBotAccess',   l: 'Hozzáférések kezelése',       s: 'tagokat adhat hozzá és távolíthat el botjából' },
  ]},
  { section: 'FELHASZNÁLÓ KEZELÉS', fields: [
    { f: 'viewUsers',     l: 'Felhasználók listája',  s: 'összes fiók megtekinthető a panelen' },
    { f: 'approveUsers',  l: 'Jóváhagyás oldal',     s: 'új regisztrációk jóváhagyása / elutasítása' },
    { f: 'approvalEmail', l: 'Jóváhagyás email értesítő', s: 'emailt kap, ha valaki jóváhagyásra vár' },
    { f: 'verifyUsers',   l: 'Jóváhagyás / verify',  s: 'fiók jóváhagy, visszavon, email verify kényszer' },
    { f: 'deleteUsers',   l: 'Fiók zárolás',          s: 'fiókot zárolhat vagy feloldhat 4 napra' },
    { f: 'banUsers',      l: 'Felhasználó kitiltás',   s: 'DC + email alapján kitilthat felhasználót' },
    { f: 'unbanUsers',    l: 'Kitiltás feloldása',     s: 'kitiltott felhasználót visszaengedhet' },
    { f: 'changeEmail',   l: 'Név & email csere',     s: 'felhasználó nevét és email-jét módosíthatja' },
    { f: 'resetPassword', l: 'Jelszó visszaállítás',  s: 'visszaállítási kódot küldhet emailben' },
  ]},
  { section: 'RENDSZER',            fields: [
    { f: 'viewLogs',    l: 'Napló megtekintése',     s: 'rendszernapló olvasható' },
    { f: 'viewSysBots', l: 'Botok (rendszer) nézet', s: 'összes bot státusza látható' },
    { f: 'viewRanks',   l: 'Rangok megtekintése',    s: 'rangok és jogosultságok olvasható' },
    { f: 'editRanks',   l: 'Rangok szerkesztése',    s: 'jogosultságok konfigurálása (viewRanks is)' },
    { f: 'manageSystem', l: 'Rendszer beállítások',  s: 'karbantartás mód ki/be kapcsolása' },
  ]},
  { section: 'PLUSZ CSOMAG', plus: true, fields: [
    { f: 'disableBranding', l: 'Branding kikapcsolása', s: 'nem jelenik meg "voidhost.hu" a bot üzenetein' },
  ]},
];

function RankPermCard({ rank, onChange }) {
  const c = rank.color || '#99aab5';
  const toggleOn = {
    background:  `linear-gradient(180deg, ${hexToRgba(c, 0.9)}, ${hexToRgba(c, 0.72)})`,
    borderColor: hexToRgba(c, 0.45),
  };

  return (
    <div className="rp-card" style={{borderTopColor: c}}>
      <div className="rp-card-head">
        <span className="rp-monogram" style={{background: hexToRgba(c, 0.18), color: c, border: `1px solid ${hexToRgba(c, 0.35)}`}}>
          {rank.name[0].toUpperCase()}
        </span>
        <span className="rp-card-name" style={{color: c}}>{rank.name}</span>
      </div>

      <div className="rp-section">
        <div className="rp-sect-title">MAX BOTOK</div>
        <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
          <input type="number" className="rp-num-input" value={rank.maxBots} min={0}
            onChange={e => onChange('maxBots', Math.max(0, parseInt(e.target.value) || 0))} />
          <span style={{fontSize:11,color:'var(--ink-faint)'}}>0 = korlátlan</span>
        </div>
      </div>

      <div className="rp-section">
        <div className="rp-sect-title">MAX TAGOK / BOT</div>
        <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
          <input type="number" className="rp-num-input" value={rank.maxBotMembers ?? 3} min={0}
            onChange={e => onChange('maxBotMembers', Math.max(0, parseInt(e.target.value) || 0))} />
          <span style={{fontSize:11,color:'var(--ink-faint)'}}>0 = korlátlan</span>
        </div>
      </div>

      <div className="rp-section">
        <div className="rp-sect-title">MAX PARANCS / BOT</div>
        <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
          <input type="number" className="rp-num-input" value={rank.maxCommands ?? 25} min={1}
            onChange={e => onChange('maxCommands', Math.max(1, parseInt(e.target.value) || 1))} />
        </div>
      </div>

      {RANK_ROWS.map(({ section, fields, plus }) => (
        <div key={section} className="rp-section">
          <div className="rp-sect-title" style={plus ? {color:'#f5c542',letterSpacing:'0.12em'} : {}}>{section}{plus && <span style={{marginLeft:7,fontSize:9,padding:'2px 6px',borderRadius:4,background:'rgba(245,197,66,0.15)',border:'1px solid rgba(245,197,66,0.35)',color:'#f5c542',fontWeight:700,verticalAlign:'middle'}}>PLUS</span>}</div>
          {fields.map(({ f, l, s }) => {
            const on = !!rank[f];
            return (
              <div key={f} className="rp-row" onClick={() => onChange(f, !on)}>
                <div className="rp-row-label">
                  <div className="rp-row-name">{l}</div>
                  <div className="rp-row-sub">{s}</div>
                </div>
                <div className={`toggle ${on ? 'on' : ''}`} style={on ? toggleOn : {}} />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function RanksPage({ goBack, onUnsaved, onSaved }) {
  const [ranks, setRanks]         = useDState([]);
  const [original, setOriginal]   = useDState([]);
  const [loading, setLoading]     = useDState(true);
  const [saving, setSaving]       = useDState(false);

  const dirty = JSON.stringify(ranks) !== JSON.stringify(original);

  useDEffect(() => { onUnsaved(dirty); }, [dirty]);
  useDEffect(() => () => onUnsaved(false), []);

  useDEffect(() => {
    const token = localStorage.getItem('vh_token');
    fetch('/api/ranks', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRanks(data);
          setOriginal(JSON.parse(JSON.stringify(data)));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function updateRank(id, field, value) {
    setRanks(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  function resetAll() {
    setRanks(JSON.parse(JSON.stringify(original)));
  }

  async function saveAll() {
    setSaving(true);
    const token = localStorage.getItem('vh_token');
    const results = await Promise.all(ranks.map(rank =>
      fetch(`/api/ranks/${rank.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(rank),
      })
    ));
    const failed = results.find(r => !r.ok);
    if (failed) {
      const d = await failed.json().catch(() => ({}));
      toast(d.error || 'Nincs jogosultságod a rangok szerkesztéséhez', 'err');
      setSaving(false);
      return;
    }
    setOriginal(JSON.parse(JSON.stringify(ranks)));
    setSaving(false);
    toast('Rangok mentve', 'ok');
  }

  return (
    <>
      <div className="page-head">
        <div>
          <button className="page-back" onClick={goBack}>{ICO.back} Vissza</button>
          <h1 className="page-title">Rangok</h1>
          <div className="page-sub">Discord szerepkörök jogosultságainak konfigurálása.</div>
        </div>
      </div>

      {loading ? (
        <div style={{display:'flex',gap:16,padding:'4px 0'}}>{[...Array(3)].map((_,i)=><div key={i} className="rp-card" style={{minWidth:260,flex:'0 0 260px',display:'flex',flexDirection:'column',gap:12}}><Sk h={32} r={9}/><Sk h={14}/><Sk h={14} w="80%"/><Sk h={14} w="60%"/><Sk h={14}/><Sk h={14} w="70%"/></div>)}</div>
      ) : (
        <div className="rp-scroll">
          <div className="rp-row-wrap">
            {ranks.map(rank => (
              <RankPermCard
                key={rank.id}
                rank={rank}
                onChange={(field, val) => updateRank(rank.id, field, val)}
              />
            ))}
          </div>
        </div>
      )}

      {dirty && <UnsavedBar onReset={resetAll} onSave={saveAll} saving={saving} />}
    </>
  );
}
