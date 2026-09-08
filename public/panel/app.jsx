const { useState: useAState, useEffect: useAEffect } = React;

function App() {
  const [user, setUser] = useAState(null);
  const [loading, setLoading] = useAState(true);

  useAEffect(() => {
    const token = localStorage.getItem('vh_token');
    if (!token) { setLoading(false); return; }

    fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { setUser(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const logout = () => {
    localStorage.removeItem('vh_token');
    window.location.replace('/panel/auth');
  };

  if (loading) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',gap:32}}>
      <div style={{width:220,display:'flex',flexDirection:'column',gap:14}}>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:4}}>
          <div className="sk" style={{width:48,height:48,borderRadius:14,flexShrink:0}} />
          <div style={{flex:1,display:'flex',flexDirection:'column',gap:8}}>
            <div className="sk" style={{height:14,borderRadius:6}} />
            <div className="sk" style={{width:'60%',height:11,borderRadius:6}} />
          </div>
        </div>
        <div className="sk" style={{height:13,borderRadius:6}} />
        <div className="sk" style={{width:'80%',height:13,borderRadius:6}} />
        <div className="sk" style={{width:'50%',height:13,borderRadius:6}} />
      </div>
    </div>
  );

  if (!user) {
    window.location.replace('/panel/auth');
    return null;
  }

  return (
    <>
      <div className="galaxy"></div>
      <div className="nebula a"></div>
      <div className="nebula b"></div>
      <div className="nebula c"></div>
      <Dashboard user={user} onLogout={logout} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
