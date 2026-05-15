/* global React */
const { useState, useEffect, useRef, useMemo } = React;

/* ============================================================
   eSIM Admin — primitive bits
   Built on top of Lume tokens (colors_and_type.css).
   ============================================================ */

function Icon({ name, size = 18, color = 'currentColor', strokeWidth = 1.5, style }) {
  const paths = {
    /* nav */
    dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
    receipt: <><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 2V2"/><path d="M8 7h8M8 12h8M8 17h5"/></>,
    package: <><path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>,
    store: <><path d="M3 9l1-5h16l1 5"/><path d="M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    building: <><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01"/></>,
    signal: <><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,

    /* common */
    search: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    minus: <><path d="M5 12h14"/></>,
    arrowUp: <><path d="M12 19V5M5 12l7-7 7 7"/></>,
    arrowDown: <><path d="M12 5v14M5 12l7 7 7-7"/></>,
    arrowRight: <><path d="M5 12h14M12 5l7 7-7 7"/></>,
    arrowUpRight: <><path d="M7 17 17 7M7 7h10v10"/></>,
    arrowDownRight: <><path d="M7 7l10 10M17 7v10H7"/></>,
    chevronDown: <><path d="m6 9 6 6 6-6"/></>,
    chevronRight: <><path d="m9 18 6-6-6-6"/></>,
    chevronUpDown: <><path d="m7 15 5 5 5-5M7 9l5-5 5 5"/></>,
    check: <><path d="M20 6 9 17l-5-5"/></>,
    checkCircle: <><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></>,
    x: <><path d="M18 6 6 18M6 6l12 12"/></>,
    ellipsis: <><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></>,
    filter: <><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></>,
    sortDesc: <><path d="M3 6h18M6 12h12M10 18h4"/></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    copy: <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
    trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    help: <><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></>,
    globe: <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>,
    map: <><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></>,
    trendingUp: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
    trendingDown: <><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></>,
    activity: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    layers: <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
    alertCircle: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
    info: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>,
    refresh: <><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    sparkle: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
    wifi: <><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></>,
    sim: <><path d="M19 5h-7L5 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"/><line x1="10" y1="12" x2="14" y2="12"/><line x1="12" y1="10" x2="12" y2="14"/></>,
    flame: <><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></>,
    pause: <><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>,
    play: <><polygon points="5 3 19 12 5 21 5 3"/></>,
    external: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>,
    grip: <><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></>,
    columns: <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></>,
    circle: <><circle cx="12" cy="12" r="10"/></>,
    tag: <><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>,
    award: <><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></>,
    plug: <><path d="M9 2v6M15 2v6M12 22v-4"/><path d="M7 8h10v4a5 5 0 0 1-10 0z"/></>,
    star: <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></>,
    home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" style={style}>
      {paths[name] || null}
    </svg>
  );
}

function Avatar({ initials, color = '#0FB8B4', size = 24, ring }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 999,
      background: color, color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.42), fontWeight: 600,
      flexShrink: 0,
      boxShadow: ring ? '0 0 0 2px #fff' : 'none',
    }}>{initials}</div>
  );
}

function Badge({ children, variant = 'neutral', dot, style }) {
  const variants = {
    neutral: { background: 'var(--surface-sunken)', color: 'var(--fg-secondary)' },
    accent:  { background: 'var(--accent-soft)', color: 'var(--accent)' },
    success: { background: 'var(--success-soft)', color: 'var(--success)' },
    warning: { background: 'var(--warning-soft)', color: 'var(--warning)' },
    error:   { background: 'var(--error-soft)', color: 'var(--error)' },
    info:    { background: 'var(--info-soft)', color: 'var(--info)' },
    cta:     { background: '#111', color: '#fff' },
    outline: { background: 'transparent', color: 'var(--fg-secondary)', boxShadow: 'inset 0 0 0 1px var(--divider-strong)' },
  };
  const dotColor = {
    neutral: 'var(--fg-muted)', accent: 'var(--accent)', success: 'var(--success)',
    warning: 'var(--warning)', error: 'var(--error)', info: 'var(--info)', cta: '#fff', outline: 'var(--fg-muted)',
  };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 9px', borderRadius: 999,
      fontSize: 12, fontWeight: 500, letterSpacing: '-0.005em',
      whiteSpace: 'nowrap',
      ...variants[variant], ...style,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: dotColor[variant] }}/>}
      {children}
    </span>
  );
}

function Button({ variant = 'primary', size = 'md', children, onClick, style, type = 'button', icon }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    fontFamily: 'var(--font-sans)', fontWeight: 500,
    border: 0, cursor: 'pointer', userSelect: 'none',
    transition: 'transform 180ms var(--ease-out-soft), box-shadow 180ms var(--ease-out-soft), background 180ms var(--ease-out-soft)',
    whiteSpace: 'nowrap',
  };
  const sizes = {
    sm: { padding: '6px 12px', fontSize: 13, borderRadius: 10 },
    md: { padding: '8px 14px', fontSize: 13, borderRadius: 12 },
    lg: { padding: '12px 20px', fontSize: 14, borderRadius: 14 },
  };
  const variants = {
    primary:   { background: '#111', color: '#fff', boxShadow: 'var(--shadow-sm)' },
    secondary: { background: 'var(--surface)', color: 'var(--fg)', boxShadow: 'inset 0 0 0 1px var(--divider), var(--shadow-xs)' },
    ghost:     { background: 'transparent', color: 'var(--fg-secondary)' },
    accent:    { background: 'var(--accent)', color: '#fff', boxShadow: 'var(--shadow-sm)' },
    danger:    { background: 'var(--error-soft)', color: 'var(--error)' },
  };
  return (
    <button type={type} onClick={onClick}
      style={{ ...base, ...sizes[size], ...variants[variant], ...style }}
      onMouseEnter={e => { if (variant === 'ghost') e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
      onMouseLeave={e => { if (variant === 'ghost') e.currentTarget.style.background = 'transparent'; }}>
      {icon && <Icon name={icon} size={14}/>}
      {children}
    </button>
  );
}

function IconButton({ name, size = 30, iconSize = 15, onClick, style, title, active }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: size, height: size, borderRadius: 8,
      background: active ? 'rgba(0,0,0,0.05)' : 'transparent',
      border: 0, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      color: active ? 'var(--fg)' : 'var(--fg-secondary)',
      transition: 'background 180ms var(--ease-out-soft), color 180ms var(--ease-out-soft)',
      ...style,
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = 'var(--fg)'; }}
    onMouseLeave={e => { e.currentTarget.style.background = active ? 'rgba(0,0,0,0.05)' : 'transparent'; e.currentTarget.style.color = active ? 'var(--fg)' : 'var(--fg-secondary)'; }}>
      <Icon name={name} size={iconSize}/>
    </button>
  );
}

/* ============================================================
   Charts — hand-rolled SVG, kept minimal and on-brand.
   ============================================================ */

function Sparkline({ data, color = 'var(--accent)', width = 80, height = 28, area = true }) {
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y];
  });
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  const areaPath = path + ` L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {area && <path d={areaPath} fill={color} opacity="0.10"/>}
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function AreaChart({ series, labels, width, height, colors = ['var(--accent)', '#111'], yTicks = 4, formatY = v => v }) {
  const containerRef = useRef(null);
  const [w, setW] = useState(width || 600);
  useEffect(() => {
    if (width) return;
    const el = containerRef.current; if (!el) return;
    const ro = new ResizeObserver(es => { for (const e of es) setW(e.contentRect.width); });
    ro.observe(el); return () => ro.disconnect();
  }, [width]);

  const padL = 44, padR = 12, padT = 12, padB = 28;
  const h = height || 260;
  const allVals = series.flatMap(s => s.data);
  const yMaxRaw = Math.max(...allVals);
  // round up to nice number
  const niceMax = (() => {
    if (yMaxRaw <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(yMaxRaw)));
    const norm = yMaxRaw / mag;
    let nice;
    if (norm <= 1) nice = 1;
    else if (norm <= 2) nice = 2;
    else if (norm <= 5) nice = 5;
    else nice = 10;
    return nice * mag;
  })();
  const innerW = Math.max(40, w - padL - padR);
  const innerH = h - padT - padB;

  const xs = labels.map((_, i) => padL + (i / (labels.length - 1 || 1)) * innerW);
  const yFor = v => padT + innerH - (v / niceMax) * innerH;

  const gridYs = Array.from({ length: yTicks + 1 }).map((_, i) => (niceMax * i) / yTicks);

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {/* grid */}
        {gridYs.map((g, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={yFor(g)} y2={yFor(g)} stroke="rgba(0,0,0,0.05)" strokeWidth="1"/>
            <text x={padL - 8} y={yFor(g) + 4} textAnchor="end" fontSize="11" fontFamily="var(--font-mono)" fill="var(--fg-muted)">{formatY(g)}</text>
          </g>
        ))}
        {/* x labels */}
        {labels.map((l, i) => (
          <text key={i} x={xs[i]} y={h - 8} textAnchor="middle" fontSize="11" fontFamily="var(--font-sans)" fill="var(--fg-muted)">{l}</text>
        ))}
        {/* series */}
        {series.map((s, si) => {
          const color = colors[si % colors.length];
          const pts = s.data.map((v, i) => `${xs[i]},${yFor(v).toFixed(2)}`).join(' ');
          const areaPts = `${padL},${padT + innerH} ${pts} ${padL + innerW},${padT + innerH}`;
          return (
            <g key={si}>
              {s.area !== false && <polygon points={areaPts} fill={color} opacity="0.08"/>}
              <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
              {s.data.map((v, i) => (
                <circle key={i} cx={xs[i]} cy={yFor(v)} r="2.5" fill="#fff" stroke={color} strokeWidth="1.5"/>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function BarRow({ label, value, max, color = 'var(--accent)', suffix, sub }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', minWidth: 0 }}>
      <div style={{ width: 132, fontSize: 13, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 8, background: 'rgba(0,0,0,0.04)', borderRadius: 999, overflow: 'hidden', minWidth: 0 }}>
        <div style={{ width: pct + '%', height: '100%', background: color, borderRadius: 999, transition: 'width 420ms var(--ease-out-soft)' }}/>
      </div>
      <div style={{ width: 96, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg)', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}{suffix}
        {sub && <div style={{ fontSize: 11, color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>{sub}</div>}
      </div>
    </div>
  );
}

function Donut({ segments, size = 140, thickness = 16, centerLabel, centerValue }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth={thickness}/>
        {segments.map((s, i) => {
          const frac = s.value / total;
          const dash = frac * c;
          const el = (
            <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
              stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"/>
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {centerLabel && <div style={{ fontSize: 11, color: 'var(--fg-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{centerLabel}</div>}
        {centerValue && <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.02em' }}>{centerValue}</div>}
      </div>
    </div>
  );
}

/* ============================================================
   Cards
   ============================================================ */

function Card({ children, style, padding = 24, hoverable }) {
  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 20,
      boxShadow: 'var(--shadow-sm)',
      padding,
      transition: 'transform 260ms var(--ease-out-soft), box-shadow 260ms var(--ease-out-soft)',
      ...style,
    }}
    onMouseEnter={e => { if (hoverable) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}}
    onMouseLeave={e => { if (hoverable) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}}>
      {children}
    </div>
  );
}

function StatCard({ label, value, delta, deltaPositive = true, sub, spark, sparkColor = 'var(--accent)', accent }) {
  return (
    <Card padding={20} style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 12, color: 'var(--fg-muted)', letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        {accent && <span style={{ width: 6, height: 6, borderRadius: 999, background: accent, flexShrink: 0 }}/>}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
        <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--fg)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{value}</div>
        {spark && <div style={{ flexShrink: 0 }}><Sparkline data={spark} color={sparkColor} width={80} height={28}/></div>}
      </div>
      {(delta != null || sub) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, whiteSpace: 'nowrap', minWidth: 0 }}>
          {delta != null && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0,
              color: deltaPositive ? 'var(--success)' : 'var(--error)',
              fontWeight: 500, fontFamily: 'var(--font-mono)',
            }}>
              <Icon name={deltaPositive ? 'arrowUp' : 'arrowDown'} size={11}/>
              {delta}
            </span>
          )}
          {sub && <span style={{ color: 'var(--fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>}
        </div>
      )}
    </Card>
  );
}

/* ============================================================
   Pieces of UI shared across tables
   ============================================================ */

function Flag({ code, size = 18 }) {
  // tiny rounded-square color tile with country code; placeholder, not real flags
  const palette = {
    JP: ['#EF476F', '#fff'], TW: ['#118AB2', '#fff'], TH: ['#06D6A0', '#fff'],
    US: ['#5B7CFA', '#fff'], KR: ['#1B1B1B', '#fff'], SG: ['#D9994E', '#fff'],
    MY: ['#FFD166', '#1B1B1B'], VN: ['#E5484D', '#FFD166'], ID: ['#E5484D', '#fff'],
    PH: ['#118AB2', '#FFD166'], HK: ['#E5484D', '#fff'], CN: ['#E5484D', '#FFD166'],
    GB: ['#1B1B1B', '#fff'], FR: ['#5B7CFA', '#fff'], DE: ['#1B1B1B', '#FFD166'],
    EU: ['#5B7CFA', '#FFD166'], AU: ['#118AB2', '#fff'], NZ: ['#118AB2', '#fff'],
    IN: ['#D9994E', '#118AB2'], AE: ['#06D6A0', '#fff'],
  };
  const [bg, fg] = palette[code] || ['#999', '#fff'];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size + 6, height: size, borderRadius: 4, background: bg, color: fg,
      fontSize: Math.round(size * 0.55), fontFamily: 'var(--font-mono)', fontWeight: 600,
      flexShrink: 0,
    }}>{code}</span>
  );
}

function Toggle({ on, onChange, size = 'md' }) {
  const w = size === 'sm' ? 28 : 34;
  const h = size === 'sm' ? 16 : 20;
  const k = h - 4;
  return (
    <button onClick={() => onChange(!on)} style={{
      width: w, height: h, padding: 2, borderRadius: 999, border: 0,
      background: on ? 'var(--accent)' : 'rgba(0,0,0,0.12)',
      position: 'relative', cursor: 'pointer',
      transition: 'background 180ms var(--ease-out-soft)',
    }}>
      <span style={{
        position: 'absolute', top: 2, left: on ? w - k - 2 : 2,
        width: k, height: k, borderRadius: 999, background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'left 180ms var(--ease-out-soft)',
      }}/>
    </button>
  );
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'inline-flex', padding: 3, background: 'rgba(0,0,0,0.04)', borderRadius: 10, gap: 2 }}>
      {tabs.map(t => {
        const a = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            padding: '5px 12px', borderRadius: 8,
            background: a ? 'var(--surface)' : 'transparent',
            color: a ? 'var(--fg)' : 'var(--fg-secondary)',
            border: 0, cursor: 'pointer',
            fontSize: 12, fontWeight: 500,
            fontFamily: 'var(--font-sans)',
            boxShadow: a ? 'var(--shadow-xs)' : 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            transition: 'all 180ms var(--ease-out-soft)',
          }}>
            {t.icon && <Icon name={t.icon} size={13}/>}
            {t.label}
            {t.count != null && (
              <span style={{
                marginLeft: 2, padding: '0 5px', minWidth: 16, height: 15,
                background: a ? 'rgba(0,0,0,0.06)' : 'transparent',
                color: a ? 'var(--fg-secondary)' : 'var(--fg-muted)',
                borderRadius: 999, fontSize: 10, fontFamily: 'var(--font-mono)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function SectionHead({ title, subtitle, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 6 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--fg)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

function Empty({ icon = 'inbox', title, sub }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-muted)' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 999, background: 'rgba(0,0,0,0.04)', marginBottom: 10 }}>
        <Icon name={icon} size={20}/>
      </div>
      <div style={{ fontSize: 14, color: 'var(--fg)', fontWeight: 500 }}>{title}</div>
      {sub && <div style={{ fontSize: 13, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

Object.assign(window, {
  Icon, Avatar, Badge, Button, IconButton,
  Sparkline, AreaChart, BarRow, Donut,
  Card, StatCard,
  Flag, Toggle, Tabs, SectionHead, Empty,
});
