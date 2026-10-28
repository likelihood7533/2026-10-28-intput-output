/* ============ 常數與設定 ============ */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toNum = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const money = n => 'NT$ ' + Math.round(n).toLocaleString('zh-TW');
const sum = arr => arr.reduce((s, x) => s + x, 0);
function dayStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
const today = () => dayStr(0);
const isOverdue = i => !!i.due && i.due < today() && i.status !== '已完成';

const STATUSES = ['待製作', '製作中', '待確認', '已完成'];
const STATUS_CLS = { '待製作': 's-todo', '製作中': 's-doing', '待確認': 's-review', '已完成': 's-done' };
const STATUS_COLOR = { '待製作': '#D9C6AE', '製作中': '#F28C28', '待確認': '#F5B800', '已完成': '#7CB342' };
const PAY_CLS = { '未收款': 's-over', '部分收款': 's-review', '已收清': 's-done' };
const STEP = ['未開始', '進行中', '完成'];
const CAT_ORDER = ['2d', '3d', 'live2d', 'v'];

const CATS = {
  '2d': {
    label: '2D 美術委託', short: '2D', color: '#E8453C', tag: 'tag-2d',
    subs: ['大圖／大張插圖', 'ICON', 'Q 版人物', '黑白稿', '其他 2D 委託'],
    fields: [
      { key: 'size', label: '尺寸', type: 'select', options: ['小（A5 以下）', '中（A4）', '大（A3 以上）', '自訂尺寸'] },
      { key: 'complex', label: '畫面複雜度', type: 'select', options: ['簡單', '一般', '複雜'] },
      { key: 'commercial', label: '含商用授權', type: 'checkbox' }
    ]
  },
  '3d': {
    label: '3D 美術工作', short: '3D', color: '#F28C28', tag: 'tag-3d',
    subs: ['角色建模', '道具建模', 'UV 拆解', '貼圖製作'],
    fields: [
      { key: 'model', label: '建模狀態', type: 'select', options: STEP },
      { key: 'uv', label: 'UV 狀態', type: 'select', options: STEP },
      { key: 'tex', label: '貼圖狀態', type: 'select', options: STEP }
    ]
  },
  'live2d': {
    label: 'Live2D 建模', short: 'Live2D', color: '#F5B800', tag: 'tag-live',
    subs: ['完整建模', '修改既有模型', '物理與表情', '測試交件'],
    fields: [
      { key: 'psdOk', label: 'PSD 拆件已齊全', type: 'checkbox' },
      { key: 'physics', label: '需要物理設定', type: 'checkbox' },
      { key: 'exprCount', label: '表情數量', type: 'number' }
    ]
  },
  'v': {
    label: 'V 皮繪製', short: 'V 皮', color: '#7CB342', tag: 'tag-v',
    subs: ['角色立繪', '服裝差分', '表情差分', '拆件繪製'],
    fields: [
      { key: 'framing', label: '構圖', type: 'select', options: ['全身', '半身'] },
      { key: 'outfits', label: '服裝差分數', type: 'number' },
      { key: 'exprs', label: '表情差分數', type: 'number' },
      { key: 'layered', label: '需要分層 PSD', type: 'checkbox' },
      { key: 'commercial', label: '含商用授權', type: 'checkbox' }
    ]
  }
};

/* ============ 狀態與儲存 ============ */
const KEY = 'fruit-studio-works-v1';
const SEED_KEY = 'fruit-studio-seeded';
let items = [];
let editingId = null;
let filterCat = 'all';
let toastTimer;

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(items)); }
  catch (e) { toast('瀏覽器無法儲存資料，請檢查儲存空間設定'); }
}
function wasSeeded() {
  try { return !!localStorage.getItem(SEED_KEY); } catch (e) { return true; }
}
function markSeeded() {
  try { localStorage.setItem(SEED_KEY, '1'); } catch (e) { /* ignore */ }
}

function seedItems() {
  const rows = [
    { category: '2d', sub: '大圖／大張插圖', name: 'Bloom 春季封面插圖', client: 'BL-014', status: '製作中', dueIn: 5,
      unitPrice: 3000, qty: 1, extra: 500, discount: 0, depositRate: 30, paid: 1000, estHours: 12, actHours: 7,
      detail: { size: '大（A3 以上）', complex: '複雜', commercial: true } },
    { category: '2d', sub: 'ICON', name: '遊戲道具 ICON 組', client: 'CT-203', status: '已完成', dueIn: -2,
      unitPrice: 300, qty: 5, extra: 200, discount: 0, depositRate: 30, paid: 1700, estHours: 5, actHours: 6,
      detail: { size: '小（A5 以下）', complex: '簡單', commercial: false } },
    { category: '3d', sub: '角色建模', name: 'Patch 主角模型', client: 'PO-007', status: '待確認', dueIn: 1,
      unitPrice: 8000, qty: 1, extra: 0, discount: 800, depositRate: 40, paid: 3200, estHours: 40, actHours: 44,
      detail: { model: '完成', uv: '完成', tex: '進行中' } },
    { category: 'live2d', sub: '完整建模', name: 'Honey 助手 Live2D', client: 'HN-021', status: '待製作', dueIn: 12,
      unitPrice: 12000, qty: 1, extra: 0, discount: 0, depositRate: 50, paid: 0, estHours: 60, actHours: 0,
      detail: { psdOk: true, physics: true, exprCount: 8 } },
    { category: 'v', sub: '角色立繪', name: 'Mara 原創角色立繪', client: 'MW-001', status: '製作中', dueIn: 3,
      unitPrice: 4500, qty: 1, extra: 600, discount: 0, depositRate: 30, paid: 1500, estHours: 15, actHours: 9,
      detail: { framing: '半身', outfits: 2, exprs: 4, layered: true, commercial: false } },
    { category: 'v', sub: '服裝差分', name: 'Citrus 服裝差分包', client: 'CT-118', status: '待製作', dueIn: 20,
      unitPrice: 1200, qty: 3, extra: 0, discount: 300, depositRate: 30, paid: 0, estHours: 10, actHours: 0,
      detail: { framing: '全身', outfits: 3, exprs: 0, layered: true, commercial: false } }
  ];
  return rows.map((r, i) => {
    const { dueIn, ...rest } = r;
    return { id: 'demo' + i, createdAt: Date.now() - i * 3600000, note: '', ...rest, due: dayStr(dueIn) };
  });
}

/* ============ Process：計算 ============ */
function calc(d) {
  const sub = d.unitPrice * d.qty;
  const total = Math.max(0, sub + d.extra - d.discount);
  const deposit = Math.round(total * d.depositRate / 100);
  const balance = Math.max(0, total - d.paid);
  const payStatus = total > 0 && d.paid >= total ? '已收清' : d.paid > 0 ? '部分收款' : '未收款';
  const rate = d.actHours > 0 ? d.paid / d.actHours : null;
  return { sub, total, deposit, balance, payStatus, rate };
}

function diffText(act, est) {
  if (!(act > 0)) return '—';
  const d = Math.round((act - est) * 10) / 10;
  if (d > 0) return `超時 +${d} h`;
  if (d < 0) return `提早 ${Math.abs(d)} h`;
  return '準時';
}

function validate(d) {
  const c = calc(d);
  const errs = [];
  const add = (cond, id, msg) => { if (cond) errs.push([id, msg]); };
  add(!d.name, 'f_name', '請填寫工作名稱');
  add(d.unitPrice < 0, 'f_price', '單價不可為負數');
  add(d.qty < 1, 'f_qty', '數量至少要為 1');
  add(d.extra < 0, 'f_extra', '額外費用不可為負數');
  add(d.discount < 0, 'f_discount', '折扣不可為負數');
  add(d.discount > d.unitPrice * d.qty + d.extra, 'f_discount', '折扣不可超過小計加額外費用');
  add(d.depositRate < 0 || d.depositRate > 100, 'f_deposit', '訂金比例請填 0 到 100');
  add(d.paid < 0, 'f_paid', '已收款不可為負數');
  add(d.paid > c.total, 'f_paid', '已收款不可超過總報價');
  add(d.estHours < 0, 'f_est', '預估工時不可為負數');
  add(d.actHours < 0, 'f_act', '實際工時不可為負數');
  add(d.detail.size === '自訂尺寸' && !(d.detail.sizeW > 0 && d.detail.sizeH > 0), 'd_sizeW', '請填寫自訂尺寸的寬與高');
  Object.entries(d.detail).forEach(([k, v]) => add(typeof v === 'number' && v < 0, 'd_' + k, '數量欄位不可為負數'));
  return errs;
}

/* ============ Input：讀取與填入表單 ============ */
function readForm() {
  const cat = $('f_category').value;
  const detail = {};
  CATS[cat].fields.forEach(f => {
    const el = $('d_' + f.key);
    if (!el) return;
    detail[f.key] = f.type === 'checkbox' ? el.checked
                  : f.type === 'number' ? toNum(el.value)
                  : el.value;
  });
  if (detail.size === '自訂尺寸') {
    detail.sizeW = toNum($('d_sizeW').value);
    detail.sizeH = toNum($('d_sizeH').value);
    detail.sizeUnit = $('d_sizeUnit').value;
  }
  return {
    category: cat,
    sub: $('f_sub').value,
    name: $('f_name').value.trim(),
    client: $('f_client').value.trim(),
    status: $('f_status').value,
    due: $('f_due').value,
    unitPrice: toNum($('f_price').value),
    qty: toNum($('f_qty').value),
    extra: toNum($('f_extra').value),
    discount: toNum($('f_discount').value),
    depositRate: toNum($('f_deposit').value),
    paid: toNum($('f_paid').value),
    estHours: toNum($('f_est').value),
    actHours: toNum($('f_act').value),
    note: $('f_note').value.trim(),
    detail
  };
}

function renderSubs(cat, selected) {
  $('f_sub').innerHTML = CATS[cat].subs.map(s => `<option>${s}</option>`).join('');
  if (selected && CATS[cat].subs.includes(selected)) $('f_sub').value = selected;
}

function customSizeRow(values = {}) {
  const row = document.createElement('div');
  row.id = 'customSize';
  row.className = 'field full custom-size';
  row.innerHTML = `<label>自訂尺寸</label>
    <div class="size-inputs">
      <input type="number" min="0" step="0.1" id="d_sizeW" placeholder="寬" value="${values.sizeW ?? ''}">
      <span>×</span>
      <input type="number" min="0" step="0.1" id="d_sizeH" placeholder="高" value="${values.sizeH ?? ''}">
      <select id="d_sizeUnit">
        <option ${values.sizeUnit === 'cm' ? 'selected' : ''}>cm</option>
        <option ${values.sizeUnit === 'px' ? 'selected' : ''}>px</option>
        <option ${values.sizeUnit === '吋' ? 'selected' : ''}>吋</option>
      </select>
    </div>`;
  row.classList.toggle('hidden', values.size !== '自訂尺寸');
  return row;
}

function renderDetails(cat, values = {}) {
  const wrap = $('detailFields');
  wrap.innerHTML = '';
  $('detailTitle').textContent = CATS[cat].label + ' 專用欄位';
  CATS[cat].fields.forEach(f => {
    const id = 'd_' + f.key;
    const div = document.createElement('div');
    if (f.type === 'checkbox') {
      div.className = 'field check';
      div.innerHTML = `<label><input type="checkbox" id="${id}" ${values[f.key] ? 'checked' : ''}>${f.label}</label>`;
    } else if (f.type === 'select') {
      div.className = 'field';
      const opts = f.options.map(o => `<option ${values[f.key] === o ? 'selected' : ''}>${o}</option>`).join('');
      div.innerHTML = `<label for="${id}">${f.label}</label><select id="${id}">${opts}</select>`;
    } else {
      div.className = 'field';
      div.innerHTML = `<label for="${id}">${f.label}</label><input type="number" min="0" id="${id}" value="${values[f.key] ?? 0}">`;
    }
    wrap.appendChild(div);
    if (f.key === 'size') wrap.appendChild(customSizeRow(values));
  });
}

function fillForm(d = {}) {
  const cat = d.category || '2d';
  $('f_category').value = cat;
  renderSubs(cat, d.sub);
  renderDetails(cat, d.detail || {});
  $('f_name').value = d.name || '';
  $('f_client').value = d.client || '';
  $('f_status').value = d.status || '待製作';
  $('f_due').value = d.due || '';
  $('f_price').value = d.unitPrice ?? '';
  $('f_qty').value = d.qty ?? 1;
  $('f_extra').value = d.extra ?? 0;
  $('f_discount').value = d.discount ?? 0;
  $('f_deposit').value = d.depositRate ?? 30;
  $('f_paid').value = d.paid ?? 0;
  $('f_est').value = d.estHours ?? '';
  $('f_act').value = d.actHours ?? '';
  $('f_note').value = d.note || '';
  showErrors([]);
  updateQuote();
}

function resetForm() {
  editingId = null;
  $('formTitle').textContent = '新增工作';
  $('btnSubmit').textContent = '新增工作';
  fillForm({});
}

function showErrors(errs) {
  document.querySelectorAll('.field.invalid').forEach(el => el.classList.remove('invalid'));
  const box = $('errorBox');
  box.innerHTML = '';
  if (!errs.length) {
    box.classList.add('hidden');
    return true;
  }
  errs.forEach(([id, msg]) => {
    const f = $(id) && $(id).closest('.field');
    if (f) f.classList.add('invalid');
    const p = document.createElement('div');
    p.textContent = '⚠ ' + msg;
    box.appendChild(p);
  });
  box.classList.remove('hidden');
  return false;
}

/* ============ Output：報價區 ============ */
function updateQuote() {
  const d = readForm();
  const c = calc(d);
  $('q_sub').textContent = money(c.sub);
  $('q_extra').textContent = money(d.extra);
  $('q_discount').textContent = '− ' + money(d.discount);
  $('q_total').textContent = money(c.total);
  $('q_depLabel').textContent = `應收訂金（${d.depositRate}%）`;
  $('q_deposit').textContent = money(c.deposit);
  $('q_paid').textContent = money(d.paid);
  $('q_balance').textContent = money(c.balance);
  const pay = $('q_pay');
  pay.textContent = c.payStatus;
  pay.className = 'pill ' + PAY_CLS[c.payStatus];
  $('q_est').textContent = d.estHours + ' h';
  $('q_act').textContent = d.actHours > 0 ? d.actHours + ' h' : '尚無';
  $('q_diff').textContent = diffText(d.actHours, d.estHours);
  $('q_rate').textContent = c.rate === null ? '—' : money(c.rate) + ' / 小時';
}

/* ============ 增刪改 ============ */
function startEdit(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  editingId = id;
  fillForm(item);
  $('formTitle').textContent = '編輯工作';
  $('btnSubmit').textContent = '儲存變更';
  showView('form');
}

function removeItem(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  if (!confirm(`確定要刪除「${item.name}」？刪除後無法復原。`)) return;
  items = items.filter(i => i.id !== id);
  save();
  if (editingId === id) resetForm();
  renderAll();
  toast('已刪除工作');
}

/* ============ 畫面：總覽 ============ */
function renderDashboard() {
  const total = items.length;
  const done = items.filter(i => i.status === '已完成').length;
  const calcs = items.map(i => ({ i, c: calc(i) }));
  const balanceSum = sum(calcs.map(x => x.c.balance));
  const unpaidCount = calcs.filter(x => x.c.balance > 0).length;
  const withHours = items.filter(i => i.actHours > 0);
  const hrs = sum(withHours.map(i => i.actHours));
  const paidWithHours = sum(withHours.map(i => i.paid));
  const overdue = items.filter(isOverdue).length;

  $('st_total').textContent = total;
  $('st_total_sub').textContent = `進行中 ${total - done} 件`;
  $('st_done').textContent = done;
  $('st_done_sub').textContent = total ? `完成率 ${Math.round(done / total * 100)}%` : '尚無工作';
  $('st_balance').textContent = money(balanceSum);
  $('st_balance_sub').textContent = `未收款 ${unpaidCount} 件`;
  $('st_rate').textContent = hrs > 0 ? money(paidWithHours / hrs) : '—';
  $('st_rate_sub').textContent = hrs > 0 ? `依 ${hrs} 小時實際工時計算` : '尚無實際工時';

  const recent = [...items].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  $('recentBody').innerHTML = recent.length
    ? recent.map(i => {
        const cat = CATS[i.category];
        return `<tr>
          <td><div class="wname">${esc(i.name)}</div><div class="wsub">${esc(i.client) || '—'}${isOverdue(i) ? ' · 逾期' : ''}</div></td>
          <td><span class="tag ${cat.tag}">${cat.short}</span></td>
          <td>${esc(i.due) || '—'}</td>
          <td><span class="pill ${STATUS_CLS[i.status]}">${esc(i.status)}</span></td>
          <td class="r">${money(calc(i).total)}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="5" class="empty"><b>還沒有工作</b>按上方「新增工作」建立第一筆</td></tr>`;

  const max = Math.max(1, ...CAT_ORDER.map(k => items.filter(i => i.category === k).length));
  $('catBars').innerHTML = CAT_ORDER.map(k => {
    const list = items.filter(i => i.category === k);
    const amt = sum(list.map(i => calc(i).total));
    return `<div class="bar-row">
      <div class="bar-meta"><b><span class="dot" style="background:${CATS[k].color}"></span>${CATS[k].label}</b><small>${money(amt)}</small></div>
      <div class="track"><div class="fill" style="width:${list.length / max * 100}%;background:${CATS[k].color}"></div></div>
      <div class="bar-val">${list.length} 件</div>
    </div>`;
  }).join('');

  const counts = STATUSES.map(s => items.filter(i => i.status === s).length);
  const stops = [];
  if (total === 0) {
    stops.push('#EFE2CF 0% 100%');
  } else {
    let acc = 0;
    counts.forEach((n, idx) => {
      if (!n) return;
      const start = acc / total * 100;
      acc += n;
      stops.push(`${STATUS_COLOR[STATUSES[idx]]} ${start}% ${acc / total * 100}%`);
    });
  }
  $('donut').style.background = `conic-gradient(${stops.join(',')})`;
  $('donutPct').textContent = (total ? Math.round(done / total * 100) : 0) + '%';
  $('donutLegend').innerHTML = STATUSES.map((s, idx) =>
    `<li><span class="dot" style="background:${STATUS_COLOR[s]}"></span>${s}<b>${counts[idx]}</b></li>`
  ).join('');
}

/* ============ 畫面：清單 ============ */
function rowHtml(i) {
  const c = calc(i);
  const cat = CATS[i.category];
  return `<tr>
    <td><div class="wname">${esc(i.name)}</div><div class="wsub">${esc(i.sub)}${i.client ? ' · ' + esc(i.client) : ''}</div></td>
    <td><span class="tag ${cat.tag}">${cat.short}</span></td>
    <td>${esc(i.due) || '—'}${isOverdue(i) ? ' <span class="pill s-over">逾期</span>' : ''}</td>
    <td><span class="pill ${STATUS_CLS[i.status]}">${esc(i.status)}</span></td>
    <td class="r">${money(c.total)}</td>
    <td class="r">${money(c.balance)}</td>
    <td class="r">${diffText(i.actHours, i.estHours)}</td>
    <td class="actions">
      <button class="btn-small" data-action="edit" data-id="${i.id}">編輯</button>
      <button class="btn-small danger" data-action="del" data-id="${i.id}">刪除</button>
    </td>
  </tr>`;
}

function renderList() {
  const q = $('searchInput').value.trim().toLowerCase();
  const st = $('statusFilter').value;
  const list = items
    .filter(i => filterCat === 'all' || i.category === filterCat)
    .filter(i => st === 'all' || i.status === st)
    .filter(i => !q || (i.name + ' ' + i.client).toLowerCase().includes(q))
    .sort((a, b) => b.createdAt - a.createdAt);

  $('listBody').innerHTML = list.map(rowHtml).join('');
  $('listCount').textContent = `共 ${list.length} 件`;
  const empty = $('listEmpty');
  empty.classList.toggle('hidden', list.length > 0);
  empty.innerHTML = items.length === 0
    ? '<b>還沒有工作</b>到「新增工作」建立第一筆吧'
    : '<b>找不到符合條件的工作</b>試試調整搜尋或篩選條件';
  document.querySelectorAll('.chip').forEach(b => b.classList.toggle('active', b.dataset.cat === filterCat));
}

/* ============ 視圖切換與通知 ============ */
const VIEW_NAMES = { dashboard: '總覽', form: '新增工作', list: '工作清單', calendar: '行事曆' };
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('hidden', v.id !== 'view-' + name));
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  $('crumbPage').textContent = VIEW_NAMES[name];
  const now = new Date();
  $('crumbSub').textContent = name === 'dashboard' ? `${now.getFullYear()} 年 ${now.getMonth() + 1} 月` : '';
  if (name === 'calendar') renderCalendar();
  window.scrollTo(0, 0);
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

function renderAll() {
  renderDashboard();
  renderList();
  renderCalendar();
  $('navCount').textContent = items.length;
}

/* ============ 事件綁定 ============ */
document.querySelectorAll('[data-view]').forEach(b =>
  b.addEventListener('click', () => showView(b.dataset.view)));

document.querySelectorAll('[data-filter]').forEach(b =>
  b.addEventListener('click', () => {
    filterCat = b.dataset.filter;
    renderList();
    showView('list');
  }));

document.querySelectorAll('.chip').forEach(b =>
  b.addEventListener('click', () => { filterCat = b.dataset.cat; renderList(); }));

$('searchInput').addEventListener('input', renderList);
$('statusFilter').addEventListener('change', renderList);

$('listBody').addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  if (btn.dataset.action === 'edit') startEdit(btn.dataset.id);
  else removeItem(btn.dataset.id);
});

$('f_category').addEventListener('change', () => {
  const cat = $('f_category').value;
  renderSubs(cat);
  renderDetails(cat);
  updateQuote();
});
$('workForm').addEventListener('input', updateQuote);
$('workForm').addEventListener('change', e => {
  if (e.target.id === 'd_size') {
    document.getElementById('customSize').classList.toggle('hidden', e.target.value !== '自訂尺寸');
  }
});
const dueEl = $('f_due');
const openCalendar = () => { try { dueEl.showPicker(); } catch (err) { dueEl.focus(); } };
dueEl.addEventListener('click', openCalendar);
$('btnCal').addEventListener('click', openCalendar);

$('btnQuote').addEventListener('click', () => {
  const d = readForm();
  if (!showErrors(validate(d))) return;
  updateQuote();
  const card = $('quoteCard');
  card.classList.remove('flash');
  void card.offsetWidth;
  card.classList.add('flash');
  toast(`報價已計算：總報價 ${money(calc(d).total)}`);
});

$('btnClear').addEventListener('click', () => {
  resetForm();
  toast('表單已清除');
});

$('workForm').addEventListener('submit', e => {
  e.preventDefault();
  const d = readForm();
  if (!showErrors(validate(d))) return;

  if (editingId) {
    items = items.map(i => i.id === editingId ? { ...i, ...d } : i);
    toast('已儲存變更');
  } else {
    items.push({
      id: 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      createdAt: Date.now(),
      ...d
    });
    toast('已新增工作');
  }
  save();
  resetForm();
  renderAll();
  showView('list');
});

/* ============ 像素小鳥 Logo ============ */
// 像素圖：H 灰頭、W 眼圈白、K 黑眼、B 喙、G 綠身、g 深綠、L 淺綠高光
const BIRD = [
  "......HHHHHH",
  ".....HHHHHHHH",
  "....HHHHHHHHHH",
  "...HHWWWWHHHHH",
  "...HWWKKWHHHHH",
  "..HHWWKKWHHHHH",
  "..HHWWWWHHHHGG",
  "BBHHHHHHHHGGGG",
  "BBBHHHHGGGGGGG",
  ".BBBGGGGGGGGGG",
  "..GGGGGGGGGGLL",
  "..GGgGGGGGGGGG",
  "...GgGGGGGGGG",
  "...ggGGGGGGG"
];
function renderLogo() {
  const W = Math.max(...BIRD.map(r => r.length));
  const colors = { H: '#8A9A8C', W: '#FFFFFF', K: '#1F1F1F', B: '#3A3A3A', G: '#4CAF3A', g: '#2E7D32', L: '#9BD86B' };
  let rects = '';
  BIRD.forEach((row, y) => [...row.padEnd(W, '.')].forEach((ch, x) => {
    if (colors[ch]) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${colors[ch]}"/>`;
  }));
  $('logo').innerHTML = `<svg viewBox="0 0 ${W} ${BIRD.length}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

/* ============ 行事曆 ============ */
let calCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function renderCalendar() {
  const y = calCursor.getFullYear(), m = calCursor.getMonth();
  $('calTitle').textContent = `${y} 年 ${m + 1} 月`;
  $('calWeekdays').innerHTML = WEEKDAYS.map(w => `<div class="cal-wd">${w}</div>`).join('');

  const offset = (new Date(y, m, 1).getDay() + 6) % 7;   // 週一為第一欄
  const byDate = {};
  items.forEach(i => {
    if (!i.due) return;
    if (!byDate[i.due]) byDate[i.due] = [];
    byDate[i.due].push(i);
  });
  const todayKey = ymd(new Date());

  let html = '';
  for (let n = 0; n < 42; n++) {
    const d = new Date(y, m, 1 - offset + n);
    const key = ymd(d);
    const list = (byDate[key] || []).sort((a, b) => a.createdAt - b.createdAt);
    const cls = ['cal-cell'];
    if (d.getMonth() !== m) cls.push('other');
    if (key === todayKey) cls.push('today');
    const events = list.slice(0, 3).map(i => {
      const cat = CATS[i.category];
      const fg = i.category === 'live2d' ? '#4B2E26' : '#fff';
      return `<button class="cal-ev" style="background:${cat.color};color:${fg}" data-id="${i.id}" title="${esc(i.name)}">${cat.short} · ${esc(i.name)}</button>`;
    }).join('');
    const more = list.length > 3 ? `<div class="cal-more">+${list.length - 3} 件</div>` : '';
    html += `<div class="${cls.join(' ')}"><div class="cal-num">${d.getDate()}</div>${events}${more}</div>`;
  }
  $('calDays').innerHTML = html;
}

$('calPrev').addEventListener('click', () => { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1); renderCalendar(); });
$('calNext').addEventListener('click', () => { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1); renderCalendar(); });
$('calToday').addEventListener('click', () => { const t = new Date(); calCursor = new Date(t.getFullYear(), t.getMonth(), 1); renderCalendar(); });
$('calDays').addEventListener('click', e => {
  const btn = e.target.closest('.cal-ev');
  if (btn) startEdit(btn.dataset.id);
});

/* ============ 初始化 ============ */
function init() {
  $('f_category').innerHTML = CAT_ORDER.map(k => `<option value="${k}">${CATS[k].label}</option>`).join('');
  $('f_status').innerHTML = STATUSES.map(s => `<option>${s}</option>`).join('');
  $('statusFilter').innerHTML = '<option value="all">全部狀態</option>' +
    STATUSES.map(s => `<option>${s}</option>`).join('');

  items = load();
  if (!items.length && !wasSeeded()) {
    items = seedItems();
    save();
    markSeeded();
  }
  renderLogo();
  resetForm();
  renderAll();
  showView('dashboard');
}
init();
