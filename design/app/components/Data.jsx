/* global React */

/* ============================================================
   Roam eSIM — sample data for the consumer app
   ============================================================ */

const USER = {
  id: 'u_chiaju',
  name: '林家如',
  email: 'chiaju.lin@gmail.com',
  initials: 'CL',
  joined: '2024-03-11',
  tier: 'Roam+',
  homeCity: '台北',
};

const ACTIVE_ESIM = {
  id: 'sim_jp_5',
  country: 'JP', countryName: '日本',
  plan: '7 日 / 5GB',
  used: 1.24, total: 5.0,
  daysLeft: 4, daysTotal: 7,
  installedAt: '2025-09-15 11:42',
  network: 'NTT docomo',
  signal: 4,
  speed: '4G+',
};

// Helper: derive 'today' for the demo storyline
const TODAY = '2025-09-19';

const TRIPS = [
  {
    id: 'trip_jp',
    title: '東京 + 京都',
    cover: 'JP',
    start: '2025-09-15', end: '2025-09-22',
    status: 'active',
    days: [
      { d: '2025-09-15', city: '東京', note: '入境 · 抵達羽田' },
      { d: '2025-09-16', city: '東京', note: '築地 + 銀座' },
      { d: '2025-09-17', city: '東京', note: '迪士尼海洋' },
      { d: '2025-09-18', city: '東京', note: '原宿 + 表參道' },
      { d: '2025-09-19', city: '京都', note: '搭新幹線 → 京都' },
      { d: '2025-09-20', city: '京都', note: '清水寺 + 祇園' },
      { d: '2025-09-21', city: '京都', note: '嵐山 + 竹林' },
      { d: '2025-09-22', city: '東京', note: '返國 · 羽田 19:40' },
    ],
    checklist: [
      { id: 't1', text: '購買日本 7 日 5GB eSIM', done: true,  kind: 'esim', shortcut: 'shop', shopFilter: { country: 'JP', days: 7 } },
      { id: 't2', text: '兌換日圓 30,000', done: true, kind: 'money' },
      { id: 't3', text: '查行李重量限制', done: true, kind: 'flight' },
      { id: 't4', text: '訂京都民宿 (9/19 → 9/21)', done: true, kind: 'stay' },
      { id: 't5', text: '預訂迪士尼海洋門票', done: false, kind: 'ticket' },
      { id: 't6', text: '回程值機 (9/22 16:00 開放)', done: false, kind: 'flight', due: '2025-09-22' },
    ],
  },
  {
    id: 'trip_eu',
    title: '歐洲 5 國',
    cover: 'EU',
    start: '2025-10-05', end: '2025-10-18',
    status: 'upcoming',
    days: [
      { d: '2025-10-05', city: '巴黎',     note: 'CDG 抵達 · 拉丁區' },
      { d: '2025-10-06', city: '巴黎',     note: '羅浮宮 + 塞納河' },
      { d: '2025-10-07', city: '巴黎',     note: '凡爾賽宮' },
      { d: '2025-10-08', city: '阿姆斯特丹', note: '搭 Thalys 早車' },
      { d: '2025-10-09', city: '阿姆斯特丹', note: '梵谷美術館' },
      { d: '2025-10-10', city: '柏林',     note: '搭夜車 → 柏林' },
      { d: '2025-10-11', city: '柏林',     note: '博物館島' },
      { d: '2025-10-12', city: '布拉格',   note: '搭 EC → 布拉格' },
      { d: '2025-10-13', city: '布拉格',   note: '舊城區' },
      { d: '2025-10-14', city: '倫敦',     note: '飛倫敦 (Eurowings)' },
      { d: '2025-10-15', city: '倫敦',     note: '大英博物館' },
      { d: '2025-10-16', city: '倫敦',     note: 'Camden + Soho' },
      { d: '2025-10-17', city: '倫敦',     note: '備用 / shopping' },
      { d: '2025-10-18', city: '台北',     note: '希思羅 22:10 直飛桃園' },
    ],
    checklist: [
      { id: 'eu1', text: '購買歐洲 30 國 + 英國 14 日 / 15GB eSIM', done: false, kind: 'esim', shortcut: 'shop', shopFilter: { country: 'EU+UK', days: 14, gb: 15 }, suggested: true, suggestedBy: 'Lumi' },
      { id: 'eu2', text: '申請 ETA-UK (英國電子簽證)', done: false, kind: 'visa', due: '2025-09-28', suggested: true, suggestedBy: 'Lumi' },
      { id: 'eu3', text: '兌換 €500 / £200', done: false, kind: 'money' },
      { id: 'eu4', text: '辦理國際駕照', done: true, kind: 'doc' },
      { id: 'eu5', text: '訂巴黎 → 阿姆斯特丹 Thalys 車票', done: false, kind: 'transit', suggested: true, suggestedBy: 'Lumi' },
      { id: 'eu6', text: '帶轉接頭 (歐規 + 英規)', done: false, kind: 'gear', suggested: true, suggestedBy: 'Lumi' },
      { id: 'eu7', text: '訂旅平險 + 海外不便險', done: false, kind: 'insurance' },
    ],
  },
  {
    id: 'trip_seoul',
    title: '首爾跨年',
    cover: 'KR',
    start: '2025-12-29', end: '2026-01-03',
    status: 'upcoming',
    days: [
      { d: '2025-12-29', city: '首爾', note: '抵達仁川 + 弘大' },
      { d: '2025-12-30', city: '首爾', note: '景福宮 + 北村' },
      { d: '2025-12-31', city: '首爾', note: '南山塔跨年' },
      { d: '2026-01-01', city: '首爾', note: '明洞 + 東大門' },
      { d: '2026-01-02', city: '首爾', note: '汝矣島' },
      { d: '2026-01-03', city: '台北', note: '回程 17:20' },
    ],
    checklist: [
      { id: 'kr1', text: '購買韓國 7 日 無限 eSIM', done: false, kind: 'esim', shortcut: 'shop', shopFilter: { country: 'KR', days: 7 } },
      { id: 'kr2', text: '訂明洞住宿', done: false, kind: 'stay' },
      { id: 'kr3', text: '辦 K-ETA', done: false, kind: 'visa' },
    ],
  },
  {
    id: 'trip_okinawa_past',
    title: '沖繩家族行',
    cover: 'JP',
    start: '2025-06-12', end: '2025-06-16',
    status: 'past',
    days: [],
    checklist: [],
  },
];

const LUMI_CHAT_EU = [
  { from: 'lumi', t: '2025-09-18 22:14', text: '嗨家如，看到你在月曆裡擺了一塊 10/5–10/18 的空檔，要不要跟我說說想去哪裡？' },
  { from: 'user', t: '2025-09-18 22:16', text: '我要去歐洲，巴黎 3 天、阿姆斯特丹 2 天、然後柏林、布拉格各 2 天，最後倫敦 4 天再回台' },
  { from: 'lumi', t: '2025-09-18 22:16', text: '了解，我幫你排好了：', card: {
      kind: 'itinerary',
      days: [
        { date: '10/05', city: '巴黎',       sub: 'CDG 抵達' },
        { date: '10/06–07', city: '巴黎',   sub: '2 天' },
        { date: '10/08', city: '阿姆斯特丹', sub: 'Thalys 早車' },
        { date: '10/09', city: '阿姆斯特丹', sub: '' },
        { date: '10/10–11', city: '柏林',   sub: 'EC 夜車' },
        { date: '10/12–13', city: '布拉格', sub: '' },
        { date: '10/14–17', city: '倫敦',   sub: 'Eurowings 飛抵' },
        { date: '10/18', city: '回程',       sub: '希思羅 22:10' },
      ],
    } },
  { from: 'lumi', t: '2025-09-18 22:17', text: '幾個值得注意的地方：' },
  { from: 'lumi', t: '2025-09-18 22:17', text: '• 你會跨歐元區 + 英鎊區，我推薦一張覆蓋兩邊的 eSIM\n• 倫敦那段需要 ETA 電子簽證\n• 巴黎 → 阿姆斯特丹的 Thalys 越早訂越便宜' },
  { from: 'lumi', t: '2025-09-18 22:17', text: '我把這些加進你的準備清單了。要先看看 eSIM 方案嗎？', actions: [
      { id: 'shop-eu', label: '推薦 eSIM 方案', icon: 'sim', primary: true, intent: { screen: 'shop', filter: { country: 'EU+UK', days: 14, gb: 15 } } },
      { id: 'transit-eu', label: '查 Thalys 票價', icon: 'external' },
    ] },
  { from: 'user', t: '2025-09-19 09:02', text: '我們本來想 10/12 從柏林直飛布拉格，但好像要轉機' },
  { from: 'lumi', t: '2025-09-19 09:02', text: '對的，沒有直飛航班。從柏林到布拉格我會建議搭 EC 火車，4 小時直達，比飛還快（含機場前後時間）。我幫你把這段標記為「火車」了。' },
];

const SHOP_PRODUCTS = [
  { id: 'JP-7-5',    c: 'JP',    name: '日本 7 日 / 5GB',     supp: 'Truphone',  cost: 4.2, price: 12.0, network: '4G+ NTT docomo / SoftBank',         rating: 4.8, sold: 12_400, hot: true,    days: 7,  gb: 5,  tag: '經典' },
  { id: 'JP-14-10',  c: 'JP',    name: '日本 14 日 / 10GB',   supp: 'Truphone',  cost: 6.8, price: 18.0, network: '4G+ NTT docomo / SoftBank',         rating: 4.9, sold: 6_240,                days: 14, gb: 10, tag: '中長期' },
  { id: 'JP-7-INF',  c: 'JP',    name: '日本 7 日 / 無限',     supp: 'Airalo W.', cost: 8.6, price: 22.0, network: '5G NTT docomo (3GB/日 後降速)',     rating: 4.6, sold: 3_180,                days: 7,  gb: 999,tag: '吃到飽' },
  { id: 'TH-10-8',   c: 'TH',    name: '泰國 10 日 / 8GB',    supp: 'AIS',       cost: 3.8, price:  9.5, network: '5G AIS',                            rating: 4.7, sold: 9_120,                days: 10, gb: 8 },
  { id: 'KR-7-INF',  c: 'KR',    name: '韓國 7 日 / 無限',     supp: '1nce',      cost: 6.4, price: 16.0, network: '5G SKT (2GB/日 後降速)',           rating: 4.8, sold: 7_840, hot: true,    days: 7,  gb: 999,tag: '吃到飽' },
  { id: 'EU30-14-15',c: 'EU+UK', name: '歐洲 30 國 + 英國 14 日 / 15GB', supp: 'Vodafone', cost: 12.4, price: 32.0, network: '5G Vodafone / EE',  rating: 4.7, sold: 2_180, recommended: true, days: 14, gb: 15, tag: '跨區域' },
  { id: 'EU30-10-10',c: 'EU',    name: '歐洲 30 國 10 日 / 10GB', supp: 'Vodafone', cost: 8.1, price: 22.0, network: '5G Vodafone',                  rating: 4.6, sold: 4_240,                days: 10, gb: 10 },
  { id: 'US-15-20',  c: 'US',    name: '美國 15 日 / 20GB',   supp: 'Airalo W.', cost: 9.4, price: 24.0, network: '5G T-Mobile / AT&T',               rating: 4.5, sold: 3_640,                days: 15, gb: 20 },
  { id: 'SG-5-3',    c: 'SG',    name: '新加坡 5 日 / 3GB',   supp: 'Truphone',  cost: 2.4, price:  6.5, network: '5G Singtel',                       rating: 4.6, sold: 5_140,                days: 5,  gb: 3 },
  { id: 'VN-7-5',    c: 'VN',    name: '越南 7 日 / 5GB',     supp: '1nce',      cost: 3.1, price:  7.8, network: '4G+ Viettel',                      rating: 4.4, sold: 2_840,                days: 7,  gb: 5 },
  { id: 'GLOB-7-3',  c: 'GLOB',  name: '全球 70 國 7 日 / 3GB', supp: 'eSIM Go', cost: 8.8, price: 22.0, network: '依當地最佳訊號',                    rating: 4.3, sold: 1_240,                days: 7,  gb: 3, tag: '商務' },
];

const COUNTRY_NAMES = {
  JP: '日本', TW: '台灣', TH: '泰國', US: '美國', KR: '韓國', SG: '新加坡',
  MY: '馬來西亞', VN: '越南', ID: '印尼', PH: '菲律賓', HK: '香港', CN: '中國',
  GB: '英國', FR: '法國', DE: '德國', EU: '歐洲', 'EU+UK': '歐洲 + 英國', AU: '澳洲',
  NZ: '紐西蘭', IN: '印度', AE: '阿聯酋', GLOB: '全球漫遊',
};

Object.assign(window, { USER, ACTIVE_ESIM, TRIPS, LUMI_CHAT_EU, SHOP_PRODUCTS, COUNTRY_NAMES, TODAY });
