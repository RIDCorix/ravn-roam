/* global React, Icon, Avatar, Badge, Button, IconButton, Card, Flag, USER, ACTIVE_ESIM, TRIPS, TODAY, PageHeader */

function Home({ navigate, isMobile }) {
  const activeTrip = TRIPS.find(t => t.status === 'active');
  const upcoming = TRIPS.filter(t => t.status === 'upcoming').sort((a, b) => a.start.localeCompare(b.start))[0];

  return (
    <div>
      <PageHeader
        title={`午安，家如`}
        subtitle="目前在京都，4 天後返國"
        right={<IconButton name="bell" title="通知"/>}
      />

      <div style={{ padding: '4px 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Active eSIM hero */}
        <ActiveESIMCard sim={ACTIVE_ESIM} onTopup={() => navigate('shop')}/>

        {/* Quick actions */}
        <QuickActions onAction={navigate}/>

        {/* Lumi nudge */}
        <LumiNudge onOpen={() => navigate('trip:trip_eu')}/>

        {/* Upcoming trip */}
        {upcoming && (
          <UpcomingTripCard trip={upcoming} onOpen={() => navigate('trip:' + upcoming.id)}/>
        )}

        {/* Active trip checklist preview */}
        {activeTrip && (
          <ActiveTripStrip trip={activeTrip} onOpen={() => navigate('trip:' + activeTrip.id)}/>
        )}
      </div>
    </div>
  );
}

function ActiveESIMCard({ sim, onTopup }) {
  const pct = (sim.used / sim.total) * 100;
  const dayPct = ((sim.daysTotal - sim.daysLeft) / sim.daysTotal) * 100;
  return (
    <Card padding={0} style={{
      overflow: 'hidden',
      background: 'linear-gradient(160deg, #0FB8B4 0%, #0a7d7a 100%)',
      color: '#fff',
      borderRadius: 24,
      boxShadow: 'var(--shadow-md), 0 12px 40px rgba(15, 184, 180, 0.24)',
    }}>
      <div style={{ padding: 20, position: 'relative' }}>
        {/* Decorative orbits */}
        <svg viewBox="0 0 240 240" style={{ position: 'absolute', right: -40, top: -40, width: 240, height: 240, opacity: 0.18, pointerEvents: 'none' }}>
          <circle cx="120" cy="120" r="100" fill="none" stroke="#fff" strokeWidth="1"/>
          <circle cx="120" cy="120" r="70"  fill="none" stroke="#fff" strokeWidth="1"/>
          <circle cx="120" cy="120" r="40"  fill="none" stroke="#fff" strokeWidth="1"/>
        </svg>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{
            width: 8, height: 8, borderRadius: 999, background: '#fff',
            boxShadow: '0 0 0 4px rgba(255,255,255,0.25)',
            animation: 'pulse 2s var(--ease-out-soft) infinite',
          }}/>
          <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>使用中 · {sim.network}</span>
          <span style={{ flex: 1 }}/>
          <SignalBars n={sim.signal} speed={sim.speed}/>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, opacity: 0.8, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{sim.countryName} · {sim.plan}</div>
            <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1, marginTop: 6, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {(sim.total - sim.used).toFixed(2)}
              <span style={{ fontSize: 16, fontWeight: 400, opacity: 0.7, marginLeft: 4 }}>GB 剩餘</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{sim.daysLeft}</div>
            <div style={{ fontSize: 11, opacity: 0.8, whiteSpace: 'nowrap' }}>天剩餘</div>
          </div>
        </div>

        {/* Usage bar */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.18)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: pct + '%', background: '#fff', borderRadius: 999 }}/>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 6, opacity: 0.85, fontFamily: 'var(--font-mono)' }}>
            <span>已用 {sim.used.toFixed(2)} GB</span>
            <span>剩 {(sim.total - sim.used).toFixed(2)} GB</span>
          </div>
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <ESIMAction icon="plus"  label="加購流量" onClick={onTopup}/>
          <ESIMAction icon="refresh" label="切換熱點" subtle/>
          <ESIMAction icon="info"  label="疑難排解"  subtle/>
        </div>
      </div>
    </Card>
  );
}

function ESIMAction({ icon, label, onClick, subtle }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, minWidth: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      padding: '10px 8px', borderRadius: 12,
      background: subtle ? 'rgba(255,255,255,0.14)' : '#fff',
      color: subtle ? '#fff' : 'var(--accent)',
      border: 0, cursor: 'pointer',
      fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)',
      whiteSpace: 'nowrap',
    }}>
      <Icon name={icon} size={13}/>
      {label}
    </button>
  );
}

function SignalBars({ n = 4, speed }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2 }}>
      {[1,2,3,4].map(i => (
        <span key={i} style={{
          width: 3, height: 4 + i * 2, borderRadius: 1,
          background: i <= n ? '#fff' : 'rgba(255,255,255,0.32)',
        }}/>
      ))}
      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', marginLeft: 4, fontWeight: 600 }}>{speed}</span>
    </span>
  );
}

function QuickActions({ onAction }) {
  const actions = [
    { id: 'shop',  icon: 'sim',     label: '買 eSIM' },
    { id: 'trips', icon: 'plus',    label: '新行程' },
    { id: 'lumi',  icon: 'sparkle', label: '問 Lumi', accent: true },
    { id: 'tasks', icon: 'check',   label: '我的任務' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
      {actions.map(a => (
        <button key={a.id} onClick={() => onAction(a.id)} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '16px 8px', borderRadius: 16,
          background: a.accent ? 'rgba(15,184,180,0.10)' : 'var(--surface)',
          color: a.accent ? 'var(--accent)' : 'var(--fg)',
          border: 0, cursor: 'pointer',
          fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-sans)',
          boxShadow: 'var(--shadow-xs)',
          transition: 'all 180ms var(--ease-out-soft)',
        }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-xs)'}>
          <Icon name={a.icon} size={20}/>
          <span style={{ whiteSpace: 'nowrap' }}>{a.label}</span>
        </button>
      ))}
    </div>
  );
}

function LumiNudge({ onOpen }) {
  return (
    <button onClick={onOpen} style={{
      display: 'block', width: '100%', textAlign: 'left',
      padding: 16, borderRadius: 18,
      background: 'var(--surface)',
      boxShadow: 'var(--shadow-sm)',
      border: 0, cursor: 'pointer',
      transition: 'all 180ms var(--ease-out-soft)',
      fontFamily: 'var(--font-sans)',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <LumiAvatar size={36}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 600, color: 'var(--accent)' }}>Lumi</span>
            <span>·</span>
            <span>剛剛</span>
          </div>
          <div style={{ fontSize: 14, color: 'var(--fg)', marginTop: 2, lineHeight: 1.5 }}>
            你的歐洲行 10/5 出發，**英國 ETA 簽證**還沒辦，建議今天先送件，平均 3 天核發。
          </div>
        </div>
        <Icon name="chevronRight" size={16} color="var(--fg-muted)"/>
      </div>
    </button>
  );
}

function LumiAvatar({ size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 999,
      background: 'linear-gradient(135deg, #5DD9D5 0%, #0FB8B4 60%, #5B7CFA 120%)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', flexShrink: 0,
      boxShadow: '0 4px 16px rgba(15,184,180,0.32)',
    }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" opacity="0.95"/>
      </svg>
    </div>
  );
}

function UpcomingTripCard({ trip, onOpen }) {
  const dayCount = trip.days.length;
  return (
    <button onClick={onOpen} style={{
      display: 'block', width: '100%', textAlign: 'left',
      padding: 0, borderRadius: 20, overflow: 'hidden',
      background: 'var(--surface)',
      boxShadow: 'var(--shadow-sm)',
      border: 0, cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
      transition: 'all 180ms var(--ease-out-soft)',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}>
      <div style={{
        padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12,
        background: 'linear-gradient(110deg, rgba(91,124,250,0.10), rgba(15,184,180,0.06))',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--info)', fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em', flexShrink: 0,
        }}>EU</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>下個行程 · 還有 16 天</div>
          <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{trip.title}</div>
          <div style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>{trip.start.slice(5)} – {trip.end.slice(5)} · {dayCount} 天</div>
        </div>
        <Icon name="arrowRight" size={18} color="var(--fg-secondary)"/>
      </div>
      <div style={{ padding: '12px 18px', display: 'flex', gap: 6, overflowX: 'auto', borderTop: '1px solid var(--divider)' }}>
        {Array.from(new Set(trip.days.map(d => d.city))).map((c, i) => (
          <span key={i} style={{
            padding: '5px 10px', borderRadius: 999,
            background: 'rgba(0,0,0,0.04)', fontSize: 12,
            color: 'var(--fg)', whiteSpace: 'nowrap',
          }}>{c}</span>
        ))}
      </div>
    </button>
  );
}

function ActiveTripStrip({ trip, onOpen }) {
  const incomplete = trip.checklist.filter(t => !t.done);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 4px' }}>
        <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>進行中的行程</span>
        <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{trip.title} · 還有 {incomplete.length} 項任務</span>
        <span style={{ flex: 1 }}/>
        <button onClick={onOpen} style={{ border: 0, background: 'transparent', color: 'var(--accent)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>全部 →</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {incomplete.slice(0, 3).map(t => (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', borderRadius: 14, background: 'var(--surface)',
            boxShadow: 'var(--shadow-xs)',
          }}>
            <span style={{
              width: 18, height: 18, borderRadius: 5,
              boxShadow: 'inset 0 0 0 1.5px var(--divider-strong)',
              flexShrink: 0,
            }}/>
            <span style={{ flex: 1, fontSize: 13, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.text}</span>
            {t.due && <span style={{ fontSize: 11, color: 'var(--warning)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{t.due.slice(5)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Home, ActiveESIMCard, LumiAvatar, LumiNudge });
