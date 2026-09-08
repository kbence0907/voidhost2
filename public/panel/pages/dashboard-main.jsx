const BOT_ROUTES = new Set(['bot-settings', 'bot-invite', 'bot-cmd', 'bot-console', 'bot-access', 'bot-automod', 'bot-modcmd', 'bot-modlog', 'bot-serverlog', 'bot-tickets']);

function Dashboard({ user: apiUser, onLogout }) {
  const [bots, setBots]                 = useDState([]);
  const [sharedBots, setSharedBots]     = useDState([]);
  const [openTabs, setOpenTabs]         = useDState([]);
  const [activeTabIdx, setActiveTabIdx] = useDState(null);
  const [globalRoute, setGlobalRoute]   = useDState('bots');
  const [unsaved, setUnsaved]           = useDState(false);
  const [freshUser, setFreshUser]       = useDState(apiUser);
  const [kickMsg, setKickMsg]           = useDState(null);
  const [sidebarOpen, setSidebarOpen]   = useDState(false);
  const [botModules, setBotModules]     = useDState({ invite: true, commands: true, automod: true, modcommands: true, serverlog: true, tickets: true });
  const [notifs, setNotifs]             = useDState([]);
  const [notifUnread, setNotifUnread]   = useDState(0);

  function loadNotifs() {
    const t = localStorage.getItem('vh_token');
    fetch('/api/notifications', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) { setNotifs(Array.isArray(data.items) ? data.items : []); setNotifUnread(data.unread || 0); } })
      .catch(() => {});
  }

  function markNotifsRead() {
    setNotifUnread(0);
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    const t = localStorage.getItem('vh_token');
    fetch('/api/notifications/read', { method: 'POST', headers: { Authorization: `Bearer ${t}` } }).catch(() => {});
  }

  function loadBots() {
    const t = localStorage.getItem('vh_token');
    fetch('/api/bots', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setBots(data); })
      .catch(() => {});
    fetch('/api/bots/shared', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSharedBots(data); })
      .catch(() => {});
  }

  function loadUser() {
    const t = localStorage.getItem('vh_token');
    fetch('/api/me', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setFreshUser(data); })
      .catch(() => {});
  }

  useDEffect(() => { loadBots(); loadNotifs(); }, []);

  useDEffect(() => {
    if (sharedBots.length === 0) return;
    setOpenTabs(prev => {
      let changed = false;
      const next = prev.map(tab => {
        if (!tab.bot.member_perms) return tab;
        const updated = sharedBots.find(b => b.id === tab.bot.id);
        if (!updated) return tab;
        if (JSON.stringify(updated.member_perms) === JSON.stringify(tab.bot.member_perms)) return tab;
        changed = true;
        return { ...tab, bot: updated };
      });
      return changed ? next : prev;
    });
  }, [sharedBots]);

  useDEffect(() => {
    loadUser();

    const token = localStorage.getItem('vh_token');
    if (!token) return;

    let es = null;
    let closed = false;
    let refreshTimer = null;

    function openSse() {
      const t = localStorage.getItem('vh_token');
      if (!t || closed) return;
      fetch('/api/events/token', { method: 'POST', headers: { Authorization: `Bearer ${t}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (closed || !data?.token) return;
          if (es) es.close();
          es = new EventSource(`/api/events?token=${encodeURIComponent(data.token)}`);
          wireSse(es);
          clearTimeout(refreshTimer);
          refreshTimer = setTimeout(openSse, 25 * 60 * 1000);
        });
    }
    openSse();

    function wireSse(es) {
    es.addEventListener('role_update', () => {
      const t2 = localStorage.getItem('vh_token');
      fetch('/api/me', { headers: { Authorization: `Bearer ${t2}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data) return;
          setFreshUser(data);
          const p = data.perms ?? {};
          const ROUTE_PERM = {
            ranks:    () => p.viewRanks || p.editRanks,
            logs:     () => p.viewLogs,
            'sys-bots': () => p.viewSysBots,
            settings: () => p.manageSystem,
            users:    () => p.viewUsers,
            approvals: () => p.approveUsers,
          };
          setGlobalRoute(cur => {
            const check = ROUTE_PERM[cur];
            if (check && !check()) return 'bots';
            return cur;
          });
        })
        .catch(() => {});
    });
    es.addEventListener('force_logout', (e) => {
      let reason = 'Elvesztetted a szükséges Discord rangot.';
      try { const d = JSON.parse(e.data); if (d.reason) reason = d.reason; } catch {}
      setKickMsg(reason);
      setTimeout(onLogout, 4000);
    });
    es.addEventListener('force_logout_session', (e) => {
      try {
        const d    = JSON.parse(e.data);
        const tk   = localStorage.getItem('vh_token');
        if (!tk) return;
        const b64  = tk.split('.')[1];
        const pl   = JSON.parse(atob(b64.replace(/-/g,'+').replace(/_/g,'/')));
        if (pl.sid && pl.sid === d.sid) { setKickMsg('Egy másik eszközről lezárták ezt a munkamenetet.'); setTimeout(onLogout, 4000); }
      } catch {}
    });
    es.addEventListener('perm_update', () => { loadBots(); });
    es.addEventListener('notification', (e) => {
      let n; try { n = JSON.parse(e.data); } catch { return; }
      setNotifs(prev => [n, ...prev.filter(x => x.id !== n.id)].slice(0, 40));
      setNotifUnread(c => c + 1);
      if (n.type === 'approval_pending' || n.type === 'account_approved') loadUser();
    });
    es.addEventListener('bot_access_revoked', (e) => {
      let botId;
      try { botId = JSON.parse(e.data).botId; } catch {}
      if (!botId) return;
      setSharedBots(prev => prev.filter(b => b.id !== botId));
      setOpenTabs(prev => {
        const idx = prev.findIndex(t => t.bot.id === botId);
        if (idx === -1) return prev;
        const next = prev.filter((_, i) => i !== idx);
        setActiveTabIdx(cur => {
          if (cur === null || next.length === 0) { setGlobalRoute('bots'); return null; }
          if (cur === idx)  { setGlobalRoute('bots'); return null; }
          if (cur > idx)    return cur - 1;
          return cur;
        });
        return next;
      });
    });
    es.onerror = () => {  };
    }

    return () => { closed = true; clearTimeout(refreshTimer); if (es) es.close(); };
  }, []);

  function openBot(botData) {
    setOpenTabs(prev => {
      const existing = prev.findIndex(t => t.bot.id === botData.id);
      if (existing !== -1) { setActiveTabIdx(existing); return prev; }
      setActiveTabIdx(prev.length);
      return [...prev, { bot: botData, subRoute: 'bot-settings' }];
    });
  }

  function closeTab(idx) {
    setOpenTabs(prev => {
      const next = prev.filter((_, i) => i !== idx);
      setActiveTabIdx(cur => {
        if (cur === null || next.length === 0) { setGlobalRoute('bots'); return null; }
        if (cur === idx)  { setGlobalRoute('bots'); return null; }
        if (cur > idx)    return cur - 1;
        return cur;
      });
      return next;
    });
  }

  function navigate(r) {
    if (unsaved) return;
    if (BOT_ROUTES.has(r)) {
      if (activeTabIdx === null) return;
      setOpenTabs(prev => prev.map((t, i) => i === activeTabIdx ? { ...t, subRoute: r } : t));
    } else {
      setActiveTabIdx(null);
      setGlobalRoute(r);
    }
  }

  function handleTabClick(idx) {
    if (unsaved) return;
    setActiveTabIdx(idx);
  }

  const activeTab    = activeTabIdx !== null ? openTabs[activeTabIdx] : null;
  const activeBot    = activeTab?.bot    ?? null;
  const currentRoute = activeTab         ? activeTab.subRoute : globalRoute;

  useDEffect(() => {
    setBotModules({ invite: true, commands: true, automod: true, modcommands: true, serverlog: true, tickets: true });
    if (!activeBot) return;
    const t = localStorage.getItem('vh_token');
    fetch(`/api/bots/${activeBot.id}/modules`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setBotModules({ invite: data.invite !== false, commands: data.commands !== false, automod: data.automod !== false, modcommands: data.modcommands !== false, serverlog: data.serverlog !== false, tickets: data.tickets !== false }); })
      .catch(() => {});
  }, [activeBot?.id]);

  async function toggleModule(key) {
    if (!activeBot) return;
    const next = { ...botModules, [key]: !botModules[key] };
    setBotModules(next);
    const t = localStorage.getItem('vh_token');
    const r = await fetch(`/api/bots/${activeBot.id}/modules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify(next),
    }).catch(() => null);
    if (!r?.ok) { setBotModules(botModules); toast('Nem sikerült a modult kapcsolni.', 'err'); }
  }

  const u = freshUser ?? apiUser;
  const user = {
    id:               u?.id               || null,
    name:             u?.name             || 'Felhasználó',
    short:            (u?.name || 'F')[0].toUpperCase(),
    role:             u?.role_name        || 'Tag',
    roleColor:        u?.role_color       || null,
    avatar:           u?.avatar           || null,
    discord_id:       u?.discord_id       || null,
    discord_username: u?.discord_username || null,
    maxBots:          u?.max_bots         ?? 1,
    maxBotMembers:    u?.max_bot_members  ?? 3,
    pendingApprovals: u?.pending_approvals ?? 0,
    perms:            u?.perms            ?? {},
  };

  async function deleteBot(botDbId) {
    const t = localStorage.getItem('vh_token');
    await fetch(`/api/bots/${botDbId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } });
    setOpenTabs(prev => {
      const idx = prev.findIndex(tb => tb.bot.id === botDbId);
      if (idx === -1) return prev;
      const next = prev.filter((_, i) => i !== idx);
      setActiveTabIdx(cur => {
        if (cur === null || next.length === 0) { setGlobalRoute('bots'); return null; }
        if (cur === idx)  { setGlobalRoute('bots'); return null; }
        if (cur > idx)    return cur - 1;
        return cur;
      });
      return next;
    });
    loadBots();
  }

  useDEffect(() => { setUnsaved(false); }, [currentRoute, activeTabIdx]);

  const goBack = () => navigate('bots');

  if (kickMsg) return (
    <div style={{position:'fixed',inset:0,zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:20,background:'rgba(3,5,13,0.97)',backdropFilter:'blur(18px)'}}>
      <div style={{width:56,height:56,borderRadius:16,background:'rgba(255,107,129,0.12)',border:'1px solid rgba(255,107,129,0.3)',display:'grid',placeItems:'center'}}>
        {ICO.exit}
      </div>
      <div style={{textAlign:'center',maxWidth:360}}>
        <div style={{fontSize:20,fontWeight:700,fontFamily:"'Space Grotesk',sans-serif",marginBottom:10}}>Kijelentkeztetve</div>
        <div style={{fontSize:14,color:'var(--ink-faint)',lineHeight:1.6}}>{kickMsg}</div>
      </div>
      <div style={{fontSize:12,color:'var(--ink-faint)'}}>Átirányítás a bejelentkezési oldalra…</div>
    </div>
  );

  return (
    <div className="app">
      <ToastContainer />
      <Sidebar activeBot={activeBot} currentRoute={currentRoute} onNavigate={navigate} onLogout={onLogout} unsaved={unsaved} sharedBots={sharedBots} onOpenBot={openBot} userPerms={user.perms} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} pendingApprovals={user.pendingApprovals} botModules={botModules} />
      <div className="main">
        <Topbar tabs={openTabs} activeTabIdx={activeTabIdx} onTabClick={handleTabClick} onTabClose={closeTab} user={user} onMenuClick={() => setSidebarOpen(true)} notifs={notifs} notifUnread={notifUnread} onNotifMarkAll={markNotifsRead} onNotifClick={(n) => { if (n.link) navigate(n.link); }} />
        <div className="content">
          {currentRoute === 'home'         && <HomePage user={user} setRoute={navigate} />}
          {currentRoute === 'bots'         && <BotsPage bots={bots} openBot={openBot} onAddBot={loadBots} maxBots={user.maxBots} />}
          {currentRoute === 'bot-console'  && (activeBot ? <BotConsolePage  bot={activeBot} goBack={goBack} user={user} onUnsaved={setUnsaved} /> : <NoBotSelected setRoute={navigate} />)}
          {currentRoute === 'bot-settings' && (activeBot ? <BotSettingsPage bot={activeBot} goBack={goBack} onDelete={() => deleteBot(activeBot.id)} onUnsaved={setUnsaved} user={user} /> : <NoBotSelected setRoute={navigate} />)}
          {currentRoute === 'bot-invite'   && (activeBot ? <InvitePage      bot={activeBot} goBack={goBack} onUnsaved={setUnsaved} moduleOn={botModules.invite} onToggleModule={() => toggleModule('invite')} /> : <NoBotSelected setRoute={navigate} />)}
          {currentRoute === 'bot-cmd'      && (activeBot ? <CommandsPage    bot={activeBot} goBack={goBack} onUnsaved={setUnsaved} moduleOn={botModules.commands} onToggleModule={() => toggleModule('commands')} /> : <NoBotSelected setRoute={navigate} />)}
          {currentRoute === 'bot-access'   && (activeBot ? <BotAccessPage   bot={activeBot} goBack={goBack} user={user} onUnsaved={setUnsaved} /> : <NoBotSelected setRoute={navigate} />)}
          {currentRoute === 'bot-automod'  && (activeBot ? <AutoModPage     bot={activeBot} goBack={goBack} onUnsaved={setUnsaved} moduleOn={botModules.automod} onToggleModule={() => toggleModule('automod')} /> : <NoBotSelected setRoute={navigate} />)}
          {currentRoute === 'bot-modcmd'   && (activeBot ? <ModCommandsPage bot={activeBot} goBack={goBack} onUnsaved={setUnsaved} moduleOn={botModules.modcommands} onToggleModule={() => toggleModule('modcommands')} /> : <NoBotSelected setRoute={navigate} />)}
          {currentRoute === 'bot-modlog'   && (activeBot ? <ModLogPage      bot={activeBot} goBack={goBack} onUnsaved={setUnsaved} /> : <NoBotSelected setRoute={navigate} />)}
          {currentRoute === 'bot-serverlog' && (activeBot ? <ServerLogPage  bot={activeBot} goBack={goBack} onUnsaved={setUnsaved} moduleOn={botModules.serverlog} onToggleModule={() => toggleModule('serverlog')} /> : <NoBotSelected setRoute={navigate} />)}
          {currentRoute === 'bot-tickets'   && (activeBot ? <TicketsPage    bot={activeBot} goBack={goBack} onUnsaved={setUnsaved} moduleOn={botModules.tickets} onToggleModule={() => toggleModule('tickets')} /> : <NoBotSelected setRoute={navigate} />)}
          {currentRoute === 'ranks'        && <RanksPage goBack={() => navigate('home')} onUnsaved={setUnsaved} onSaved={loadUser} />}
          {currentRoute === 'logs'         && <LogsPage  goBack={() => navigate('home')} />}
          {currentRoute === 'sys-bots'     && <SysBotsPage goBack={() => navigate('home')} />}
          {currentRoute === 'users'        && <UsersPage goBack={() => navigate('home')} openBot={openBot} userPerms={user.perms} />}
          {currentRoute === 'approvals'    && <ApprovalsPage goBack={() => navigate('home')} onChange={() => { loadNotifs(); loadUser(); }} />}
          {currentRoute === 'settings'     && <SettingsPage goBack={() => navigate('home')} />}
          {currentRoute === 'account'      && <AccountPage user={user} />}
        </div>
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
