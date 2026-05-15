/* global React, Icon, Avatar, Badge */

const SHELL_TABS = [
  { id: 'home',    label: '首頁', icon: 'home' },
  { id: 'trips',   label: '行程', icon: 'map' },
  { id: 'tasks',   label: '任務', icon: 'check' },
  { id: 'shop',    label: '商店', icon: 'sim' },
  { id: 'me',      label: '我',   icon: 'user' },
];

function Shell({ screen, onScreenChange, children, isMobile }) {
  if (isMobile) return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <main style={{ flex: 1, paddingBottom: 88, overflow: 'visible' }}>{children}</main>
      <BottomNav screen={screen} onChange={onScreenChange}/>
    </div>
  );
  // Desktop
  return (
    <div style={{
      display: 'flex',
      minHeight: '100%',
      background: 'var(--bg)',
    }}>
      <DesktopRail screen={screen} onChange={onScreenChange}/>
      <main style={{ flex: 1, minWidth: 0, padding: '24px 24px 40px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
}

function BottomNav({ screen, onChange }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      padding: '8px 12px calc(8px + env(safe-area-inset-bottom))',
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(20px) saturate(140%)',
      WebkitBackdropFilter: 'blur(20px) saturate(140%)',
      borderTop: '1px solid rgba(0,0,0,0.04)',
      zIndex: 20,
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
    }}>
      {SHELL_TABS.map(t => {
        const active = screen === t.id || (t.id === 'trips' && screen.startsWith('trip:'));
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            border: 0, background: 'transparent', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '6px 10px', minWidth: 56, borderRadius: 12,
            color: active ? 'var(--accent)' : 'var(--fg-muted)',
            transition: 'color 180ms var(--ease-out-soft)',
          }}>
            <NavIcon name={t.icon} size={22} filled={active}/>
            <span style={{ fontSize: 10.5, fontWeight: active ? 600 : 500, letterSpacing: '0.01em' }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function DesktopRail({ screen, onChange }) {
  return (
    <aside style={{
      width: 220, flexShrink: 0,
      padding: '20px 14px',
      display: 'flex', flexDirection: 'column', gap: 6,
      borderRight: '1px solid var(--divider)',
      background: 'var(--surface)',
    }}>
      <div style={{ padding: '8px 8px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: '#111', color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em',
        }}>r</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>Roam eSIM</div>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>v 2.4 · 旅遊版</div>
        </div>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {SHELL_TABS.map(t => {
          const active = screen === t.id || (t.id === 'trips' && screen.startsWith('trip:'));
          return (
            <button key={t.id} onClick={() => onChange(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 10,
              background: active ? 'rgba(15, 184, 180, 0.10)' : 'transparent',
              border: 0, cursor: 'pointer', width: '100%', textAlign: 'left',
              fontFamily: 'var(--font-sans)',
              transition: 'background 180ms var(--ease-out-soft)',
            }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
              <NavIcon name={t.icon} size={18} filled={active} color={active ? 'var(--accent)' : 'var(--fg-secondary)'}/>
              <span style={{ fontSize: 13, color: active ? 'var(--accent)' : 'var(--fg)', fontWeight: active ? 600 : 500 }}>{t.label}</span>
            </button>
          );
        })}
      </nav>
      <div style={{ marginTop: 'auto', padding: '12px 10px', display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid var(--divider)' }}>
        <Avatar initials="CL" size={30} color="#0FB8B4"/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>林家如</div>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Roam+ 會員</div>
        </div>
      </div>
    </aside>
  );
}

/* ============================================================
   Nav icons — slightly bolder than admin set, with filled state
   ============================================================ */
function NavIcon({ name, size = 22, filled = false, color = 'currentColor' }) {
  const stroke = filled ? 1.8 : 1.5;
  const fill = filled ? 'rgba(15,184,180,0.12)' : 'none';
  const paths = {
    home: <><path d="M3 9.5 12 3l9 6.5V20a1.5 1.5 0 0 1-1.5 1.5H15v-7H9v7H4.5A1.5 1.5 0 0 1 3 20z" fill={fill}/></>,
    map: <><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6" fill={fill}/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></>,
    check: <><circle cx="12" cy="12" r="9" fill={fill}/><path d="m8.5 12.2 2.5 2.6 4.5-5.2"/></>,
    sim: <><path d="M16 4H9L5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7l-3-3z" fill={fill}/><line x1="9" y1="13" x2="15" y2="13"/><line x1="12" y1="10" x2="12" y2="16"/></>,
    user: <><circle cx="12" cy="8.5" r="3.5" fill={fill}/><path d="M5 20c1-3.5 4-5.5 7-5.5s6 2 7 5.5" fill={fill}/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || null}
    </svg>
  );
}

/* ============================================================
   PageHeader — used at top of every screen
   ============================================================ */
function PageHeader({ title, subtitle, right, sticky = true }) {
  return (
    <header style={{
      position: sticky ? 'sticky' : 'static',
      top: 0, zIndex: 10,
      background: 'rgba(247,247,245,0.85)',
      backdropFilter: 'blur(20px) saturate(140%)',
      WebkitBackdropFilter: 'blur(20px) saturate(140%)',
      padding: '14px 20px 12px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
        {subtitle && <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </header>
  );
}

Object.assign(window, { Shell, BottomNav, DesktopRail, NavIcon, PageHeader, SHELL_TABS });
