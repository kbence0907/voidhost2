const { useState: useDState, useEffect: useDEffect, useMemo: useDMemo } = React;

const Icon = ({ d, fill, size = 16 }) => (
  <svg className="i" width={size} height={size} viewBox="0 0 24 24" fill={fill || 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{flex: '0 0 ' + size + 'px'}}>
    {d}
  </svg>
);
const ICO = {
  home: <Icon d={<><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></>} />,
  bots: <Icon d={<><rect x="4" y="7" width="16" height="13" rx="3"/><path d="M9 12v2M15 12v2M12 3v4M9 7h6"/></>} />,
  settings: <Icon d={<><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 01-.3 2l2 1.5-2 3.5-2.4-1a7 7 0 01-3.5 2L12.5 22h-1l-.3-2a7 7 0 01-3.5-2l-2.4 1-2-3.5L5.3 14a7 7 0 010-4l-2-1.5 2-3.5 2.4 1a7 7 0 013.5-2L11.5 2h1l.3 2a7 7 0 013.5 2l2.4-1 2 3.5L18.7 10a7 7 0 01.3 2z"/></>} />,
  invite: <Icon d={<><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><circle cx="9" cy="8" r="4"/><path d="M17 11h4M19 9v4"/></>} />,
  cmd: <Icon d={<><path d="M4 17l5-5-5-5M12 19h8"/></>} />,
  rank: <Icon d={<><path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6z"/></>} />,
  log: <Icon d={<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></>} />,
  rocket: <Icon d={<><path d="M14 3c4 0 7 3 7 7-2 0-3.5 1-4.5 2.5l-4-4C13.7 6.7 14 5 14 3z"/><path d="M5.5 12.5c1.5-1 3.5-1.5 5-1.5l4 4c0 1.5-.5 3.5-1.5 5l-3-3-1.5 1.5L7 17l-2 2v-3l1.5-1.5L5 13l.5-.5z"/></>} />,
  mail: <Icon d={<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></>} />,
  exit: <Icon d={<><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></>} />,
  bell: <Icon d={<><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></>} />,
  search: <Icon d={<><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></>} />,
  back: <Icon d={<><path d="M15 18l-6-6 6-6"/></>} />,
  plus: <Icon d={<><path d="M12 5v14M5 12h14"/></>} />,
  edit: <Icon d={<><path d="M11 4H4v16h16v-7M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>} />,
  trash: <Icon d={<><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></>} />,
  drag: <Icon d={<><circle cx="9" cy="6" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="18" r="1" fill="currentColor"/><circle cx="15" cy="6" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="18" r="1" fill="currentColor"/></>} />,
  warn: <Icon d={<><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/></>} />,
  check: <Icon d={<><path d="M20 6L9 17l-5-5"/></>} />,
  user: <Icon d={<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>} />,
  shield: <Icon d={<><path d="M12 3l8 4v6c0 4-3.5 7-8 8-4.5-1-8-4-8-8V7l8-4z"/></>} />,
  key:    <Icon d={<><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6M15.5 7.5l3 3"/></>} />,
  monitor:<Icon d={<><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>} />,
  globe:  <Icon d={<><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 010 20M2 12h20"/></>} />,
  ticket: <Icon d={<><path d="M3 9a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 000-4V9z"/><path d="M13 7v2M13 15v2"/></>} />,
};

let _toast = null;
function toast(msg, type = 'ok') { _toast?.(msg, type); }

function ToastContainer() {
  const [list, setList] = useDState([]);
  useDEffect(() => {
    _toast = (msg, type) => {
      const id = Date.now() + Math.random();
      setList(p => [...p, { id, msg, type }]);
      setTimeout(() => setList(p => p.filter(t => t.id !== id)), 3800);
    };
    return () => { _toast = null; };
  }, []);
  if (!list.length) return null;
  return (
    <div className="toast-wrap">
      {list.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type === 'ok'  && ICO.check}
          {t.type === 'err' && ICO.warn}
          {t.msg}
        </div>
      ))}
    </div>
  );
}

const Sk = ({ w = '100%', h = 16, r = 6, style = {} }) => (
  <div className="sk" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
);

function SkeletonUserList() {
  return (
    <div className="user-list">
      <div className="user-list-head">
        <span>Felhasználó</span><span>Discord</span><span>Regisztráció</span><span>Állapot</span>
      </div>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="user-row" style={{cursor:'default'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <Sk w={36} h={36} r={18} />
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              <Sk w={120} h={13} />
              <Sk w={160} h={11} />
            </div>
          </div>
          <Sk w={90} h={13} />
          <Sk w={80} h={13} />
          <Sk w={60} h={20} r={10} />
        </div>
      ))}
    </div>
  );
}

function SkeletonDetail() {
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20,maxWidth:1060}}>
      <div className="cfg-card" style={{gridRow:'span 2',display:'flex',flexDirection:'column',gap:14}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
          <Sk w={32} h={32} r={9} /><Sk w={100} h={16} />
        </div>
        <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:8}}>
          <Sk w={56} h={56} r={28} /><div style={{flex:1,display:'flex',flexDirection:'column',gap:6}}><Sk h={14}/><Sk h={11} w="60%"/></div>
        </div>
        <Sk h={13} /><Sk h={13} /><Sk h={13} /><Sk h={13} />
      </div>
      <div className="cfg-card" style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
          <Sk w={32} h={32} r={9} /><Sk w={100} h={16} />
        </div>
        <div style={{display:'flex',gap:8}}><Sk h={56} /><Sk h={56} /><Sk h={56} /></div>
      </div>
      <div className="cfg-card" style={{display:'flex',flexDirection:'column',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
          <Sk w={32} h={32} r={9} /><Sk w={100} h={16} />
        </div>
        <Sk h={38} r={10} /><Sk h={38} r={10} />
      </div>
      <div className="cfg-card" style={{gridColumn:'span 2',display:'flex',flexDirection:'column',gap:14}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
          <Sk w={32} h={32} r={9} /><Sk w={130} h={16} />
        </div>
        <Sk h={40} r={10} /><Sk h={40} r={10} />
      </div>
    </div>
  );
}

function SkeletonCards({ count = 4 }) {
  return (
    <div className="config-grid" style={{maxWidth:860}}>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="cfg-card" style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:4}}>
            <Sk w={32} h={32} r={9} /><Sk w={100} h={16} />
          </div>
          <Sk h={13} /><Sk h={13} w="75%" /><Sk h={13} w="50%" />
        </div>
      ))}
    </div>
  );
}

function NoBotSelected({ setRoute }) {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'60%',gap:16,textAlign:'center'}}>
      <div style={{width:56,height:56,borderRadius:16,background:'var(--glass)',border:'1px solid var(--line)',display:'grid',placeItems:'center'}}>
        {ICO.bots}
      </div>
      <div>
        <div style={{fontSize:17,fontWeight:600,fontFamily:"'Space Grotesk',sans-serif"}}>Nincs kiválasztott bot</div>
        <div style={{fontSize:13,color:'var(--ink-faint)',marginTop:6}}>Válassz egy botot a listából, vagy adj hozzá újat.</div>
      </div>
      <button className="btn btn-primary" onClick={() => setRoute('bots')}>Saját botok →</button>
    </div>
  );
}

const MOD_ROUTES = ['bot-automod', 'bot-modcmd', 'bot-modlog'];
