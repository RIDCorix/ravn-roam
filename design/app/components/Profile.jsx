/* global React, Icon, Avatar, Badge, Button, IconButton, Card, USER, ACTIVE_ESIM, TRIPS, PageHeader, LumiAvatar */

function Profile({ navigate, currency, onCurrencyChange }) {
  return (
    <div>
      <PageHeader title="我"/>
      <div style={{ padding: '4px 20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* User header */}
        <div style={{
          padding: 18, borderRadius: 20,
          background: 'var(--surface)', boxShadow: 'var(--shadow-sm)',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <Avatar initials={USER.initials} size={56} color="#0FB8B4"/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{USER.name}</span>
              <Badge variant="accent">{USER.tier}</Badge>
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{USER.email}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 2 }}>會員自 {USER.joined.slice(0, 7)}</div>
          </div>
          <IconButton name="settings"/>
        </div>

        {/* Lifetime stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <MeStat label="行程數" value={TRIPS.length} sub="2 趟進行中"/>
          <MeStat label="購買 eSIM" value="14" sub="累積 84GB"/>
          <MeStat label="走過國家" value="11" sub="3 大洲"/>
        </div>

        {/* Active eSIMs */}
        <Section title="使用中的 eSIM">
          <div style={{
            padding: 14, borderRadius: 14,
            background: 'var(--surface)', boxShadow: 'var(--shadow-xs)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: 'rgba(15,184,180,0.10)', color: 'var(--accent)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}><Icon name="sim" size={18}/></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ACTIVE_ESIM.countryName} · {ACTIVE_ESIM.plan}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>剩 {(ACTIVE_ESIM.total - ACTIVE_ESIM.used).toFixed(2)}GB · {ACTIVE_ESIM.daysLeft} 天</div>
            </div>
            <Badge variant="success" dot>使用中</Badge>
          </div>
        </Section>

        {/* Order history */}
        <Section title="最近訂單" right="查看全部">
          {[
            { id: 'OR-28492', name: '日本 7 日 / 5GB', date: '2025-09-15', price: 12.0 },
            { id: 'OR-27411', name: '沖繩 5 日 / 3GB', date: '2025-06-10', price:  6.5 },
            { id: 'OR-26108', name: '泰國 10 日 / 8GB', date: '2025-03-22', price:  9.5 },
          ].map(o => (
            <div key={o.id} style={{
              padding: '12px 14px', borderRadius: 14,
              background: 'var(--surface)', boxShadow: 'var(--shadow-xs)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.name}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{o.id} · {o.date}</div>
              </div>
              <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--fg)', whiteSpace: 'nowrap' }}>${o.price.toFixed(2)}</div>
            </div>
          ))}
        </Section>

        {/* Settings */}
        <Section title="設定">
          <SettingRow icon="bell" label="通知"/>
          <SettingRow icon="globe" label="幣別" value={currency} onClick={() => onCurrencyChange?.(currency === 'TWD' ? 'USD' : 'TWD')}/>
          <SettingRow icon="help" label="客服 + 常見問題"/>
          <SettingRow icon="external" label="條款 + 隱私"/>
        </Section>
      </div>
    </div>
  );
}

function MeStat({ label, value, sub }) {
  return (
    <div style={{
      padding: 14, borderRadius: 14,
      background: 'var(--surface)', boxShadow: 'var(--shadow-xs)',
      display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, overflow: 'hidden',
    }}>
      <div style={{ fontSize: 11, color: 'var(--fg-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--fg)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--fg-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  );
}

function Section({ title, right, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', padding: '0 4px' }}>
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fg-secondary)' }}>{title}</span>
        <span style={{ flex: 1 }}/>
        {right && <button style={{ border: 0, background: 'transparent', color: 'var(--accent)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>{right}</button>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

function SettingRow({ icon, label, value, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', borderRadius: 14,
      background: 'var(--surface)', boxShadow: 'var(--shadow-xs)',
      border: 0, cursor: onClick ? 'pointer' : 'default', width: '100%', textAlign: 'left',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8,
        background: 'rgba(0,0,0,0.04)', color: 'var(--fg-secondary)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={14}/>
      </div>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--fg)' }}>{label}</span>
      {value && <span style={{ fontSize: 12, color: 'var(--fg-secondary)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{value}</span>}
      <Icon name="chevronRight" size={14} color="var(--fg-muted)"/>
    </button>
  );
}

Object.assign(window, { Profile });
