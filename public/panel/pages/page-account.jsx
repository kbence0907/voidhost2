function AccountPage({ user }) {
  const tok = () => localStorage.getItem('vh_token');
  const auth = () => ({ Authorization: `Bearer ${tok()}` });

  const [data, setData] = useDState(null);
  const [busy, setBusy] = useDState('');

  async function loadAccount() {
    const r = await fetch('/api/account', { headers: auth() });
    if (r.ok) setData(await r.json());
  }
  useDEffect(() => { loadAccount(); }, []);

  const [editName, setEditName]   = useDState('');
  const [editingName, setEditingName] = useDState(false);

  async function saveName() {
    if (editName.trim().length < 2) return;
    setBusy('name');
    const r = await fetch('/api/account/name', { method:'PUT', headers:{...auth(),'Content-Type':'application/json'}, body: JSON.stringify({ name: editName.trim() }) });
    const d = await r.json();
    setBusy('');
    if (r.ok) { toast('Név megváltoztatva!'); setEditingName(false); loadAccount(); }
    else toast(d.error || 'Hiba.', 'err');
  }

  const [emailStep, setEmailStep] = useDState('idle');
  const [newEmail, setNewEmail]   = useDState('');
  const [emailCode, setEmailCode] = useDState('');
  const [emailTimer, setEmailTimer] = useDState(0);

  useDEffect(() => {
    if (emailStep !== 'sent') return;
    setEmailTimer(300);
    const iv = setInterval(() => setEmailTimer(t => {
      if (t <= 1) { clearInterval(iv); setEmailStep('idle'); setEmailCode(''); return 0; }
      return t - 1;
    }), 1000);
    return () => clearInterval(iv);
  }, [emailStep]);

  async function sendEmailChange() {
    if (!newEmail.includes('@')) return;
    setBusy('email-send');
    const r = await fetch('/api/account/email/change', { method:'POST', headers:{...auth(),'Content-Type':'application/json'}, body: JSON.stringify({ email: newEmail }) });
    const d = await r.json();
    setBusy('');
    if (r.ok) { setEmailStep('sent'); toast('Kód elküldve az új email címre!'); }
    else toast(d.error || 'Hiba.', 'err');
  }

  async function verifyEmailChange() {
    if (emailCode.length !== 6) return;
    setBusy('email-verify');
    const r = await fetch('/api/account/email/verify', { method:'POST', headers:{...auth(),'Content-Type':'application/json'}, body: JSON.stringify({ code: emailCode }) });
    const d = await r.json();
    setBusy('');
    if (r.ok) { toast('Email cím megváltoztatva!'); setEmailStep('idle'); setNewEmail(''); setEmailCode(''); loadAccount(); }
    else toast(d.error || 'Hiba.', 'err');
  }

  const [pwStep, setPwStep]       = useDState('idle');
  const [pwCurrent, setPwCurrent] = useDState('');
  const [pwNew, setPwNew]         = useDState('');
  const [pwNew2, setPwNew2]       = useDState('');

  const pwChecks = {
    len:    pwNew.length >= 8,
    letter: /[a-zA-Z]/.test(pwNew),
    num:    /[0-9]/.test(pwNew),
    spec:   /[^a-zA-Z0-9]/.test(pwNew),
    space:  pwNew.length > 0 && !/\s/.test(pwNew),
  };
  const pwValid = Object.values(pwChecks).every(Boolean) && pwNew.length <= 256;
  const pwMatch = pwNew2.length > 0 && pwNew === pwNew2;

  function resetPwForm() {
    setPwCurrent(''); setPwNew(''); setPwNew2('');
  }

  async function changePassword() {
    if (!pwCurrent || !pwValid || !pwMatch) return;
    setBusy('pw-change');
    const r = await fetch('/api/account/password', { method:'POST', headers:{...auth(),'Content-Type':'application/json'}, body: JSON.stringify({ current_password: pwCurrent, new_password: pwNew }) });
    const d = await r.json();
    setBusy('');
    if (r.ok) { toast('Jelszó megváltoztatva! A többi eszközön ki lettél léptetve.'); setPwStep('idle'); resetPwForm(); loadAccount(); }
    else toast(d.error || 'Hiba.', 'err');
  }

  async function revokeSession(id) {
    setBusy('sess-' + id);
    const r = await fetch(`/api/account/sessions/${id}`, { method:'DELETE', headers: auth() });
    const d = await r.json();
    setBusy('');
    if (r.ok) { toast('Munkamenet lezárva.'); loadAccount(); }
    else toast(d.error || 'Hiba.', 'err');
  }

  const [twoFAStep, setTwoFAStep] = useDState('idle');
  const [setupData, setSetupData] = useDState(null);
  const [totpCode,  setTotpCode]  = useDState('');
  const [twoFAPw,   setTwoFAPw]   = useDState('');

  async function start2FASetup() {
    if (!twoFAPw) return;
    setBusy('2fa-setup');
    const r = await fetch('/api/account/2fa/setup', { method:'POST', headers:{...auth(),'Content-Type':'application/json'}, body: JSON.stringify({ password: twoFAPw }) });
    const d = await r.json();
    setBusy('');
    if (r.ok) { setSetupData(d); setTotpCode(''); setTwoFAPw(''); setTwoFAStep('setup'); }
    else toast(d.error || 'Hiba.', 'err');
  }

  async function enable2FA() {
    if (totpCode.length !== 6) return;
    setBusy('2fa-enable');
    const r = await fetch('/api/account/2fa/enable', { method:'POST', headers:{...auth(),'Content-Type':'application/json'}, body: JSON.stringify({ code: totpCode }) });
    const d = await r.json();
    setBusy('');
    if (r.ok) { toast('Kétlépéses hitelesítés bekapcsolva!'); setTwoFAStep('idle'); setSetupData(null); setTotpCode(''); loadAccount(); }
    else toast(d.error || 'Hibás kód.', 'err');
  }

  async function disable2FA() {
    if (totpCode.length !== 6 || !twoFAPw) return;
    setBusy('2fa-disable');
    const r = await fetch('/api/account/2fa/disable', { method:'POST', headers:{...auth(),'Content-Type':'application/json'}, body: JSON.stringify({ code: totpCode, password: twoFAPw }) });
    const d = await r.json();
    setBusy('');
    if (r.ok) { toast('2FA kikapcsolva.'); setTwoFAStep('idle'); setTotpCode(''); setTwoFAPw(''); loadAccount(); }
    else toast(d.error || 'Hibás kód.', 'err');
  }

  const avatarUrl = user.avatar;
  const timerStr  = emailTimer > 0 ? `${Math.floor(emailTimer/60)}:${String(emailTimer%60).padStart(2,'0')}` : '';
  const roleColor = user.roleColor || '#6c63ff';

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title-row"><h1 className="page-title">Fiókom</h1></div>
          <div className="page-sub">Profil, biztonság és aktív munkamenetek</div>
        </div>
      </div>

      <div style={{background:'var(--glass)',border:'1px solid var(--line)',borderRadius:16,padding:'24px 28px',marginBottom:20,display:'flex',alignItems:'center',gap:22,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${roleColor},transparent)`,opacity:.7}} />
        {avatarUrl
          ? <img src={avatarUrl} alt={user.name} style={{width:72,height:72,borderRadius:'50%',objectFit:'cover',border:`3px solid ${roleColor}`,flexShrink:0,boxShadow:`0 0 20px ${roleColor}44`}}/>
          : <div style={{width:72,height:72,borderRadius:'50%',background:`linear-gradient(135deg,${roleColor},#a78bfa)`,display:'grid',placeItems:'center',fontSize:28,fontWeight:700,color:'#fff',flexShrink:0}}>{user.short}</div>
        }
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:22,lineHeight:1.2}}>{data?.name ?? user.name}</div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginTop:7,flexWrap:'wrap'}}>
            <span style={{fontSize:11,padding:'3px 10px',borderRadius:20,background:`${roleColor}22`,border:`1px solid ${roleColor}44`,color:roleColor,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.08em',fontFamily:"'JetBrains Mono',monospace"}}>{user.role}</span>
            <span style={{fontSize:12,color:'var(--ink-faint)',fontFamily:"'JetBrains Mono',monospace"}}>{data?.email ?? user.email}</span>
            {user.discord_id && (
              <span style={{fontSize:12,padding:'3px 10px',borderRadius:20,background:'rgba(88,101,242,.15)',border:'1px solid rgba(88,101,242,.3)',color:'#7289da',display:'flex',alignItems:'center',gap:5}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/></svg>
                {user.discord_username}
              </span>
            )}
          </div>
        </div>
        {data && (
          <div style={{display:'flex',gap:28,flexShrink:0,textAlign:'center'}}>
            <div>
              <div style={{fontSize:24,fontWeight:700,fontFamily:"'Space Grotesk',sans-serif"}}>{data.sessions?.length ?? 0}</div>
              <div style={{fontSize:11,color:'var(--ink-faint)',marginTop:2}}>munkamenet</div>
            </div>
            <div style={{width:1,background:'var(--line)'}} />
            <div>
              <div style={{display:'grid',placeItems:'center',color: data.totp_enabled ? '#4ade80' : 'var(--ink-faint)'}}>
                {data.totp_enabled
                  ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>
                }
              </div>
              <div style={{fontSize:11,color:'var(--ink-faint)',marginTop:4}}>2FA {data.totp_enabled ? 'aktív' : 'kikapcs.'}</div>
            </div>
          </div>
        )}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,alignItems:'start'}}>

        <div style={{display:'flex',flexDirection:'column',gap:16}}>

          <div className="cfg-card">
            <div className="cfg-head"><div className="ico">{ICO.user}</div><h3>Felhasználónév</h3></div>
            {editingName ? (
              <div style={{display:'flex',gap:8}}>
                <input className="cfg-input" style={{flex:1}} value={editName} onChange={e => setEditName(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && saveName()} />
                <button className={`btn btn-primary${busy==='name' ? ' btn-busy' : ''}`} style={{padding:'6px 22px 6px 14px'}} onClick={saveName}>Mentés</button>
                <button className="btn" style={{padding:'6px 10px'}} onClick={() => setEditingName(false)}>✕</button>
              </div>
            ) : (
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <div style={{flex:1,padding:'9px 14px',background:'var(--glass)',border:'1px solid var(--line)',borderRadius:10,fontSize:14,fontWeight:500}}>{data?.name ?? user.name}</div>
                <button className="btn" style={{padding:'6px 14px',flexShrink:0}} onClick={() => { setEditName(data?.name ?? user.name); setEditingName(true); }}>{ICO.edit}</button>
              </div>
            )}
          </div>

          <div className="cfg-card">
            <div className="cfg-head"><div className="ico">{ICO.mail}</div><h3>Email cím</h3></div>
            {emailStep === 'idle' && (
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <div style={{flex:1,padding:'9px 14px',background:'var(--glass)',border:'1px solid var(--line)',borderRadius:10,fontSize:13,fontFamily:"'JetBrains Mono',monospace",overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{data?.email ?? user.email ?? ''}</div>
                <button className="btn" style={{padding:'6px 14px',flexShrink:0}} onClick={() => { setNewEmail(''); setEmailStep('edit'); }}>{ICO.edit}</button>
              </div>
            )}
            {emailStep === 'edit' && (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <div style={{display:'flex',gap:8}}>
                  <input className="cfg-input" style={{flex:1}} type="email" placeholder="Új email cím..." value={newEmail} onChange={e => setNewEmail(e.target.value)} autoFocus />
                  <button className={`btn btn-primary${busy==='email-send' ? ' btn-busy' : ''}`} style={{padding:'6px 20px 6px 12px',whiteSpace:'nowrap'}} onClick={sendEmailChange} disabled={!newEmail.includes('@')}>Küldés</button>
                  <button className="btn" style={{padding:'6px 10px'}} onClick={() => setEmailStep('idle')}>✕</button>
                </div>
                <div style={{fontSize:12,color:'var(--ink-faint)',display:'flex',alignItems:'center',gap:6}}>{ICO.mail} 6 jegyű kód érkezik az új email címre</div>
              </div>
            )}
            {emailStep === 'sent' && (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <div style={{padding:'10px 14px',borderRadius:10,background:'rgba(108,99,255,.08)',border:'1px solid rgba(108,99,255,.2)',fontSize:13}}>
                  Kód elküldve: <b>{newEmail}</b>
                  <span style={{float:'right',fontFamily:'monospace',color: emailTimer < 60 ? '#f87171' : '#6c63ff',fontWeight:700}}>{timerStr}</span>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <input className="cfg-input" style={{flex:1,letterSpacing:6,fontSize:18,fontFamily:'monospace',textAlign:'center'}} placeholder="000000" maxLength={6} value={emailCode} onChange={e => setEmailCode(e.target.value.replace(/\D/g,''))} autoFocus onKeyDown={e => e.key === 'Enter' && verifyEmailChange()} />
                  <button className={`btn btn-primary${busy==='email-verify' ? ' btn-busy' : ''}`} style={{padding:'6px 16px 6px 10px'}} onClick={verifyEmailChange} disabled={emailCode.length !== 6}>OK</button>
                  <button className="btn" style={{padding:'6px 10px'}} onClick={() => { setEmailStep('idle'); setEmailCode(''); }}>✕</button>
                </div>
              </div>
            )}
          </div>

          <div className="cfg-card">
            <div className="cfg-head"><div className="ico">{ICO.key}</div><h3>Jelszó csere</h3></div>

            {pwStep === 'idle' && (
              <button className="btn btn-block" style={{justifyContent:'flex-start'}} onClick={() => { resetPwForm(); setPwStep('edit'); }}>
                {ICO.edit}<span>Jelszó megváltoztatása</span>
              </button>
            )}

            {pwStep === 'edit' && (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <div className="cfg-field" style={{margin:0}}>
                  <label>Jelenlegi jelszó</label>
                  <input className="cfg-input" type="password" placeholder="••••••••" autoComplete="current-password" value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} autoFocus />
                </div>
                <div className="cfg-field" style={{margin:0}}>
                  <label>Új jelszó</label>
                  <input className="cfg-input" type="password" placeholder="••••••••" autoComplete="new-password" value={pwNew} onChange={e => setPwNew(e.target.value)} />
                  <div style={{fontSize:11,marginTop:5,display:'flex',flexWrap:'wrap',gap:'4px 10px'}}>
                    <span style={{color: pwChecks.len    ? '#4ade80' : 'var(--ink-faint)'}}>min. 8 karakter</span>
                    <span style={{color: pwChecks.letter ? '#4ade80' : 'var(--ink-faint)'}}>1 betű</span>
                    <span style={{color: pwChecks.num    ? '#4ade80' : 'var(--ink-faint)'}}>1 szám</span>
                    <span style={{color: pwChecks.spec   ? '#4ade80' : 'var(--ink-faint)'}}>1 speciális</span>
                    <span style={{color: pwChecks.space  ? '#4ade80' : 'var(--ink-faint)'}}>nincs szóköz</span>
                  </div>
                </div>
                <div className="cfg-field" style={{margin:0}}>
                  <label>Új jelszó mégegyszer</label>
                  <input className="cfg-input" type="password" placeholder="••••••••" autoComplete="new-password" value={pwNew2} onChange={e => setPwNew2(e.target.value)} onKeyDown={e => e.key === 'Enter' && changePassword()} />
                  {pwNew2.length > 0 && !pwMatch && (
                    <div style={{fontSize:11,marginTop:5,color:'#f87171'}}>A két jelszó nem egyezik.</div>
                  )}
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button className={`btn btn-primary${busy==='pw-change' ? ' btn-busy' : ''}`} style={{flex:1}} onClick={changePassword} disabled={!pwCurrent || !pwValid || !pwMatch}>Jelszó mentése</button>
                  <button className="btn" style={{padding:'6px 10px'}} onClick={() => { setPwStep('idle'); resetPwForm(); }}>✕</button>
                </div>
              </div>
            )}
          </div>

          <div className="cfg-card">
            <div className="cfg-head"><div className="ico">{ICO.key}</div><h3>Kétlépéses hitelesítés</h3></div>

            {twoFAStep === 'idle' && (
              <>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',borderRadius:10,background:'var(--glass)',border:'1px solid var(--line)',marginBottom:14}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:13}}>Google Authenticator</div>
                    <div style={{fontSize:12,color:'var(--ink-faint)',marginTop:2}}>{data?.totp_enabled ? 'Belépéskor kód szükséges' : 'Kikapcsolva'}</div>
                  </div>
                  <span className={`status-pill ${data?.totp_enabled ? 'live' : 'off'}`} style={{fontSize:11}}>
                    <span className="pdot"></span>{data?.totp_enabled ? 'Aktív' : 'Inaktív'}
                  </span>
                </div>
                {data?.totp_enabled ? (
                  <button className="btn btn-block" style={{justifyContent:'flex-start',borderColor:'rgba(248,113,113,.3)',color:'#f87171'}} onClick={() => { setTotpCode(''); setTwoFAPw(''); setTwoFAStep('confirm_disable'); }}>
                    {ICO.shield}<span>2FA kikapcsolása</span>
                  </button>
                ) : (
                  <button className="btn btn-block btn-primary" style={{justifyContent:'flex-start'}} onClick={() => { setTwoFAPw(''); setTwoFAStep('ask_pw'); }}>
                    {ICO.key}<span>2FA bekapcsolása</span>
                  </button>
                )}
              </>
            )}

            {twoFAStep === 'ask_pw' && (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <div style={{fontSize:13,color:'var(--ink-faint)'}}>Add meg a jelszavad a 2FA beállításának megkezdéséhez.</div>
                <div style={{display:'flex',gap:8}}>
                  <input className="cfg-input" type="password" style={{flex:1}} placeholder="Jelszó" value={twoFAPw} onChange={e => setTwoFAPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && start2FASetup()} autoFocus />
                  <button className={`btn btn-primary${busy==='2fa-setup' ? ' btn-busy' : ''}`} style={{padding:'6px 18px 6px 12px'}} onClick={start2FASetup} disabled={!twoFAPw}>Tovább</button>
                  <button className="btn" style={{padding:'6px 10px'}} onClick={() => { setTwoFAStep('idle'); setTwoFAPw(''); }}>✕</button>
                </div>
              </div>
            )}

            {twoFAStep === 'setup' && setupData && (
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
                  <img src={setupData.qr || `https://api.qrserver.com/v1/create-qr-code/?size=148x148&data=${encodeURIComponent(setupData.otpauth_url)}&margin=6`} alt="QR" style={{width:148,height:148,borderRadius:10,background:'#fff',flexShrink:0}} />
                  <div style={{flex:1,display:'flex',flexDirection:'column',gap:8}}>
                    <div style={{fontSize:12,color:'var(--ink-faint)'}}>Scanneld be a Google Authenticator appal, vagy add meg manuálisan:</div>
                    <code style={{fontSize:11,background:'var(--glass)',border:'1px solid var(--line)',borderRadius:8,padding:'8px 10px',letterSpacing:1.5,wordBreak:'break-all',lineHeight:1.8}}>{setupData.secret}</code>
                  </div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <input className="cfg-input" style={{flex:1,letterSpacing:6,fontSize:17,fontFamily:'monospace',textAlign:'center'}} placeholder="000000" maxLength={6} value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g,''))} onKeyDown={e => e.key === 'Enter' && enable2FA()} autoFocus />
                  <button className={`btn btn-primary${busy==='2fa-enable' ? ' btn-busy' : ''}`} style={{padding:'6px 18px 6px 12px'}} onClick={enable2FA} disabled={totpCode.length !== 6}>Bekapcs.</button>
                  <button className="btn" style={{padding:'6px 10px'}} onClick={() => { setTwoFAStep('idle'); setSetupData(null); }}>✕</button>
                </div>
              </div>
            )}

            {twoFAStep === 'confirm_disable' && (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <div style={{fontSize:13,color:'var(--ink-faint)'}}>Add meg a jelszavad és a jelenlegi hitelesítő kódot a 2FA kikapcsolásához.</div>
                <input className="cfg-input" type="password" placeholder="Jelszó" value={twoFAPw} onChange={e => setTwoFAPw(e.target.value)} autoFocus />
                <div style={{display:'flex',gap:8}}>
                  <input className="cfg-input" style={{flex:1,letterSpacing:6,fontSize:17,fontFamily:'monospace',textAlign:'center'}} placeholder="000000" maxLength={6} value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g,''))} onKeyDown={e => e.key === 'Enter' && disable2FA()} />
                  <button className={`btn${busy==='2fa-disable' ? ' btn-busy' : ''}`} style={{padding:'6px 16px 6px 10px',borderColor:'rgba(248,113,113,.3)',color:'#f87171'}} onClick={disable2FA} disabled={totpCode.length !== 6 || !twoFAPw}>Kikapcs.</button>
                  <button className="btn" style={{padding:'6px 10px'}} onClick={() => { setTwoFAStep('idle'); setTotpCode(''); setTwoFAPw(''); }}>✕</button>
                </div>
              </div>
            )}
          </div>

        </div>

        <div className="cfg-card" style={{height:'fit-content'}}>
          <div className="cfg-head"><div className="ico">{ICO.monitor}</div><h3>Aktív bejelentkezések</h3>
            {data && data.sessions.length > 0 && <span style={{marginLeft:'auto',fontSize:11,color:'var(--ink-faint)'}}>{data.sessions.length} eszköz</span>}
          </div>
          {!data ? (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {[1,2].map(i => <div key={i} style={{height:62,borderRadius:10,background:'var(--glass)',border:'1px solid var(--line)'}} />)}
            </div>
          ) : data.sessions.length === 0 ? (
            <div style={{textAlign:'center',padding:'28px 0',color:'var(--ink-faint)',fontSize:13}}>Nincs aktív munkamenet</div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {data.sessions.map(s => (
                <div key={s.id} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderRadius:10,background:'var(--glass)',border:`1px solid ${s.current ? `${roleColor}44` : 'var(--line)'}`,position:'relative',overflow:'hidden'}}>
                  {s.current && <div style={{position:'absolute',left:0,top:0,bottom:0,width:3,background:roleColor,borderRadius:'2px 0 0 2px'}} />}
                  <div style={{flex:1,minWidth:0,paddingLeft:s.current ? 6 : 0}}>
                    <div style={{fontWeight:600,fontSize:13,display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
                      {parseUA(s.user_agent)}
                      {s.current && <span style={{fontSize:10,padding:'1px 7px',borderRadius:20,background:`${roleColor}22`,border:`1px solid ${roleColor}44`,color:roleColor,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}>jelenlegi</span>}
                    </div>
                    <div style={{fontSize:11,color:'var(--ink-faint)',marginTop:3,display:'flex',gap:10,flexWrap:'wrap'}}>
                      {s.ip && <span style={{display:'flex',alignItems:'center',gap:3}}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 010 20M2 12h20"/></svg>{s.ip}</span>}
                      <span>aktív: {fmtRelative(s.last_seen_at)}</span>
                      <span>belépett: {fmtRelative(s.created_at)}</span>
                    </div>
                  </div>
                  {!s.current && (
                    <button className={`btn${busy === 'sess-'+s.id ? ' btn-busy' : ''}`} title="Lezárás" style={{padding:'5px 9px',borderRadius:8,flexShrink:0,borderColor:'rgba(248,113,113,.25)',color:'#f87171'}} onClick={() => revokeSession(s.id)}>
                      {ICO.exit}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </>
  );
}
