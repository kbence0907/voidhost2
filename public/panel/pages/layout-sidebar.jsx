function Sidebar({ activeBot, currentRoute, onNavigate, onLogout, unsaved, sharedBots = [], onOpenBot, userPerms = {}, isOpen, onClose, pendingApprovals = 0, botModules = { invite: true, commands: true, automod: true, modcommands: true, serverlog: true, tickets: true } }) {
  const is  = (r) => currentRoute === r;
  const nav = (r) => { onNavigate(r); onClose(); };
  const bot = (r) => nav(r);
  const [modOpen, setModOpen] = useDState(MOD_ROUTES.includes(currentRoute));
  useDEffect(() => { if (MOD_ROUTES.includes(currentRoute)) setModOpen(true); }, [currentRoute]);
  const botName = activeBot?.bot_name || '—';
  const nb = unsaved ? 'nav-blocked' : '';
  const isSharedBot       = !!activeBot?.member_perms;
  const canViewLogs       = !!userPerms.viewLogs;
  const canViewSysBots    = !!userPerms.viewSysBots;
  const canViewRanks      = !!userPerms.viewRanks || !!userPerms.editRanks;
  const canViewUsers      = !!userPerms.viewUsers;
  const canManageSystem   = !!userPerms.manageSystem;
  const canApproveUsers   = !!userPerms.approveUsers;
  const canManageBotAccess = userPerms.manageBotAccess !== false;
  const hasAnySystem   = canViewLogs || canViewSysBots || canViewRanks || canViewUsers || canManageSystem || canApproveUsers;
  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar${isOpen ? ' sidebar-open' : ''}`}>
      <div className="sb-brand">
        <span className="brand-text">VOID<span className="brand-host">HOST</span></span>
      </div>

      <div className="sb-scroll">

      <div className="sb-group">
        <div className={`sb-link ${is('home') ? 'active' : ''} ${nb}`} onClick={() => nav('home')}>
          <span className="dot"></span> Főoldal
        </div>
        <div className={`sb-link ${is('bots') ? 'active' : ''} ${nb}`} onClick={() => nav('bots')}>
          <span className="dot"></span> Saját botok
        </div>
      </div>

      {activeBot && (
        <div className="sb-group">
          <div className="bot-tag"><span className="bdot"></span>{botName}</div>
          <div className={`sb-link ${is('bot-console') ? 'active' : ''} ${nb}`} onClick={() => bot('bot-console')}>
            {ICO.cmd}<span>Konzol</span>
          </div>
          {!isSharedBot && canManageBotAccess && (
            <div className={`sb-link ${is('bot-access') ? 'active' : ''} ${nb}`} onClick={() => bot('bot-access')}>
              {ICO.shield}<span>Hozzáférések</span>
            </div>
          )}
          <div className={`sb-link ${is('bot-settings') ? 'active' : ''} ${nb}`} onClick={() => bot('bot-settings')}>
            {ICO.settings}<span>Beállítások</span>
          </div>
          <div className="sb-divider"></div>
          <div className={`sb-link ${is('bot-invite') ? 'active' : ''} ${nb}`} onClick={() => bot('bot-invite')}>
            {ICO.invite}<span>Meghívó üzenetek</span>
            <span className={`mod-badge ${botModules.invite ? 'on' : 'off'}`}>{botModules.invite ? 'ON' : 'OFF'}</span>
          </div>
          <div className={`sb-link ${is('bot-cmd') ? 'active' : ''} ${nb}`} onClick={() => bot('bot-cmd')}>
            {ICO.cmd}<span>Saját parancsok</span>
            <span className={`mod-badge ${botModules.commands ? 'on' : 'off'}`}>{botModules.commands ? 'ON' : 'OFF'}</span>
          </div>
          <div className={`sb-link ${is('bot-serverlog') ? 'active' : ''} ${nb}`} onClick={() => bot('bot-serverlog')}>
            {ICO.log}<span>Szerver Napló</span>
            <span className={`mod-badge ${botModules.serverlog ? 'on' : 'off'}`}>{botModules.serverlog ? 'ON' : 'OFF'}</span>
          </div>
          <div className={`sb-link ${is('bot-tickets') ? 'active' : ''} ${nb}`} onClick={() => bot('bot-tickets')}>
            {ICO.ticket}<span>Hibajegy</span>
            <span className={`mod-badge ${botModules.tickets ? 'on' : 'off'}`}>{botModules.tickets ? 'ON' : 'OFF'}</span>
          </div>
          <div className={`sb-link ${MOD_ROUTES.includes(currentRoute) ? 'active' : ''} ${nb}`} onClick={() => setModOpen(o => !o)}>
            {ICO.shield}<span>Moderáció</span>
            <span style={{marginLeft:'auto',fontSize:9,color:'var(--ink-faint)'}}>{modOpen ? '▲' : '▼'}</span>
          </div>
          {modOpen && (
            <div style={{margin:'6px 0 4px 16px',borderLeft:'1px solid var(--line)',paddingLeft:8,display:'flex',flexDirection:'column',gap:5}}>
              <div className={`sb-link ${is('bot-automod') ? 'active' : ''} ${nb}`} onClick={() => bot('bot-automod')} style={{padding:'7px 10px',fontSize:12.5}}>
                <span>Auto Moderáció</span>
                <span className={`mod-badge ${botModules.automod ? 'on' : 'off'}`}>{botModules.automod ? 'ON' : 'OFF'}</span>
              </div>
              <div className={`sb-link ${is('bot-modcmd') ? 'active' : ''} ${nb}`} onClick={() => bot('bot-modcmd')} style={{padding:'7px 10px',fontSize:12.5}}>
                <span>Parancsok</span>
                <span className={`mod-badge ${botModules.modcommands ? 'on' : 'off'}`}>{botModules.modcommands ? 'ON' : 'OFF'}</span>
              </div>
              <div className={`sb-link ${is('bot-modlog') ? 'active' : ''} ${nb}`} onClick={() => bot('bot-modlog')} style={{padding:'7px 10px',fontSize:12.5}}>
                <span>Parancs log</span>
              </div>
            </div>
          )}
        </div>
      )}

      {sharedBots.length > 0 && (
        <div className="sb-group">
          <div className="sb-group-title">Megosztott botok</div>
          {sharedBots.map(b => {
            const short = b.bot_name ? b.bot_name[0].toUpperCase() : '?';
            return (
              <div key={b.id} className={`sb-link ${nb}`} onClick={() => { if (!unsaved) { onOpenBot(b); onClose(); } }} style={{gap:8}}>
                {b.bot_avatar
                  ? <img src={b.bot_avatar} alt={b.bot_name} style={{width:18,height:18,borderRadius:5,objectFit:'cover',flexShrink:0}} />
                  : <span style={{width:18,height:18,borderRadius:5,background:'var(--glass-2)',border:'1px solid var(--line)',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0}}>{short}</span>
                }
                <span>{b.bot_name}</span>
              </div>
            );
          })}
        </div>
      )}

      {hasAnySystem && (
        <div className="sb-group">
          <div className="sb-group-title">Rendszer</div>
          {canViewRanks && (
            <div className={`sb-link ${is('ranks') ? 'active' : ''} ${nb}`} onClick={() => nav('ranks')}>
              <span className="dot"></span> Rangok
            </div>
          )}
          {canViewLogs && (
            <div className={`sb-link ${is('logs') ? 'active' : ''} ${nb}`} onClick={() => nav('logs')}>
              <span className="dot"></span> Napló
            </div>
          )}
          {canViewSysBots && (
            <div className={`sb-link ${is('sys-bots') ? 'active' : ''} ${nb}`} onClick={() => nav('sys-bots')}>
              <span className="dot"></span> Botok
            </div>
          )}
          {canViewUsers && (
            <div className={`sb-link ${is('users') ? 'active' : ''} ${nb}`} onClick={() => nav('users')}>
              <span className="dot"></span> Felhasználók
            </div>
          )}
          {canApproveUsers && (
            <div className={`sb-link ${is('approvals') ? 'active' : ''} ${nb}`} onClick={() => nav('approvals')}>
              <span className="dot"></span> Jóváhagyás
              {pendingApprovals > 0 && <span className="sb-count">{pendingApprovals > 9 ? '9+' : pendingApprovals}</span>}
            </div>
          )}
          {canManageSystem && (
            <div className={`sb-link ${is('settings') ? 'active' : ''} ${nb}`} onClick={() => nav('settings')}>
              <span className="dot"></span> Beállítások
            </div>
          )}
        </div>
      )}

      </div>

      <div className="sb-group sb-bottom">
        <div className={`sb-link ${is('account') ? 'active' : ''} ${nb}`} onClick={() => nav('account')}>
          <span className="dot"></span> Fiókom
        </div>
        <div className={`sb-link ${nb}`} onClick={onLogout}>
          {ICO.exit}<span>Kilépés</span>
        </div>
      </div>
    </aside>
    </>
  );
}

function parseUA(ua) {
  if (!ua) return 'Ismeretlen eszköz';
  if (/Mobile|Android|iPhone|iPad/.test(ua)) {
    if (/iPhone|iPad/.test(ua)) return 'iOS · Safari';
    return 'Mobil · Android';
  }
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Böngésző';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${os} · ${browser}` : browser;
}

function fmtRelative(ts) {
  const d = Date.now() - ts;
  if (d < 60000) return 'most';
  if (d < 3600000) return `${Math.floor(d/60000)} perce`;
  if (d < 86400000) return `${Math.floor(d/3600000)} órája`;
  return `${Math.floor(d/86400000)} napja`;
}
