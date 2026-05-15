/* global React, Icon, Avatar, Badge, Button, IconButton, Card, Flag, TRIPS, LUMI_CHAT_EU, TODAY, PageHeader, LumiAvatar */

function Trips({ navigate }) {
  const active   = TRIPS.filter(t => t.status === 'active');
  const upcoming = TRIPS.filter(t => t.status === 'upcoming').sort((a, b) => a.start.localeCompare(b.start));
  const past     = TRIPS.filter(t => t.status === 'past');

  return (
    <div>
      <PageHeader
        title="行程"
        subtitle={`${active.length + upcoming.length} 個進行中或即將開始`}
        right={<IconButton name="plus" title="新增行程"/>}
      />
      <div style={{ padding: '4px 20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* New trip card */}
        <NewTripPrompt onCreate={() => navigate('trip:trip_eu')}/>

        {active.length > 0 && <TripSection label="進行中" trips={active} status="active" onOpen={id => navigate('trip:' + id)}/>}
        {upcoming.length > 0 && <TripSection label="即將開始" trips={upcoming} status="upcoming" onOpen={id => navigate('trip:' + id)}/>}
        {past.length > 0 && <TripSection label="已結束" trips={past} status="past" onOpen={id => navigate('trip:' + id)}/>}
      </div>
    </div>
  );
}

function NewTripPrompt({ onCreate }) {
  const [input, setInput] = React.useState('');
  return (
    <div style={{
      padding: 18, borderRadius: 20,
      background: 'linear-gradient(140deg, rgba(15,184,180,0.10), rgba(91,124,250,0.06))',
      display: 'flex', flexDirection: 'column', gap: 12,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <LumiAvatar size={32}/>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>跟 Lumi 說你的計畫</div>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>用一句話就好，例如「11/15 飛東京玩 5 天」</div>
        </div>
      </div>
      <form onSubmit={e => { e.preventDefault(); if (input.trim()) onCreate(); }} style={{
        display: 'flex', gap: 6, alignItems: 'stretch',
        background: 'var(--surface)', borderRadius: 12,
        padding: 6, boxShadow: 'inset 0 0 0 1px var(--divider)',
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="例：12/29 飛首爾跨年，玩 5 天"
          style={{
            flex: 1, minWidth: 0, padding: '8px 8px',
            border: 0, outline: 'none', background: 'transparent',
            fontSize: 14, fontFamily: 'var(--font-sans)', color: 'var(--fg)',
          }}/>
        <button type="submit" style={{
          padding: '8px 14px', borderRadius: 9,
          background: '#111', color: '#fff', border: 0, cursor: 'pointer',
          fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-sans)',
          display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
        }}>
          <Icon name="sparkle" size={13}/>
          建立
        </button>
      </form>
    </div>
  );
}

function TripSection({ label, trips, status, onOpen }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 4px' }}>
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fg-secondary)' }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{trips.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {trips.map(t => <TripRow key={t.id} trip={t} status={status} onClick={() => onOpen(t.id)}/>)}
      </div>
    </div>
  );
}

function TripRow({ trip, status, onClick }) {
  const cities = Array.from(new Set(trip.days.map(d => d.city)));
  const done = trip.checklist.filter(t => t.done).length;
  const total = trip.checklist.length;
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 16px', borderRadius: 16,
      background: 'var(--surface)',
      boxShadow: 'var(--shadow-xs)',
      border: 0, cursor: 'pointer', width: '100%', textAlign: 'left',
      fontFamily: 'var(--font-sans)',
      transition: 'all 180ms var(--ease-out-soft)',
      opacity: status === 'past' ? 0.78 : 1,
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-xs)'; }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: status === 'active' ? 'var(--accent)' : status === 'upcoming' ? 'rgba(91,124,250,0.14)' : 'rgba(0,0,0,0.04)',
        color: status === 'active' ? '#fff' : status === 'upcoming' ? 'var(--info)' : 'var(--fg-secondary)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, letterSpacing: '-0.02em',
      }}>{trip.cover}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{trip.title}</span>
          {status === 'active' && <Badge variant="accent" dot>進行中</Badge>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span>{trip.start.slice(5)} – {trip.end.slice(5)}</span>
          <span style={{ color: 'var(--fg-subtle)' }}>·</span>
          <span>{trip.days.length} 天</span>
          {cities.length > 0 && (
            <>
              <span style={{ color: 'var(--fg-subtle)' }}>·</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{cities.join(' · ')}</span>
            </>
          )}
        </div>
      </div>
      {total > 0 && (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--fg)', whiteSpace: 'nowrap' }}>{done}/{total}</div>
          <div style={{ fontSize: 10, color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>任務</div>
        </div>
      )}
      <Icon name="chevronRight" size={16} color="var(--fg-muted)"/>
    </button>
  );
}

/* ============================================================
   Trip Detail — timeline of days + Lumi chat + checklist
   ============================================================ */

function TripDetail({ tripId, navigate, isMobile }) {
  const trip = TRIPS.find(t => t.id === tripId);
  const [tab, setTab] = React.useState('overview');
  const [chat, setChat] = React.useState(LUMI_CHAT_EU);

  if (!trip) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <Empty title="找不到行程" onBack={() => navigate('trips')}/>
    </div>
  );

  return (
    <div>
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(247,247,245,0.85)',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        padding: '14px 20px 12px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button onClick={() => navigate('trips')} style={{
          border: 0, background: 'transparent', cursor: 'pointer',
          width: 32, height: 32, borderRadius: 10,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--fg)', flexShrink: 0,
        }}><Icon name="chevronRight" size={16} style={{ transform: 'rotate(180deg)' }}/></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '-0.015em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{trip.title}</h1>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
            {trip.start} → {trip.end} · {trip.days.length} 天
          </div>
        </div>
        <IconButton name="ellipsis"/>
      </header>

      {/* Tabs */}
      <div style={{ padding: '4px 16px 0', display: 'flex', gap: 0, borderBottom: '1px solid var(--divider)' }}>
        {[
          { id: 'overview',  label: '概覽' },
          { id: 'lumi',      label: 'Lumi' },
          { id: 'checklist', label: '清單', count: trip.checklist.filter(t => !t.done).length },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            border: 0, background: 'transparent', cursor: 'pointer',
            padding: '10px 16px', borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === t.id ? 'var(--fg)' : 'var(--fg-muted)',
            fontSize: 13, fontWeight: tab === t.id ? 600 : 500,
            fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginBottom: -1,
            transition: 'all 180ms var(--ease-out-soft)',
          }}>
            {t.label}
            {t.count != null && t.count > 0 && (
              <span style={{
                padding: '0 6px', minWidth: 18, height: 16,
                background: tab === t.id ? 'var(--accent)' : 'rgba(0,0,0,0.06)',
                color: tab === t.id ? '#fff' : 'var(--fg-secondary)',
                borderRadius: 999, fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px 20px 24px' }}>
        {tab === 'overview'  && <TripOverview trip={trip}/>}
        {tab === 'lumi'      && <LumiChat chat={chat} onSend={(t) => setChat(c => [...c, { from: 'user', t: 'now', text: t }, { from: 'lumi', t: 'now', text: '收到，幫你看看…' }])} onAction={a => { if (a.intent?.screen === 'shop') navigate('shop:' + (a.intent.filter?.country || '')); }} trip={trip}/>}
        {tab === 'checklist' && <TripChecklist trip={trip} navigate={navigate}/>}
      </div>
    </div>
  );
}

function TripOverview({ trip }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Map placeholder */}
      <div style={{
        position: 'relative', height: 160, borderRadius: 18, overflow: 'hidden',
        background: 'linear-gradient(135deg, #DCF4F3 0%, #ECF0FE 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg viewBox="0 0 400 160" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          {/* faux route */}
          <path d="M 40 80 Q 100 30 160 70 T 280 60 T 360 110" fill="none" stroke="#0FB8B4" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 4"/>
          {Array.from(new Set(trip.days.map(d => d.city))).slice(0, 5).map((c, i, arr) => {
            const x = 40 + (i / Math.max(1, arr.length - 1)) * 320;
            const y = 80 + Math.sin(i * 1.4) * 22;
            return (
              <g key={c}>
                <circle cx={x} cy={y} r="6" fill="#fff" stroke="#0FB8B4" strokeWidth="2"/>
                <circle cx={x} cy={y} r="2.5" fill="#0FB8B4"/>
                <text x={x} y={y - 12} textAnchor="middle" fontSize="11" fill="#111" fontFamily="var(--font-sans)" fontWeight="600">{c}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Day-by-day timeline */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10, padding: '0 4px' }}>每日行程</div>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: 36, top: 8, bottom: 8, width: 1, background: 'var(--divider)' }}/>
          {trip.days.map((d, i) => {
            const isToday = d.d === TODAY;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 16,
                padding: '8px 8px 8px 0', position: 'relative',
              }}>
                <div style={{ width: 64, textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>Day {i + 1}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--fg)', whiteSpace: 'nowrap' }}>{d.d.slice(5)}</div>
                </div>
                <div style={{
                  width: 10, height: 10, borderRadius: 999, flexShrink: 0,
                  marginTop: 5,
                  background: isToday ? 'var(--accent)' : '#fff',
                  boxShadow: isToday ? '0 0 0 4px rgba(15,184,180,0.18)' : 'inset 0 0 0 2px var(--divider-strong)',
                  position: 'relative', zIndex: 1,
                }}/>
                <div style={{
                  flex: 1, minWidth: 0,
                  padding: '8px 14px', borderRadius: 12,
                  background: isToday ? 'rgba(15,184,180,0.08)' : 'var(--surface)',
                  boxShadow: isToday ? 'none' : 'var(--shadow-xs)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: isToday ? 'var(--accent)' : 'var(--fg)', whiteSpace: 'nowrap' }}>{d.city}</span>
                    {isToday && <Badge variant="accent" dot>今天</Badge>}
                  </div>
                  {d.note && <div style={{ fontSize: 12, color: 'var(--fg-secondary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.note}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Empty({ title, onBack }) {
  return (
    <div>
      <div style={{ fontSize: 16, color: 'var(--fg-muted)' }}>{title}</div>
      <Button onClick={onBack} style={{ marginTop: 12 }}>回到行程</Button>
    </div>
  );
}

Object.assign(window, { Trips, TripDetail, TripOverview });
