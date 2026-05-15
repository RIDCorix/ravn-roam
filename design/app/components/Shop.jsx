/* global React, Icon, Avatar, Badge, Button, IconButton, Card, Flag, SHOP_PRODUCTS, COUNTRY_NAMES, PageHeader */

function Shop({ navigate, prefilter, currency = 'TWD' }) {
  // Parse prefilter "shop:JP" or "shop:EU+UK"
  const initialCountry = prefilter || null;
  const [country, setCountry] = React.useState(initialCountry || 'all');
  const [daysFilter, setDaysFilter] = React.useState('all'); // 'short' / 'medium' / 'long'
  const [sort, setSort] = React.useState('hot');

  React.useEffect(() => {
    if (prefilter) setCountry(prefilter);
  }, [prefilter]);

  const fx = currency === 'TWD' ? 32 : 1;
  const sym = currency === 'TWD' ? 'NT$' : '$';
  const fmt = x => sym + Math.round(x * fx).toLocaleString();

  let products = SHOP_PRODUCTS;
  if (country !== 'all') products = products.filter(p => p.c === country);
  if (daysFilter !== 'all') {
    products = products.filter(p => {
      if (daysFilter === 'short')  return p.days <= 7;
      if (daysFilter === 'medium') return p.days > 7 && p.days <= 14;
      if (daysFilter === 'long')   return p.days > 14;
      return true;
    });
  }
  if (sort === 'price') products = [...products].sort((a, b) => a.price - b.price);
  if (sort === 'rating') products = [...products].sort((a, b) => b.rating - a.rating);
  if (sort === 'hot') products = [...products].sort((a, b) => b.sold - a.sold);

  const countries = ['all', ...Array.from(new Set(SHOP_PRODUCTS.map(p => p.c)))];

  return (
    <div>
      <PageHeader
        title="買 eSIM"
        subtitle={prefilter ? `為「${COUNTRY_NAMES[prefilter] || prefilter}」行程篩選` : '即買即用，掃 QR Code 啟用'}
        right={<IconButton name="search"/>}
      />

      <div style={{ padding: '4px 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {prefilter && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 12,
            background: 'rgba(15,184,180,0.08)',
          }}>
            <Icon name="sparkle" size={14} color="var(--accent)"/>
            <span style={{ flex: 1, fontSize: 13, color: 'var(--fg)' }}>
              Lumi 已根據你的行程預先篩選了「<strong>{COUNTRY_NAMES[prefilter] || prefilter}</strong>」方案
            </span>
            <button onClick={() => { setCountry('all'); navigate('shop'); }} style={{
              border: 0, background: 'transparent', cursor: 'pointer',
              color: 'var(--accent)', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
            }}>清除</button>
          </div>
        )}

        {/* Country chips */}
        <div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '2px 0', margin: '0 -20px', paddingLeft: 20, paddingRight: 20 }}>
            {countries.map(c => {
              const active = country === c;
              return (
                <button key={c} onClick={() => setCountry(c)} style={{
                  padding: '7px 14px', borderRadius: 999,
                  background: active ? '#111' : 'var(--surface)',
                  color: active ? '#fff' : 'var(--fg-secondary)',
                  boxShadow: active ? 'none' : 'inset 0 0 0 1px var(--divider-strong)',
                  border: 0, cursor: 'pointer',
                  fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-sans)',
                  whiteSpace: 'nowrap', flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  transition: 'all 180ms var(--ease-out-soft)',
                }}>
                  {c === 'all' ? '全部' : (
                    <>
                      <Flag code={c.length <= 2 ? c : 'EU'} size={14}/>
                      {COUNTRY_NAMES[c] || c}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sort + days */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Segments value={daysFilter} onChange={setDaysFilter} options={[
            { v: 'all',    l: '全部' },
            { v: 'short',  l: '≤7 天' },
            { v: 'medium', l: '8–14' },
            { v: 'long',   l: '15+' },
          ]}/>
          <span style={{ flex: 1 }}/>
          <button style={{
            padding: '6px 12px', borderRadius: 10,
            background: 'transparent', border: 0, cursor: 'pointer',
            color: 'var(--fg-secondary)', fontSize: 13,
            display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
          }} onClick={() => setSort(s => s === 'hot' ? 'price' : s === 'price' ? 'rating' : 'hot')}>
            <Icon name="sortDesc" size={13}/>
            {sort === 'hot' ? '熱門' : sort === 'price' ? '價格' : '評分'}
          </button>
        </div>

        {/* Product list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {products.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>
              沒有符合的方案，試試其他國家
            </div>
          )}
          {products.map(p => <ShopProduct key={p.id} p={p} fmt={fmt}/>)}
        </div>
      </div>
    </div>
  );
}

function Segments({ value, onChange, options }) {
  return (
    <div style={{ display: 'inline-flex', padding: 3, background: 'rgba(0,0,0,0.04)', borderRadius: 10, gap: 2 }}>
      {options.map(o => {
        const a = value === o.v;
        return (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            padding: '5px 10px', borderRadius: 8,
            background: a ? 'var(--surface)' : 'transparent',
            color: a ? 'var(--fg)' : 'var(--fg-secondary)',
            border: 0, cursor: 'pointer',
            fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-sans)',
            boxShadow: a ? 'var(--shadow-xs)' : 'none',
            whiteSpace: 'nowrap',
            transition: 'all 180ms var(--ease-out-soft)',
          }}>{o.l}</button>
        );
      })}
    </div>
  );
}

function ShopProduct({ p, fmt }) {
  return (
    <div style={{
      padding: 14, borderRadius: 16,
      background: 'var(--surface)',
      boxShadow: p.recommended ? 'inset 0 0 0 1.5px var(--accent-ring), var(--shadow-sm)' : 'var(--shadow-xs)',
      display: 'flex', alignItems: 'center', gap: 14,
      position: 'relative',
      transition: 'all 180ms var(--ease-out-soft)',
    }}>
      {p.recommended && (
        <span style={{
          position: 'absolute', top: -8, left: 16,
          padding: '2px 8px', borderRadius: 999,
          background: 'var(--accent)', color: '#fff',
          fontSize: 10, fontWeight: 600, letterSpacing: '0.02em',
          display: 'inline-flex', alignItems: 'center', gap: 4,
          boxShadow: 'var(--shadow-sm)',
          whiteSpace: 'nowrap',
        }}>
          <Icon name="sparkle" size={9}/>
          Lumi 推薦
        </span>
      )}

      <Flag code={p.c.length <= 2 ? p.c : 'EU'} size={30}/>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{p.name}</span>
          {p.hot && <Badge variant="error" style={{ fontSize: 10, padding: '2px 6px' }}>熱賣</Badge>}
          {p.tag && !p.hot && <Badge variant="neutral" style={{ fontSize: 10, padding: '2px 6px' }}>{p.tag}</Badge>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {p.network}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
            <Icon name="star" size={11} color="#D9994E" strokeWidth={2}/>
            {p.rating}
          </span>
          <span style={{ color: 'var(--fg-subtle)' }}>·</span>
          <span style={{ whiteSpace: 'nowrap' }}>{p.sold.toLocaleString()} 售出</span>
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(p.price)}</div>
        <button style={{
          marginTop: 6, padding: '6px 14px', borderRadius: 10,
          background: '#111', color: '#fff', border: 0, cursor: 'pointer',
          fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)',
          display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
          transition: 'all 180ms var(--ease-out-soft)',
        }}
          onMouseEnter={e => e.currentTarget.style.background = '#1F1F1F'}
          onMouseLeave={e => e.currentTarget.style.background = '#111'}>
          購買
          <Icon name="arrowRight" size={11}/>
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { Shop });
