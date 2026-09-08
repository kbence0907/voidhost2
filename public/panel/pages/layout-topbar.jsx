function NotificationBell({ notifs = [], unread = 0, onMarkAll, onClickItem }) {
  const [open, setOpen] = useDState(false);
  const ref = React.useRef(null);

  useDEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) onMarkAll && onMarkAll();
  }

  return (
    <div className="notif-wrap" ref={ref}>
      <button className={`tb-iconbtn${open ? ' active' : ''}`} title="Értesítések" onClick={toggle}>
        {ICO.bell}
        {unread > 0 && <span className="badge badge-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-head">
            <span>Értesítések</span>
            {notifs.length > 0 && <button onClick={onMarkAll}>Mind olvasott</button>}
          </div>
          <div className="notif-list">
            {notifs.length === 0 && <div className="notif-empty">Nincs értesítés.</div>}
            {notifs.map(n => (
              <div
                key={n.id}
                className={`notif-item${n.is_read ? '' : ' unread'}${n.link ? ' clickable' : ''}`}
                onClick={() => { if (n.link && onClickItem) { onClickItem(n); setOpen(false); } }}
              >
                <div className="notif-item-title">{n.title}</div>
                {n.body && <div className="notif-item-body">{n.body}</div>}
                <div className="notif-item-time">{fmtRelative(n.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Topbar({ tabs, activeTabIdx, onTabClick, onTabClose, user, onMenuClick, notifs, notifUnread, onNotifMarkAll, onNotifClick }) {
  return (
    <div className="topbar">
      <button className="hamburger" onClick={onMenuClick} aria-label="Menü">
        <span/><span/><span/>
      </button>
      <div className="tb-left">
        <div className="tb-tabs">
          {tabs.map((t, i) => {
            const name  = t.bot.bot_name || '?';
            const short = name[0].toUpperCase();
            const active = i === activeTabIdx;
            return (
              <div key={t.bot.id} className={`tb-tab ${active ? 'active' : ''}`} onClick={() => onTabClick(i)}>
                {t.bot.bot_avatar
                  ? <img src={t.bot.bot_avatar} alt={name} style={{width:20,height:20,borderRadius:5,objectFit:'cover',flexShrink:0}} />
                  : <span className="tb-tab-av">{short}</span>
                }
                <span className="tb-tab-name">{name}</span>
                <button className="tb-tab-close" onClick={e => { e.stopPropagation(); onTabClose(i); }}>✕</button>
              </div>
            );
          })}
          {tabs.length === 0 && (
            <span style={{fontSize:12,color:'var(--ink-faint)',padding:'0 8px'}}>Nincs megnyitott bot</span>
          )}
        </div>
      </div>
      <div className="tb-right">
        <NotificationBell notifs={notifs} unread={notifUnread} onMarkAll={onNotifMarkAll} onClickItem={onNotifClick} />
        <div className="tb-user">
          {user.avatar
            ? <img src={user.avatar} alt={user.name} style={{width:34,height:34,borderRadius:'50%',objectFit:'cover',flexShrink:0}} />
            : <span className="av">{user.short}</span>
          }
          <div className="meta">
            <b>{user.name}</b>
            <div className="role" style={user.roleColor ? {color: user.roleColor} : {}}>
              <span className="role-dot" style={user.roleColor ? {background: user.roleColor, boxShadow: `0 0 6px ${user.roleColor}`} : {}}></span>
              {user.role}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function useCountUp(target, duration = 900) {
  const [display, setDisplay] = useDState(0);
  const prevRef = React.useRef(0);
  const rafRef  = React.useRef(null);

  useDEffect(() => {
    if (target === null || target === undefined) return;
    const from  = prevRef.current;
    const to    = target;
    const start = performance.now();

    function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const value = Math.round(from + (to - from) * ease(progress));
      setDisplay(value);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = to;
      }
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target]);

  return display;
}
