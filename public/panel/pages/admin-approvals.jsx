function RejectModal({ user, onClose, onConfirm, busy }) {
  const [reason, setReason] = useDState('');
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{maxWidth:420}} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3 style={{color:'#ff6b81'}}>Regisztráció elutasítása</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{fontSize:13,color:'var(--ink-faint)',marginBottom:14}}>
          <b style={{color:'var(--ink)'}}>{user.name}</b> ({user.email}) fiókja törlődik. A felhasználó emailben értesítést kap.
        </div>
        <div className="cfg-field" style={{margin:0}}>
          <label>Indok <span style={{color:'var(--ink-faint)'}}>(opcionális, megjelenik az emailben)</span></label>
          <input className="cfg-input" style={{marginTop:6}} maxLength={300} value={reason}
            onChange={e => setReason(e.target.value)} placeholder="pl. nem valós adatok" autoFocus />
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:20}}>
          <button className="btn" onClick={onClose}>Mégse</button>
          <button
            className={`btn${busy ? ' btn-busy' : ''}`}
            style={{background:'rgba(255,107,129,.15)',border:'1px solid rgba(255,107,129,.3)',color:'#ff6b81',paddingRight: busy ? 32 : 14}}
            disabled={busy}
            onClick={() => onConfirm(reason.trim())}>
            Elutasítás
          </button>
        </div>
      </div>
    </div>
  );
}

function ApprovalsPage({ goBack, onChange }) {
  const [list, setList]       = useDState([]);
  const [loading, setLoading] = useDState(true);
  const [busy, setBusy]       = useDState('');
  const [rejectFor, setRejectFor] = useDState(null);

  const tok  = () => localStorage.getItem('vh_token');
  const auth = () => ({ Authorization: `Bearer ${tok()}` });

  function load(silent) {
    if (!silent) setLoading(true);
    fetch('/api/approvals', { headers: auth() })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setList(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useDEffect(() => { load(); }, []);

  async function approve(u) {
    setBusy(u.id);
    const r = await fetch(`/api/approvals/${u.id}/approve`, { method: 'POST', headers: auth() }).catch(() => null);
    setBusy('');
    if (r && r.ok) {
      toast(`${u.name} jóváhagyva`, 'ok');
      setList(prev => prev.filter(x => x.id !== u.id));
      onChange && onChange();
    } else {
      const d = await r?.json().catch(() => ({}));
      toast(d?.error || 'Hiba a jóváhagyáskor.', 'err');
    }
  }

  async function doReject(reason) {
    const u = rejectFor;
    if (!u) return;
    setBusy(u.id);
    const r = await fetch(`/api/approvals/${u.id}/reject`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    }).catch(() => null);
    setBusy('');
    setRejectFor(null);
    if (r && r.ok) {
      toast(`${u.name} elutasítva`, 'ok');
      setList(prev => prev.filter(x => x.id !== u.id));
      onChange && onChange();
    } else {
      const d = await r?.json().catch(() => ({}));
      toast(d?.error || 'Hiba az elutasításkor.', 'err');
    }
  }

  return (
    <>
      {rejectFor && <RejectModal user={rejectFor} onClose={() => setRejectFor(null)} onConfirm={doReject} busy={busy === rejectFor.id} />}

      <div className="page-head">
        <div>
          <button className="page-back" onClick={goBack}>{ICO.back} Vissza</button>
          <h1 className="page-title">Jóváhagyás</h1>
          <div className="page-sub">{list.length} fiók vár jóváhagyásra</div>
        </div>
      </div>

      {loading ? <SkeletonUserList /> : list.length === 0 ? (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 0',gap:14,textAlign:'center'}}>
          <div style={{width:52,height:52,borderRadius:14,background:'var(--glass)',border:'1px solid var(--line)',display:'grid',placeItems:'center'}}>{ICO.check}</div>
          <div>
            <div style={{fontSize:16,fontWeight:600,fontFamily:"'Space Grotesk',sans-serif"}}>Nincs függőben lévő kérés</div>
            <div style={{fontSize:13,color:'var(--ink-faint)',marginTop:6}}>Minden regisztráció el van bírálva.</div>
          </div>
        </div>
      ) : (
        <div className="user-list">
          <div className="user-list-head">
            <span>Felhasználó</span>
            <span>Discord</span>
            <span>Regisztráció</span>
            <span>Művelet</span>
          </div>
          {list.map(u => (
            <div key={u.id} className="user-row" style={{cursor:'default'}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                {u.avatar
                  ? <img src={u.avatar} alt={u.name} style={{width:36,height:36,borderRadius:'50%',objectFit:'cover',flexShrink:0}} />
                  : <div style={{width:36,height:36,borderRadius:'50%',background:'#6c63ff',display:'grid',placeItems:'center',fontSize:14,fontWeight:700,color:'#fff',flexShrink:0}}>{u.name[0].toUpperCase()}</div>
                }
                <div>
                  <div style={{fontWeight:600,fontSize:14}}>{u.name}</div>
                  <div style={{fontSize:12,color:'var(--ink-faint)',marginTop:1}}>{u.email}</div>
                </div>
              </div>
              <div style={{fontSize:13,color:'var(--ink-faint)'}}>{u.discord_username || '—'}</div>
              <div style={{fontSize:13,color:'var(--ink-faint)'}}>{fmtDate(u.created_at)}</div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <button
                  className={`btn btn-primary${busy === u.id ? ' btn-busy' : ''}`}
                  style={{fontSize:12,padding: busy === u.id ? '5px 28px 5px 12px' : '5px 12px'}}
                  disabled={!!busy}
                  onClick={() => approve(u)}>
                  Jóváhagy
                </button>
                <button
                  className="btn"
                  style={{fontSize:12,padding:'5px 12px',borderColor:'rgba(255,107,129,.3)',color:'#ff6b81'}}
                  disabled={!!busy}
                  onClick={() => setRejectFor(u)}>
                  Elutasít
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
