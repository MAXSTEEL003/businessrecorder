/* =============================================
   BUSINESS RECORDS MANAGER — app.js  (v7 Vite + Firebase)
   ============================================= */

import {
  initFirebase, onAuthStateChanged, signOut,
  recordsCol, recordDoc,
  addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy
} from './firebase.js';

// ─── Firebase state ───
let _db = null, _uid = null, _unsubRecords = null;

function initApp() {
  const { auth, db } = initFirebase();
  _db = db;

  onAuthStateChanged(auth, user => {
    if (!user) { location.replace('./login.html'); return; }
    _uid = user.uid;

    // Wire logout button
    document.querySelectorAll('[data-action=logout]').forEach(btn =>
      btn.addEventListener('click', () => signOut(auth).then(() => location.replace('./login.html'))));

    // Real-time listener
    if (_unsubRecords) _unsubRecords();
    const col = recordsCol(db, _uid);
    _unsubRecords = onSnapshot(query(col, orderBy('date', 'desc')), snap => {
      records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      records.forEach(applyAutoCalc);
      // Only re-render if no cell is currently being edited
      if (!activeCell) {
        renderTable();
        updateStats();
      }
    });

    // CRUD helpers
    window._fbSave = async (r) => {
      if (r._isNew) {
        const { _isNew, id, ...data } = r;
        const ref = await addDoc(col, data);
        r.id = ref.id;
        delete r._isNew;
      } else {
        const { id, _isNew: _drop, ...data } = r;
        await updateDoc(recordDoc(db, _uid, id), data);
      }
    };
    window._fbDelete = async (id) => {
      await deleteDoc(recordDoc(db, _uid, id));
    };
  });
}

initApp();

// ─────────────────────────────────────────────
// COLUMN DEFINITIONS
// Each entry: { key, label, type, align, editable, auto }
// ─────────────────────────────────────────────
const COLS = [
  { key: 'date', label: 'Date', type: 'date', editable: true },
  { key: 'millerName', label: 'Miller Name', type: 'text', editable: true, autocomplete: true },
  { key: 'place', label: 'Place', type: 'text', editable: true, autocomplete: true },
  { key: 'brand', label: 'Brand', type: 'text', editable: true, autocomplete: true },
  { key: 'shopName', label: 'Shop Name', type: 'text', editable: true, autocomplete: true },
  { key: 'noOfDays', label: 'No of Days', type: 'text', editable: false, auto: true },
  { key: 'noOfDayRec', label: 'No of Day Rec', type: 'text', editable: false, auto: true },
  { key: 'area', label: 'Area', type: 'text', editable: true, autocomplete: true },
  { key: 'billNo', label: 'Bill No', type: 'text', editable: true },
  { key: 'qty', label: 'QTY', type: 'number', editable: true, align: 'right' },
  { key: 'rate', label: 'Rate', type: 'number', editable: true, align: 'right' },
  { key: 'amount', label: 'Amount', type: 'number', editable: false, align: 'right', auto: true },
  { key: 'lr', label: 'L.R.', type: 'number', editable: true, align: 'right' },
  {
    key: 'ccPct', label: 'C.C.%', type: 'select', editable: true,
    options: ['', '1%', '2%', '3%', '4%'], title: 'Select C.C. percentage of Amount'
  },
  { key: 'cc', label: 'C.C. Amt', type: 'number', editable: false, align: 'right', auto: true },
  { key: 'tds', label: 'TDS', type: 'number', editable: true, align: 'right' },
  { key: 'shortage', label: 'Shortage', type: 'number', editable: true, align: 'right' },
  { key: 'seller', label: 'Seller Com', type: 'number', editable: true, align: 'right' },
  { key: 'netAmt', label: 'Net Amt', type: 'number', editable: false, align: 'right', auto: true },
  { key: 'diffIn', label: 'Diff. in', type: 'number', editable: false, align: 'right', auto: true },
  { key: 'chqAmt', label: 'Chq Amt', type: 'number', editable: true, align: 'right' },
  { key: 'chqNo', label: 'Chq No.', type: 'text', editable: true },
  { key: 'paymentDate', label: 'Payment Date', type: 'date', editable: true },
  { key: 'bank', label: 'Bank', type: 'text', editable: true, autocomplete: true },
  { key: 'status', label: 'Status', type: 'text', editable: false, auto: true },
  { key: '_whatsapp', label: 'WhatsApp', type: 'whatsapp', editable: false },
];


// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
const STORE_KEY = 'bizRecords_v3';
let records = [];
let deleteId = null;
let sortCol = 'date';
let sortDir = 1;

// ─────────────────────────────────────────────
// PERSIST  (localStorage fallback only)
// ─────────────────────────────────────────────
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(records)); }
function save_local() { save(); renderTable(); updateStats(); }
function load_local() { try { records = JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { records = []; } records.forEach(applyAutoCalc); }

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function fmt(n) {
  if (n === null || n === undefined || n === '') return '';
  const num = parseFloat(n);
  return isNaN(num) ? '' : num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showToast(msg, type = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (type === 'error' ? ' toast-error' : type === 'warn' ? ' toast-warn' : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2600);
}

function daysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  if (isNaN(d1) || isNaN(d2)) return null;
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

// Returns today as YYYY-MM-DD (local time)
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// How many days since the record date (to today), null if invalid
function pendingDays(r) {
  const d = normaliseDate(r.date);
  if (!d) return null;
  return daysBetween(d, todayStr());
}

// Color class based on payment and age
// GREEN: paid, YELLOW: pending ≤30 days, RED: pending >30 days
function rowColorClass(r) {
  if (r.paymentDate) return 'row-green';   // paid
  const days = pendingDays(r);
  if (days === null) return '';
  if (days <= 30) return 'row-yellow';
  return 'row-red';
}

// ─────────────────────────────────────────────
// AUTO-CALCULATE DERIVED FIELDS ON A RECORD
// ─────────────────────────────────────────────
function applyAutoCalc(r) {
  // 1. Amount = QTY × Rate
  const qty = parseFloat(r.qty) || 0;
  const rate = parseFloat(r.rate) || 0;
  r.amount = (qty && rate) ? (qty * rate).toFixed(2) : '';

  // 2. C.C. = ccPct% × Amount  (if ccPct dropdown selected)
  const amt = parseFloat(r.amount) || 0;
  if (r.ccPct) {
    const pct = parseFloat(r.ccPct) || 0;
    r.cc = amt ? (amt * pct / 100).toFixed(2) : '';
  }

  // 3. Net Amt = Amount − L.R − C.C − Seller Commission
  const lr = parseFloat(r.lr) || 0;
  const cc = parseFloat(r.cc) || 0;
  const seller = parseFloat(r.seller) || 0;
  r.netAmt = amt ? (amt - lr - cc - seller).toFixed(2) : '';

  // 4. Diff. in = Chq Amount − Net Amount  (auto)
  const netAmt = parseFloat(r.netAmt) || 0;
  const chqAmt = parseFloat(r.chqAmt) || 0;
  r.diffIn = (chqAmt || netAmt) ? (chqAmt - netAmt).toFixed(2) : '';

  // 5. No of Days / No of Day Rec / Status
  if (r.paymentDate && r.date) {
    const pd = normaliseDate(r.paymentDate);
    const d = normaliseDate(r.date);
    const days = daysBetween(d, pd);
    if (days !== null) {
      r.noOfDays = 'Cleared';
      r.noOfDayRec = days + (days === 1 ? ' day' : ' days');
      r.status = 'Cleared';
    }
  } else {
    const d = normaliseDate(r.date);
    const elapsed = d ? daysBetween(d, todayStr()) : null;
    r.noOfDays = elapsed !== null ? elapsed + (elapsed === 1 ? ' DAY PENDING' : ' DAYS PENDING') : '';
    r.noOfDayRec = 'PAYMENT NOT RECD';
    r.status = r.noOfDays || 'PAYMENT NOT RECD';
  }
}

// Normalise DD-MM-YYYY → YYYY-MM-DD, leave YYYY-MM-DD as-is
function normaliseDate(s) {
  if (!s) return s;
  // DD-MM-YYYY or DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s; // assume YYYY-MM-DD from <input type="date">
}

// ─────────────────────────────────────────────
// FILTER / SORT
// ─────────────────────────────────────────────
function getFilteredSorted() {
  const q = document.getElementById('searchBox').value.trim().toLowerCase();
  const status = document.getElementById('filterStatus').value;
  const from = document.getElementById('filterFrom').value;
  const to = document.getElementById('filterTo').value;

  let list = records.filter(r => {
    if (q) {
      const hay = [r.millerName, r.brand, r.shopName, r.area, r.place, r.seller].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (status) {
      if (status === 'PENDING') {
        // Match any "X DAYS PENDING" or "PAYMENT NOT RECD" — anything not Cleared
        if (r.status === 'Cleared') return false;
      } else {
        if (r.status !== status) return false;
      }
    }
    if (from && r.date < from) return false;
    if (to && r.date > to) return false;
    return true;
  });

  const numFields = ['qty', 'rate', 'amount', 'tds', 'shortage', 'diffIn', 'netAmt', 'chqAmt'];
  list.sort((a, b) => {
    let va = a[sortCol] ?? '', vb = b[sortCol] ?? '';
    if (numFields.includes(sortCol)) { va = parseFloat(va) || 0; vb = parseFloat(vb) || 0; }
    else { va = String(va).toLowerCase(); vb = String(vb).toLowerCase(); }
    return va < vb ? -sortDir : va > vb ? sortDir : 0;
  });
  return list;
}

// ─────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────
function updateStats() {
  const unpaid = records.filter(r => !r.paymentDate);
  const paid = records.filter(r => r.paymentDate);

  const totAmt = records.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const totNet = records.reduce((s, r) => s + (parseFloat(r.netAmt) || 0), 0);
  const totChq = records.reduce((s, r) => s + (parseFloat(r.chqAmt) || 0), 0);
  const totCC = records.reduce((s, r) => s + (parseFloat(r.cc) || 0), 0);
  const totSeller = records.reduce((s, r) => s + (parseFloat(r.seller) || 0), 0);
  const totComm = totCC + totSeller;
  const pendingAmt = unpaid.reduce((s, r) => s + (parseFloat(r.netAmt) || 0), 0);

  // Average pending days (only unpaid records with a date)
  const pendDays = unpaid.map(r => { const d = normaliseDate(r.date); return d ? daysBetween(d, todayStr()) : null; }).filter(x => x !== null);
  const avgDays = pendDays.length ? Math.round(pendDays.reduce((a, b) => a + b, 0) / pendDays.length) : 0;

  const fmtStat = n => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  document.getElementById('statTotal').textContent = records.length;
  document.getElementById('statPending').textContent = unpaid.length;
  document.getElementById('statCleared').textContent = paid.length;
  document.getElementById('statAmount').textContent = fmtStat(totAmt);
  document.getElementById('statNet').textContent = fmtStat(totNet);
  document.getElementById('statPendAmt').textContent = fmtStat(pendingAmt);
  document.getElementById('statAvgDays').textContent = avgDays + ' days';
  document.getElementById('statComm').textContent = fmtStat(totComm);
  document.getElementById('statChq').textContent = fmtStat(totChq);
}

// ─────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────
function statusBadge(s) {
  if (!s) return '<span class="badge badge-other">—</span>';
  if (s === 'Cleared') return `<span class="badge badge-cleared">${s}</span>`;
  if (s === '21 DAYS PENDING') return `<span class="badge badge-pending">${s}</span>`;
  if (s === 'PAYMENT NOT RECD') return `<span class="badge badge-notrecd">${s}</span>`;
  return `<span class="badge badge-other">${s}</span>`;
}
// rowClass now uses dynamic color based on payment/pending age
function rowClass(r) { return rowColorClass(r); }

// ─────────────────────────────────────────────
// BUILD TABLE HEADER
// ─────────────────────────────────────────────
function buildHeader() {
  const tr = document.querySelector('#recordsTable thead tr');
  tr.innerHTML = `<th class="col-actions sticky-col">Actions</th><th class="sl-col">#</th>`;
  COLS.forEach(c => {
    const sortable = (c.key === 'date' || c.key === 'millerName') ? 'sortable' : '';
    const align = c.align === 'right' ? 'num-col' : '';
    const autoMark = c.auto ? '<span class="auto-mark" title="Auto-calculated">⚡</span>' : '';
    const pctMark = c.key === 'ccPct' ? ' <span class="auto-mark" title="Select % to auto-fill C.C. amount">%</span>' : '';
    tr.innerHTML += `<th class="${sortable} ${align}" data-col="${c.key}">${c.label}${autoMark}${pctMark}</th>`;
  });

  // Bind sort
  tr.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      sortCol = (sortCol === col) ? sortCol : col;
      sortDir = (sortCol === col && sortDir === 1) ? -1 : (sortCol !== col ? 1 : -sortDir);
      sortCol = col;
      renderTable();
    });
  });
}

// ─────────────────────────────────────────────
// RENDER TABLE (read-only view with click-to-edit)
// ─────────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('tableBody');
  const list = getFilteredSorted();
  const empty = document.getElementById('emptyState');

  if (!list.length) {
    tbody.innerHTML = '';
    empty.classList.add('show');
    updateStats();
    return;
  }
  empty.classList.remove('show');

  tbody.innerHTML = list.map((r, idx) => {
    const cells = COLS.map(c => {
      // WhatsApp special column
      if (c.key === '_whatsapp') {
        return `<td class="wa-cell" data-id="${r.id}" data-key="_whatsapp">
          <button class="wa-btn" onclick="sendWhatsApp('${r.id}')" title="Send payment reminder via WhatsApp">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.563 4.14 1.548 5.874L0 24l6.337-1.524A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.78 9.78 0 01-5.065-1.413l-.363-.217-3.764.906.953-3.668-.237-.378A9.826 9.826 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/></svg>
            Send
          </button>
        </td>`;
      }

      // ccPct — special coloured display
      if (c.key === 'ccPct') {
        const val = r.ccPct || '';
        return `<td class="editable-cell cc-pct-cell" title="Click to select C.C.%" data-id="${r.id}" data-key="ccPct">${val ? `<span class="cc-pct-badge">${val}</span>` : '<span class="cell-empty">—</span>'}</td>`;
      }

      const val = r[c.key];
      const align = c.align === 'right' ? 'num-cell' : '';
      const autoClass = c.auto ? 'auto-cell' : '';
      const editClass = (!c.auto && c.editable) ? 'editable-cell' : '';
      const title = (!c.auto && c.editable) ? 'title="Click to edit"' : (c.auto ? 'title="Auto-calculated"' : '');

      let display;
      if (c.key === 'status') {
        display = statusBadge(val);
      } else if (c.key === 'noOfDays') {
        if (!val) { display = '<span class="cell-empty">—</span>'; }
        else if (val === 'Cleared') { display = `<span class="days-cleared">✅ Cleared</span>`; }
        else {
          const days = parseInt(val);
          const cls = days > 30 ? 'days-red' : 'days-yellow';
          display = `<span class="${cls}">${escHtml(val)}</span>`;
        }
      } else if (c.key === 'noOfDayRec') {
        display = val ? `<span class="${val === 'PAYMENT NOT RECD' ? 'days-notrecd' : 'days-cleared'}">${escHtml(val)}</span>` : '<span class="cell-empty">—</span>';
      } else if (c.align === 'right') {
        display = fmt(val) || '<span class="cell-empty">—</span>';
      } else {
        display = val ? escHtml(String(val)) : '<span class="cell-empty">—</span>';
      }

      return `<td class="${align} ${autoClass} ${editClass}" ${title} data-id="${r.id}" data-key="${c.key}">${display}</td>`;
    });

    return `<tr class="${rowClass(r)}" data-id="${r.id}">
      <td class="sticky-col">
        <div class="action-btns">
          <button class="act-btn act-add-row" onclick="addRowBelow('${r.id}')" title="Insert row below">＋</button>
          <button class="act-btn act-del" onclick="openDelete('${r.id}')" title="Delete row">🗑</button>
        </div>
      </td>
      <td class="sl-cell">${idx + 1}</td>
      ${cells.join('')}
    </tr>`;
  }).join('');

  updateStats();
  attachCellClickHandlers();
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────
// INLINE EDITING
// ─────────────────────────────────────────────
let activeCell = null;

function attachCellClickHandlers() {
  document.querySelectorAll('td.editable-cell').forEach(td => {
    td.addEventListener('click', onCellClick);
  });
}

function onCellClick(e) {
  const td = e.currentTarget;
  if (td.querySelector('input,select,textarea')) return; // already editing
  commitActive(); // commit any other open cell first
  activateCell(td);
}

function activateCell(td) {
  activeCell = td;
  const id = td.dataset.id;
  const key = td.dataset.key;
  const r = records.find(x => x.id === id);
  if (!r) return;

  const colDef = COLS.find(c => c.key === key);
  const val = r[key] ?? '';

  td.classList.add('editing');
  td.dataset.origVal = val;

  let input;
  if (colDef.type === 'select') {
    input = document.createElement('select');
    input.innerHTML = `<option value="">—</option>` +
      colDef.options.map(o => `<option value="${o}"${val === o ? ' selected' : ''}>${o}</option>`).join('');
  } else if (colDef.type === 'date') {
    input = document.createElement('input');
    input.type = 'date';
    input.value = normaliseDate(val) || '';
  } else if (colDef.type === 'number') {
    input = document.createElement('input');
    input.type = 'number';
    input.step = '0.01';
    input.value = val;
  } else {
    // text — with optional autocomplete
    input = document.createElement('input');
    input.type = 'text';
    input.value = val;
    input.setAttribute('autocomplete', 'off');

    if (colDef.autocomplete) {
      // Show suggestions after 4 chars
      input.addEventListener('input', () => {
        const q = input.value;
        if (q.length >= 4) {
          const suggestions = getAutocompleteSuggestions(key, q);
          if (suggestions.length) { showAutocomplete(td, input, suggestions, key, id); return; }
        }
        hideAutocomplete();
      });
    }
  }

  input.className = 'cell-input';
  td.innerHTML = '';
  td.appendChild(input);
  
  // Aggressive focus and selection - multiple approaches to ensure focus
  input.focus();
  input.click(); // Ensure the element can receive events
  
  setTimeout(() => {
    input.focus();
  }, 0);
  
  requestAnimationFrame(() => {
    input.focus();
    if (input.type !== 'date' && input.type !== 'number' && input.select) {
      input.select();
    } else if (input.type === 'number') {
      input.select();
    }
  });

  // Commit on blur with short delay for dropdown interaction
  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (activeCell === td) commitCell(td, id, key);
    }, 100);
  });

  // ===== KEYBOARD NAVIGATION =====
  input.addEventListener('keydown', e => {
    const navKeys = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab', 'Home', 'End', 'Escape'];
    if (!navKeys.includes(e.key)) return; // Not a nav key, let it through
    
    // *** CRITICAL: Prevent ALL default behavior immediately ***
    e.preventDefault();
    e.stopPropagation();
    
    // Handle autocomplete first (if open)
    const acDrop = document.getElementById('ac-dropdown');
    if (acDrop && !acDrop.classList.contains('hidden')) {
      if (e.key === 'ArrowDown') {
        acMoveSelection(1);
        return;
      }
      if (e.key === 'ArrowUp') {
        acMoveSelection(-1);
        return;
      }
      if (e.key === 'Enter') {
        const sel = acDrop.querySelector('.ac-item.ac-active');
        if (sel) {
          acSelectValue(sel.textContent, key, id, td);
          return;
        }
        // No selection, fall through to normal Enter
      }
      if (e.key === 'Escape') {
        hideAutocomplete();
        return;
      }
    }
    
    // ===== NAVIGATION KEYS =====
    
    // Escape: cancel without saving
    if (e.key === 'Escape') {
      hideAutocomplete();
      cancelCell(td);
      return;
    }
    
    // For all other keys, commit first, then navigate
    const oldTd = td;
    commitCell(td, id, key);
    hideAutocomplete();
    
    // Delay navigation to give commitCell time to complete
    setTimeout(() => {
      if (e.key === 'Enter') {
        if (e.shiftKey) {
          navigateCell(oldTd, 1, 'down');  // Shift+Enter: down
        } else {
          navigateCell(oldTd, 1, 'right');  // Enter: right
        }
      }
      else if (e.key === 'Tab') {
        const dir = e.shiftKey ? -1 : 1;
        navigateCell(oldTd, dir, 'right');  // Tab: right
      }
      else if (e.key === 'ArrowDown') {
        navigateCell(oldTd, 1, 'down');
      }
      else if (e.key === 'ArrowUp') {
        navigateCell(oldTd, -1, 'down');
      }
      else if (e.key === 'ArrowRight') {
        navigateCell(oldTd, 1, 'right');
      }
      else if (e.key === 'ArrowLeft') {
        navigateCell(oldTd, -1, 'right');
      }
      else if (e.key === 'Home') {
        const cells = [...oldTd.closest('tr').querySelectorAll('td.editable-cell')];
        if (cells.length > 0) activateCell(cells[0]);
      }
      else if (e.key === 'End') {
        const cells = [...oldTd.closest('tr').querySelectorAll('td.editable-cell')];
        if (cells.length > 0) activateCell(cells[cells.length - 1]);
      }
    }, 120);  // 120ms gives Firebase and DOM time to update
  });  // NO capture phase - let normal event flow handle it
}

// ─────────────────────────────────────────────
// AUTOCOMPLETE
// ─────────────────────────────────────────────
function getAutocompleteSuggestions(key, query) {
  const q = query.toLowerCase();
  const seen = new Set();
  records.forEach(r => { if (r[key]) seen.add(r[key]); });
  return [...seen]
    .filter(v => v.toLowerCase().includes(q) && v.toLowerCase() !== q)
    .sort()
    .slice(0, 8);
}

let acActiveIndex = -1;

function showAutocomplete(td, input, suggestions, key, id) {
  hideAutocomplete();
  acActiveIndex = -1;

  const drop = document.createElement('div');
  drop.id = 'ac-dropdown';
  drop.className = 'ac-dropdown';

  suggestions.forEach((s, i) => {
    const item = document.createElement('div');
    item.className = 'ac-item';
    item.textContent = s;
    // Use mousedown so it fires before blur
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      acSelectValue(s, key, id, td);
    });
    drop.appendChild(item);
  });

  // Position below the cell
  const rect = td.getBoundingClientRect();
  drop.style.position = 'fixed';
  drop.style.left = rect.left + 'px';
  drop.style.top = (rect.bottom + 2) + 'px';
  drop.style.minWidth = Math.max(rect.width, 180) + 'px';

  document.body.appendChild(drop);
}

function hideAutocomplete() {
  const d = document.getElementById('ac-dropdown');
  if (d) d.remove();
  acActiveIndex = -1;
}

function acMoveSelection(step) {
  const items = document.querySelectorAll('#ac-dropdown .ac-item');
  if (!items.length) return;
  items.forEach(i => i.classList.remove('ac-active'));
  acActiveIndex = Math.max(0, Math.min(acActiveIndex + step, items.length - 1));
  items[acActiveIndex].classList.add('ac-active');
  items[acActiveIndex].scrollIntoView({ block: 'nearest' });
}

async function acSelectValue(val, key, id, td) {
  hideAutocomplete();
  const r = records.find(x => x.id === id);
  if (r) {
    const input = td.querySelector('input,select');
    if (input) {
      r[key] = val;
      applyAutoCalc(r);
      
      // Clear editing state immediately
      td.classList.remove('editing');
      const display = val ? escHtml(String(val)) : '<span class="cell-empty">—</span>';
      td.innerHTML = display;
      
      // Only clear activeCell if no other cell has been activated since
      if (activeCell === td) {
        activeCell = null;
      }
      
      try {
        await window._fbSave(r);
      } catch (err) {
        console.error('Firebase save error:', err);
      }
      // Don't call renderTable here - Firebase listener will handle it
    }
  }
}

async function commitCell(td, id, key) {
  const input = td.querySelector('input,select');
  if (!input) return;
  const val = input.value.trim();
  
  const r = records.find(x => x.id === id);
  if (!r) return;

  r[key] = val;
  applyAutoCalc(r);
  
  // Clear editing state immediately and remove input
  td.classList.remove('editing');
  // Store the original value back to the cell's HTML display
  const display = val ? escHtml(String(val)) : '<span class="cell-empty">—</span>';
  td.innerHTML = display;
  
  // Only clear activeCell if no other cell has been activated since
  if (activeCell === td) {
    activeCell = null;
  }
  
  try {
    await window._fbSave(r);
  } catch (err) {
    console.error('Firebase save error:', err);
    // Restore cell to display even on error
  }
  
  // Don't call renderTable here - Firebase listener will handle it
}

function cancelCell(td) {
  td.classList.remove('editing');
  // Restore the display value to the cell
  const val = td.dataset.origVal ?? '';
  const display = val ? escHtml(String(val)) : '<span class="cell-empty">—</span>';
  td.innerHTML = display;
  
  if (activeCell === td) {
    activeCell = null;
  }
  // Don't call renderTable - it's unnecessary and causes flickering
}

function commitActive() {
  if (!activeCell) return;
  const input = activeCell.querySelector('input,select');
  if (input) commitCell(activeCell, activeCell.dataset.id, activeCell.dataset.key);
}

// Navigate to adjacent editable cell
function navigateCell(currentTd, step, direction) {
  if (!currentTd || !currentTd.closest('tr')) return; // Safety check
  
  const row = currentTd.closest('tr');
  const tbody = currentTd.closest('tbody');
  if (!tbody) return; // Safety check
  
  const allRows = [...tbody.querySelectorAll('tr')];
  const rowIdx = allRows.indexOf(row);

  if (direction === 'right') {
    // find next editable sibling
    const cells = [...row.querySelectorAll('td.editable-cell')];
    const idx = cells.indexOf(currentTd);
    let next = cells[idx + step];
    
    // Wrap to next row if needed
    if (!next && step > 0 && rowIdx + 1 < allRows.length) {
      next = allRows[rowIdx + 1].querySelector('td.editable-cell');
    }
    
    // Wrap to previous row if moving left from first cell
    if (!next && step < 0 && rowIdx - 1 >= 0) {
      const prevRowCells = [...allRows[rowIdx - 1].querySelectorAll('td.editable-cell')];
      next = prevRowCells[prevRowCells.length - 1]; // Last cell of previous row
    }
    
    if (next) {
      activateCell(next);  // activateCell handles focus via requestAnimationFrame
    }
  } else {
    // up/down: same column in next/prev row
    const colIndex = [...row.children].indexOf(currentTd);
    const targetRow = allRows[rowIdx + step];
    if (!targetRow) return;
    const targetTd = [...targetRow.children][colIndex];
    if (targetTd && targetTd.classList.contains('editable-cell')) {
      activateCell(targetTd);  // activateCell handles focus via requestAnimationFrame
    }
  }
}

// Click outside commits
document.addEventListener('mousedown', e => {
  if (activeCell && !activeCell.contains(e.target)) {
    commitActive();
  }
});

// ─────────────────────────────────────────────
// ADD ROW (top button or insert below)
// ─────────────────────────────────────────────
function newEmptyRecord(afterId) {
  const today = new Date().toISOString().split('T')[0];
  const r = { id: uid(), _isNew: true, date: today };
  COLS.forEach(c => { if (!(c.key in r)) r[c.key] = ''; });
  applyAutoCalc(r);
  return r;
}

async function addRowTop() {
  const r = newEmptyRecord(null);
  await window._fbSave(r);
  // onSnapshot will refresh records & re-render automatically
  setTimeout(() => {
    const firstCell = document.querySelector('#tableBody tr:first-child td.editable-cell');
    if (firstCell) activateCell(firstCell);
  }, 400);
}

window.addRowBelow = async function (afterId) {
  commitActive();
  const r = newEmptyRecord(afterId);
  await window._fbSave(r);
  setTimeout(() => {
    // After Firestore onSnapshot re-renders, focus new row
    const rows = document.querySelectorAll('#tableBody tr');
    const idx = [...rows].findIndex(row => row.dataset.id === afterId);
    const targetRow = rows[idx + 1];
    if (targetRow) {
      const cell = targetRow.querySelector('td.editable-cell');
      if (cell) activateCell(cell);
    }
  }, 400);
};

// ─────────────────────────────────────────────
// WHATSAPP
// ─────────────────────────────────────────────
window.sendWhatsApp = function (id) {
  const r = records.find(x => x.id === id);
  if (!r) return;

  const daysInfo = r.noOfDays || '';
  const netAmt = r.netAmt ? '₹' + fmt(r.netAmt) : '—';
  const amount = r.amount ? '₹' + fmt(r.amount) : '—';

  const msg =
    `🔔 *PAYMENT REMINDER*

*Miller:* ${r.millerName || '—'}
*Shop:* ${r.shopName || '—'}
*Date:* ${r.date || '—'}
*Bill No:* ${r.billNo || '—'}
*Brand:* ${r.brand || '—'}
*Area:* ${r.area || '—'}
*QTY:* ${r.qty || '—'} | *Rate:* ${r.rate || '—'}
*Amount:* ${amount}
*Net Amount:* ${netAmt}
*Status:* ${daysInfo || 'PAYMENT PENDING'}

Kindly arrange the payment at the earliest. 🙏`;

  const url = 'https://wa.me/?text=' + encodeURIComponent(msg);
  window.open(url, '_blank');
};

// ─────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────
window.openDelete = function (id) {
  deleteId = id;
  document.getElementById('deleteOverlay').classList.remove('hidden');
};
function closeDelete() {
  document.getElementById('deleteOverlay').classList.add('hidden');
  deleteId = null;
}
document.getElementById('btnConfirmDelete').addEventListener('click', async () => {
  const id = deleteId;
  closeDelete();
  await window._fbDelete(id);
  // onSnapshot auto-refreshes the table
  showToast('🗑 Record deleted.', 'warn');
});
document.getElementById('btnCloseDelete').addEventListener('click', closeDelete);
document.getElementById('btnCancelDelete').addEventListener('click', closeDelete);
document.getElementById('deleteOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('deleteOverlay')) closeDelete();
});

// ─────────────────────────────────────────────
// UTILITY: DEBOUNCE
// ─────────────────────────────────────────────
function debounce(func, delay) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

// ─────────────────────────────────────────────
// SEARCH / FILTER
// ─────────────────────────────────────────────
// Debounce searchBox - only render if no cell is being edited
const debouncedRenderTable = debounce(() => { 
  if (!activeCell) {  // Only re-render if not editing a cell
    renderTable(); 
  }
}, 300);
document.getElementById('searchBox').addEventListener('input', debouncedRenderTable);
['filterStatus', 'filterFrom', 'filterTo'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => { 
    if (!activeCell) {  // Only re-render if not editing a cell
      renderTable(); 
    }
  });
});
document.getElementById('btnClearFilter').addEventListener('click', () => {
  ['searchBox', 'filterFrom', 'filterTo'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('filterStatus').value = '';
  if (!activeCell) renderTable();  // Only re-render if not editing a cell
});

// ─────────────────────────────────────────────
// ADD RECORD BUTTON  → top button now adds a blank row
// ─────────────────────────────────────────────
document.getElementById('btnAddRow').addEventListener('click', () => {
  commitActive();
  addRowTop();
});

// ─────────────────────────────────────────────
// CSV EXPORT
// ─────────────────────────────────────────────
const CSV_HEADERS = COLS.map(c => c.label);
const CSV_KEYS = COLS.map(c => c.key);

document.getElementById('btnExport').addEventListener('click', () => {
  if (!records.length) { showToast('No records to export!', 'warn'); return; }
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [
    CSV_HEADERS.map(esc).join(','),
    ...getFilteredSorted().map(r => CSV_KEYS.map(k => esc(r[k])).join(','))
  ];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `business_records_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✔ CSV exported!');
});

// ─────────────────────────────────────────────
// CSV IMPORT
// ─────────────────────────────────────────────
document.getElementById('btnImport').addEventListener('click', () => document.getElementById('importFile').click());

document.getElementById('importFile').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    const lines = ev.target.result.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) { showToast('Empty CSV!', 'error'); return; }
    let added = 0;
    const writes = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVRow(lines[i]);
      if (vals.length < 2) continue;
      const data = { id: uid() };
      CSV_KEYS.forEach((k, j) => { data[k] = (vals[j] ?? '').trim(); });
      applyAutoCalc(data);
      writes.push(window._fbSave(data));
      added++;
    }
    await Promise.all(writes);
    // onSnapshot auto-refreshes after Firestore writes
    showToast(`✔ Imported ${added} record(s)!`);
  };
  reader.readAsText(file);
  e.target.value = '';
});

function parseCSVRow(row) {
  const result = []; let cur = '', inQ = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (c === '"') { if (inQ && row[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
    else cur += c;
  }
  result.push(cur);
  return result;
}

// ─────────────────────────────────────────────
// MODAL (still needed for delete overlay only — "Add" modal removed)
// Keep the old modal hidden/remove its trigger from HTML
// ─────────────────────────────────────────────
// Hide the old modal since we removed it
const mo = document.getElementById('modalOverlay');
if (mo) mo.style.display = 'none';

// ─────────────────────────────────────────────
// KEYBOARD GLOBAL
// ─────────────────────────────────────────────
document.addEventListener('keydown', e => {
  // Only handle Escape at document level
  if (e.key === 'Escape') { 
    cancelCell(activeCell); 
    closeDelete(); 
  }
}, false);  // Normal event flow

// ─────────────────────────────────────────────
// SAMPLE DATA
// ─────────────────────────────────────────────
function loadSampleData() {
  const base = [
    {
      date: '2025-02-02', millerName: 'MAHENDRA RICE INDUSTRY', place: 'MIRYALGUDA', brand: 'KOLAM RST',
      shopName: 'HANUMAN TRADING CO', area: '4TR', billNo: '3650', qty: '38.16', rate: '3600',
      lr: '4204.2', cc: '', tds: '1369', shortage: '', seller: '', diffIn: '', chqAmt: '', chqNo: '-12',
      paymentDate: '', bank: 'nps', status: '21 DAYS PENDING'
    },
    {
      date: '2025-02-02', millerName: 'MAHENDRA RICE INDUSTRY', place: 'MIRYALGUDA', brand: 'KOLAM RST',
      shopName: 'SHARANBAS AVESHWARA TRADING CO', area: '4TR', billNo: '3680', qty: '40.16', rate: '3600',
      lr: '153519.8', cc: '8335.8', tds: '', shortage: '', seller: '', diffIn: '', chqAmt: '', chqNo: '',
      paymentDate: '2025-02-23', bank: '', status: ''
    },
    {
      date: '2025-02-02', millerName: 'SAITEJA FARBOILED RICE MILLS', place: 'MIRYALGUDA', brand: 'HMT ST',
      shopName: 'VIRANI TRADING CO', area: 'BTH', billNo: '1498', qty: '20.0', rate: '5760',
      lr: '4360', cc: '', tds: '', shortage: '', seller: '', diffIn: '', chqAmt: '', chqNo: '',
      paymentDate: '', bank: '', status: 'PAYMENT NOT RECD'
    },
    {
      date: '2025-02-02', millerName: 'NEERAGI AGROS', place: 'DELHI', brand: 'ELMURAZ',
      shopName: 'MAHAVIR ENTERPRISES', area: 'BDA', billNo: '7.707', qty: '57', rate: '7300',
      lr: '6.960', cc: '', tds: '', shortage: '', seller: '', diffIn: '', chqAmt: '', chqNo: '',
      paymentDate: '', bank: '', status: '21 DAYS PENDING'
    },
  ];
  records = base.map(d => { const r = { id: uid(), noOfDays: '', noOfDayRec: '', amount: '', netAmt: '', ...d }; applyAutoCalc(r); return r; });
}

// ─────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────
// Data comes from Firestore onSnapshot (set up in initApp above).
// buildHeader runs once here; renderTable is called by onSnapshot.
buildHeader();
// Show loading state until first snapshot arrives
document.getElementById('emptyState').classList.add('show');
document.getElementById('emptyState').innerHTML =
  '<div class="empty-icon">⏳</div><p>Connecting to Firestore…</p>';
