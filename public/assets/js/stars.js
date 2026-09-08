(function () {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes starPulse {
      0%   { opacity: var(--o1); transform: translate(0, 0); }
      50%  { opacity: var(--o2); }
      100% { opacity: var(--o1); transform: translate(var(--dx), var(--dy)); }
    }
    .star {
      position: fixed;
      border-radius: 50%;
      background: #fff;
      pointer-events: none;
      z-index: -1;
    }
  `;
  document.head.appendChild(style);

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden';

  for (let i = 0; i < 90; i++) {
    const el = document.createElement('div');
    el.className = 'star';

    const size   = Math.random() < 0.25 ? 2.2 : Math.random() < 0.5 ? 1.5 : 1;
    const x      = Math.random() * 100;
    const y      = Math.random() * 100;
    const dur    = 3 + Math.random() * 7;
    const delay  = -(Math.random() * dur);
    const dx     = (Math.random() - 0.5) * 28;
    const dy     = (Math.random() - 0.5) * 20;
    const o1     = 0.15 + Math.random() * 0.35;
    const o2     = o1 + 0.35 + Math.random() * 0.35;

    el.style.cssText = `
      width:${size}px; height:${size}px;
      left:${x}%; top:${y}%;
      --dx:${dx}px; --dy:${dy}px;
      --o1:${o1}; --o2:${Math.min(o2, 1)};
      animation: starPulse ${dur}s ${delay}s ease-in-out infinite alternate;
    `;
    wrap.appendChild(el);
  }

  document.body.appendChild(wrap);
})();
