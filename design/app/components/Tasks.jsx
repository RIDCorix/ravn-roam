/* global React, Icon, Avatar, Badge, Button, IconButton, Card, Flag, TRIPS, TODAY, PageHeader, ChecklistItem */

function Tasks({ navigate }) {
  const [filter, setFilter] = React.useState('all');
  const [tripFilter, setTripFilter] = React.useState('all');

  const allItems = TRIPS.flatMap(t =>
    t.checklist.filter(c => t.status !== 'past' || c.done).map(c => ({
      ...c, tripId: t.id, tripTitle: t.title, tripStatus: t.status,
    }))
  );

  let items = allItems;
  if (filter === 'todo') items = items.filter(i => !i.done);
  if (filter === 'done') items = items.filter(i => i.done);
  if (filter === 'suggested') items = items.filter(i => i.suggested);
  if (tripFilter !== 'all') items = items.filter(i => i.tripId === tripFilter);

  const counts = {
    all: allItems.length,
    todo: allItems.filter(i => !i.done).length,
    done: allItems.filter(i => i.done).length,
    suggested: allItems.filter(i => i.suggested).length,
  };

  return (
    <div>
      <PageHeader
        title="任務"
        subtitle={`所有行程的準備清單 · ${counts.todo} 項待處理`}
        right={<IconButton name="ellipsis"/>}
      />
      <div style={{ padding: '4px 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Stat strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <TaskStat label="待處理" value={counts.todo} accent/>
          <TaskStat label="Lumi 建議" value={counts.suggested} info/>
          <TaskStat label="已完成" value={counts.done}/>
        </div>

        {/* Tab pills */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '2px 0' }}>
          {[
            { id: 'all',       label: '全部' },
            { id: 'todo',      label: '待辦' },
            { id: 'suggested', label: 'Lumi 建議' },
            { id: 'done',      label: '已完成' },
          ].map(t => {
            const active = filter === t.id;
            return (
              <button key={t.id} onClick={() => setFilter(t.id)} style={{
                padding: '6px 14px', borderRadius: 999,
                background: active ? '#111' : 'var(--surface)',
                color: active ? '#fff' : 'var(--fg-secondary)',
                boxShadow: active ? 'none' : 'inset 0 0 0 1px var(--divider-strong)',
                border: 0, cursor: 'pointer',
                fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-sans)',
                whiteSpace: 'nowrap', flexShrink: 0,
                transition: 'all 180ms var(--ease-out-soft)',
              }}>{t.label}</button>
            );
          })}
        </div>

        {/* Trip filter */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '2px 0' }}>
          <TripFilterChip label="所有行程" active={tripFilter === 'all'} onClick={() => setTripFilter('all')}/>
          {TRIPS.filter(t => t.status !== 'past').map(t => (
            <TripFilterChip key={t.id} label={t.title} active={tripFilter === t.id} onClick={() => setTripFilter(t.id)}/>
          ))}
        </div>

        {/* Items grouped by trip */}
        <TasksByTrip items={items} navigate={navigate}/>
      </div>
    </div>
  );
}

function TripFilterChip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 999,
      background: active ? 'rgba(15,184,180,0.10)' : 'transparent',
      color: active ? 'var(--accent)' : 'var(--fg-muted)',
      boxShadow: active ? 'inset 0 0 0 1px var(--accent-ring)' : 'inset 0 0 0 1px var(--divider)',
      border: 0, cursor: 'pointer',
      fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-sans)',
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>{label}</button>
  );
}

function TaskStat({ label, value, accent, info }) {
  return (
    <div style={{
      padding: 14, borderRadius: 14,
      background: accent ? 'rgba(15,184,180,0.10)' : info ? 'rgba(91,124,250,0.10)' : 'var(--surface)',
      boxShadow: accent || info ? 'none' : 'var(--shadow-xs)',
      display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, overflow: 'hidden',
    }}>
      <div style={{ fontSize: 11, color: accent ? 'var(--accent)' : info ? 'var(--info)' : 'var(--fg-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

function TasksByTrip({ items, navigate }) {
  // group by tripId
  const byTrip = {};
  for (const i of items) {
    (byTrip[i.tripId] = byTrip[i.tripId] || []).push(i);
  }
  const tripOrder = TRIPS.filter(t => byTrip[t.id]).map(t => t.id);

  if (tripOrder.length === 0) return (
    <div style={{
      padding: 40, textAlign: 'center',
      color: 'var(--fg-muted)', fontSize: 13,
    }}>沒有符合的任務</div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {tripOrder.map(tid => {
        const trip = TRIPS.find(t => t.id === tid);
        const its = byTrip[tid];
        return (
          <div key={tid} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => navigate('trip:' + tid)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 4px', border: 0, background: 'transparent', cursor: 'pointer',
              textAlign: 'left',
            }}>
              <span style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: trip.status === 'active' ? 'var(--accent)' : 'rgba(0,0,0,0.06)',
                color: trip.status === 'active' ? '#fff' : 'var(--fg-secondary)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, letterSpacing: '-0.02em',
              }}>{trip.cover}</span>
              <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{trip.title}</span>
              <span style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{trip.start.slice(5)} – {trip.end.slice(5)}</span>
              <span style={{ flex: 1 }}/>
              <Icon name="chevronRight" size={14} color="var(--fg-muted)"/>
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {its.map(t => (
                <ChecklistItem
                  key={t.id}
                  t={t}
                  onToggle={() => {}}
                  tint={t.suggested && !t.done}
                  doneState={t.done}
                  navigate={navigate}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, { Tasks });
