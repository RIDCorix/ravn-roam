/* global React, Icon, Avatar, Badge, Button, IconButton, Card, Flag, LumiAvatar */

function LumiChat({ chat, onSend, onAction, trip }) {
  const [draft, setDraft] = React.useState('');
  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length]);

  const submit = () => {
    if (!draft.trim()) return;
    onSend(draft.trim());
    setDraft('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Mini intro */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: 14,
        background: 'rgba(15,184,180,0.06)',
      }}>
        <LumiAvatar size={28}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
            <span style={{ fontWeight: 600, color: 'var(--accent)' }}>Lumi</span> 在幫你管理這趟「{trip.title}」。任何時候都可以跟她說新計畫。
          </div>
        </div>
      </div>

      {/* Chat scroll */}
      <div ref={scrollRef} style={{
        display: 'flex', flexDirection: 'column', gap: 12,
        padding: '4px 2px',
      }}>
        {chat.map((m, i) => <LumiMessage key={i} m={m} onAction={onAction}/>)}
      </div>

      {/* Suggested prompts */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['我想多待倫敦兩天', '幫我看 eSIM 方案', '兌換多少歐元夠？'].map(p => (
          <button key={p} onClick={() => setDraft(p)} style={{
            padding: '6px 12px', borderRadius: 999,
            background: 'var(--surface)', boxShadow: 'inset 0 0 0 1px var(--divider-strong)',
            color: 'var(--fg-secondary)', fontSize: 12,
            border: 0, cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
            transition: 'background 180ms var(--ease-out-soft)',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}>
            {p}
          </button>
        ))}
      </div>

      {/* Composer */}
      <form onSubmit={e => { e.preventDefault(); submit(); }} style={{
        position: 'sticky', bottom: 8,
        display: 'flex', gap: 6, alignItems: 'flex-end',
        padding: 6, borderRadius: 16,
        background: 'var(--surface)', boxShadow: 'var(--shadow-md), inset 0 0 0 1px var(--divider)',
      }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="跟 Lumi 說點什麼…"
          rows={1}
          style={{
            flex: 1, minWidth: 0, padding: '10px 12px',
            border: 0, outline: 'none', resize: 'none',
            fontSize: 14, fontFamily: 'var(--font-sans)', color: 'var(--fg)',
            background: 'transparent',
            maxHeight: 120,
          }}/>
        <button type="submit" disabled={!draft.trim()} style={{
          width: 36, height: 36, borderRadius: 10,
          background: draft.trim() ? 'var(--accent)' : 'rgba(0,0,0,0.06)',
          color: '#fff', border: 0, cursor: draft.trim() ? 'pointer' : 'not-allowed',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 180ms var(--ease-out-soft)',
          flexShrink: 0,
        }}>
          <Icon name="arrowUp" size={16}/>
        </button>
      </form>
    </div>
  );
}

function LumiMessage({ m, onAction }) {
  if (m.from === 'user') return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{
        maxWidth: '80%', padding: '10px 14px', borderRadius: 16,
        borderTopRightRadius: 6,
        background: '#111', color: '#fff',
        fontSize: 14, lineHeight: 1.5,
        whiteSpace: 'pre-wrap', wordWrap: 'break-word',
      }}>{m.text}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <LumiAvatar size={28}/>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {m.text && (
          <div style={{
            padding: '10px 14px', borderRadius: 16, borderTopLeftRadius: 6,
            background: 'var(--surface)', boxShadow: 'var(--shadow-xs)',
            fontSize: 14, lineHeight: 1.6,
            color: 'var(--fg)',
            whiteSpace: 'pre-wrap', wordWrap: 'break-word',
            display: 'inline-block', maxWidth: '100%',
          }}>{m.text}</div>
        )}
        {m.card?.kind === 'itinerary' && <ItineraryCard days={m.card.days}/>}
        {m.actions && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {m.actions.map(a => (
              <button key={a.id} onClick={() => onAction(a)} style={{
                padding: '7px 12px', borderRadius: 10,
                background: a.primary ? 'var(--accent)' : 'var(--surface)',
                color: a.primary ? '#fff' : 'var(--fg)',
                boxShadow: a.primary ? 'var(--shadow-sm)' : 'inset 0 0 0 1px var(--divider-strong)',
                border: 0, cursor: 'pointer',
                fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-sans)',
                display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                transition: 'all 180ms var(--ease-out-soft)',
              }}>
                {a.icon && <Icon name={a.icon} size={13}/>}
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ItineraryCard({ days }) {
  return (
    <div style={{
      padding: 12, borderRadius: 14,
      background: 'rgba(15,184,180,0.05)',
      boxShadow: 'inset 0 0 0 1px rgba(15,184,180,0.18)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Icon name="map" size={13} color="var(--accent)"/>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>建議行程</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {days.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <span style={{ width: 56, fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', fontSize: 12, flexShrink: 0, whiteSpace: 'nowrap' }}>{d.date}</span>
            <span style={{ fontWeight: 500, color: 'var(--fg)', whiteSpace: 'nowrap' }}>{d.city}</span>
            {d.sub && <span style={{ flex: 1, fontSize: 12, color: 'var(--fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.sub}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   Trip-level checklist (used inside Trip Detail)
   ============================================================ */
function TripChecklist({ trip, navigate }) {
  const [items, setItems] = React.useState(trip.checklist);
  const toggle = (id) => setItems(arr => arr.map(t => t.id === id ? { ...t, done: !t.done } : t));

  const grouped = { suggested: [], pending: [], done: [] };
  for (const t of items) {
    if (t.done) grouped.done.push(t);
    else if (t.suggested) grouped.suggested.push(t);
    else grouped.pending.push(t);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {grouped.suggested.length > 0 && (
        <ChecklistGroup label="Lumi 建議" tint icon="sparkle" items={grouped.suggested} onToggle={toggle} navigate={navigate} tripTitle={trip.title}/>
      )}
      <ChecklistGroup label="待辦" items={grouped.pending} onToggle={toggle} navigate={navigate} tripTitle={trip.title}/>
      {grouped.done.length > 0 && (
        <ChecklistGroup label="已完成" items={grouped.done} onToggle={toggle} navigate={navigate} tripTitle={trip.title} done/>
      )}

      {/* add custom */}
      <button style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '12px 14px', borderRadius: 14,
        background: 'transparent', color: 'var(--fg-secondary)',
        border: '1.5px dashed var(--divider-strong)', cursor: 'pointer',
        fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-sans)',
      }}>
        <Icon name="plus" size={14}/>
        新增任務
      </button>
    </div>
  );
}

function ChecklistGroup({ label, items, onToggle, tint, icon, done, navigate, tripTitle }) {
  if (items.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
        {icon && <Icon name={icon} size={13} color="var(--accent)"/>}
        <span style={{
          fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
          color: tint ? 'var(--accent)' : 'var(--fg-secondary)',
        }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{items.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(t => <ChecklistItem key={t.id} t={t} onToggle={onToggle} tint={tint} doneState={done} navigate={navigate}/>)}
      </div>
    </div>
  );
}

function ChecklistItem({ t, onToggle, tint, doneState, navigate }) {
  const KIND_ICONS = {
    esim: 'sim', money: 'flame', flight: 'arrowUpRight', stay: 'home',
    ticket: 'receipt', visa: 'file', doc: 'file', gear: 'package',
    transit: 'arrowRight', insurance: 'checkCircle',
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px', borderRadius: 14,
      background: tint ? 'rgba(15,184,180,0.06)' : 'var(--surface)',
      boxShadow: tint ? 'inset 0 0 0 1px rgba(15,184,180,0.22)' : 'var(--shadow-xs)',
      opacity: doneState ? 0.6 : 1,
    }}>
      <button onClick={() => onToggle(t.id)} style={{
        width: 22, height: 22, borderRadius: 7,
        background: t.done ? 'var(--accent)' : 'transparent',
        boxShadow: t.done ? 'none' : 'inset 0 0 0 1.5px var(--divider-strong)',
        border: 0, cursor: 'pointer', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff',
        transition: 'all 140ms var(--ease-out-soft)',
      }}>
        {t.done && <Icon name="check" size={13} strokeWidth={3}/>}
      </button>

      <Icon name={KIND_ICONS[t.kind] || 'circle'} size={14} color={tint ? 'var(--accent)' : 'var(--fg-muted)'}/>

      <span style={{
        flex: 1, minWidth: 0,
        fontSize: 13, color: 'var(--fg)',
        textDecoration: t.done ? 'line-through' : 'none',
        textDecorationColor: 'var(--fg-muted)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{t.text}</span>

      {t.due && !t.done && (
        <span style={{ fontSize: 11, color: 'var(--warning)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', flexShrink: 0 }}>{t.due.slice(5)}</span>
      )}

      {t.shortcut === 'shop' && !t.done && (
        <button onClick={() => navigate('shop:' + (t.shopFilter?.country || ''))} style={{
          padding: '5px 10px', borderRadius: 8,
          background: '#111', color: '#fff', border: 0, cursor: 'pointer',
          fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-sans)',
          display: 'inline-flex', alignItems: 'center', gap: 4,
          flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          <Icon name="arrowRight" size={10}/>
          打開
        </button>
      )}
    </div>
  );
}

Object.assign(window, { LumiChat, LumiMessage, TripChecklist, ChecklistItem });
