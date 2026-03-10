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

async function initApp() {
  const { auth, db } = await initFirebase();
  _db = db;

  // Check if Firebase is properly configured
  if (!db) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
      z-index: 10000; font-family: system-ui;
    `;
    errorDiv.innerHTML = `
      <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 600px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <h2 style="color: #dc2626; margin-top: 0;">Firebase Not Configured ⚠️</h2>
        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          Firebase environment variables are not set. The app cannot function without them.
        </p>
        <div style="background: #f3f4f6; padding: 1rem; border-radius: 8px; text-align: left; font-size: 13px; margin: 1rem 0; color: #374151;">
          <strong>🚀 Quick Setup (Vercel):</strong><br>
          1. Go to <a href="https://vercel.com/dashboard" target="_blank" style="color: #0066cc;">Vercel Dashboard</a><br>
          2. Project Settings → Environment Variables<br>
          3. Add <strong>VITE_FIREBASE_*</strong> variables from Firebase Console<br>
          4. Click Redeploy
        </div>
        <div style="background: #f3f4f6; padding: 1rem; border-radius: 8px; text-align: left; font-size: 13px; color: #374151;">
          <strong>💻 Local Development:</strong><br>
          1. Create <code style="background: #e5e7eb; padding: 0.2rem 0.4rem; border-radius: 4px;">.env.local</code><br>
          2. Copy from <code style="background: #e5e7eb; padding: 0.2rem 0.4rem; border-radius: 4px;">.env.example</code><br>
          3. Restart: <code style="background: #e5e7eb; padding: 0.2rem 0.4rem; border-radius: 4px;">npm run dev</code>
        </div>
        <p style="color: #999; font-size: 12px; margin-bottom: 0;">
          <a href="https://github.com/MAXSTEEL003/businessrecorder#setup" target="_blank" style="color: #0066cc;">View full setup guide</a>
        </p>
      </div>
    `;
    document.body.innerHTML = '';
    document.body.appendChild(errorDiv);
    return;
  }

  onAuthStateChanged(auth, user => {
    if (!user) { location.replace('./login.html'); return; }
    _uid = user.uid;

    // Wire logout button
    document.querySelectorAll('[data-action=logout]').forEach(btn =>
      btn.addEventListener('click', () => signOut(auth).then(() => location.replace('./login.html'))));

    // Real-time listener with error handling
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
    }, error => {
      // Handle Firestore errors gracefully
      console.error('Firestore error:', error);
      if (error.code === 'permission-denied') {
        showToast('Please initialize your database first. Go to init-db.html', 'warn');
      } else {
        showToast('Error loading records: ' + error.message, 'error');
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

initApp().catch(err => {
  console.error('Failed to initialize app:', err);
  showToast('Failed to initialize app. Please refresh the page.', 'error');
});

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

  // Clear existing timeout
  clearTimeout(t._timer);

  // Remove exit animation class if present
  t.classList.remove('exit');

  // Set up icon and class
  let icon = '✔';
  let typeClass = 'success';

  if (type === 'error') {
    icon = '✕';
    typeClass = 'error';
  } else if (type === 'warn') {
    icon = '⚠';
    typeClass = 'warning';
  }

  // Update toast content with icon
  t.innerHTML = `<span style="margin-right: 0.3rem;">${icon}</span>${msg}`;
  t.className = 'toast';
  t.classList.add(typeClass);

  // Remove hidden class to show
  t.classList.remove('hidden');

  // Auto-dismiss after 3 seconds with exit animation
  t._timer = setTimeout(() => {
    t.classList.add('exit');
    setTimeout(() => {
      t.classList.add('hidden');
      t.classList.remove('exit');
    }, 300);
  }, 3000);
}

// Show loading state on button
function setButtonLoading(btn, isLoading) {
  if (!btn) return;

  if (!btn.dataset.originalText) {
    btn.dataset.originalText = btn.innerHTML;
  }

  if (isLoading) {
    btn.disabled = true;
    btn.classList.add('loading');
    btn.innerHTML = '<span class="loader"></span> Loading...';
  } else {
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.innerHTML = btn.dataset.originalText;
  }
}

// Add visual feedback for user actions
function addClickFeedback(el) {
  el.addEventListener('click', function (e) {
    const ripple = document.createElement('span');
    ripple.style.cssText = `
      position: absolute;
      width: 20px;
      height: 20px;
      background: radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 70%);
      border-radius: 50%;
      pointer-events: none;
      animation: rippleOut 0.6s ease-out;
    `;

    const rect = this.getBoundingClientRect();
    ripple.style.left = (e.clientX - rect.left - 10) + 'px';
    ripple.style.top = (e.clientY - rect.top - 10) + 'px';

    this.style.position = 'relative';
    this.style.overflow = 'hidden';
    this.appendChild(ripple);

    setTimeout(() => ripple.remove(), 600);
  });
}

// Add ripple animation to CSS dynamically if not already present
if (!document.getElementById('rippleAnimation')) {
  const style = document.createElement('style');
  style.id = 'rippleAnimation';
  style.textContent = `
    @keyframes rippleOut {
      from {
        opacity: 1;
        transform: scale(1);
      }
      to {
        opacity: 0;
        transform: scale(3);
      }
    }
  `;
  document.head.appendChild(style);
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

  // 3. Net Amt = Amount − L.R − Seller Commission
  const lr = parseFloat(r.lr) || 0;
  const seller = parseFloat(r.seller) || 0;
  r.netAmt = amt ? (amt - lr - seller).toFixed(2) : '';

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
          <button class="wa-btn" onclick="sendWhatsApp('${r.id}')" title="Send via WhatsApp">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.563 4.14 1.548 5.874L0 24l6.337-1.524A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.78 9.78 0 01-5.065-1.413l-.363-.217-3.764.906.953-3.668-.237-.378A9.826 9.826 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/></svg>
            Send
          </button>
          <button class="patti-btn" onclick="generatePattiImage('${r.id}')" title="Patti Note Preview">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg>
            Patti
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

  // ===== LIVE AUTO-CALCULATION =====
  // Fields that trigger auto-calc: qty, rate, ccPct, lr, seller, chqAmt
  const autoCalcTriggers = ['qty', 'rate', 'ccPct', 'lr', 'seller', 'chqAmt'];
  if (autoCalcTriggers.includes(key)) {
    input.addEventListener('input', () => {
      // Update the local record with current input value
      if (colDef.type === 'number') {
        r[key] = input.value ? parseFloat(input.value) : '';
      } else {
        r[key] = input.value;
      }

      // Re-calculate all derived fields
      applyAutoCalc(r);

      // Update display of all auto-calculated cells in this row
      const row = td.closest('tr');
      const autoCells = row.querySelectorAll('td.auto-cell');
      autoCells.forEach(cell => {
        const cellKey = cell.dataset.key;
        const cellColDef = COLS.find(c => c.key === cellKey);
        if (!cellColDef) return;

        const newVal = r[cellKey];
        let display;

        if (cellKey === 'status') {
          display = statusBadge(newVal);
        } else if (cellKey === 'noOfDays') {
          if (!newVal) { display = '<span class="cell-empty">—</span>'; }
          else if (newVal === 'Cleared') { display = `<span class="days-cleared">✅ Cleared</span>`; }
          else {
            const days = parseInt(newVal);
            const cls = days > 30 ? 'days-red' : 'days-yellow';
            display = `<span class="${cls}">${escHtml(newVal)}</span>`;
          }
        } else if (cellKey === 'noOfDayRec') {
          display = newVal ? `<span class="${newVal === 'PAYMENT NOT RECD' ? 'days-notrecd' : 'days-cleared'}">${escHtml(newVal)}</span>` : '<span class="cell-empty">—</span>';
        } else if (cellColDef.align === 'right') {
          display = fmt(newVal) || '<span class="cell-empty">—</span>';
        } else {
          display = newVal ? escHtml(String(newVal)) : '<span class="cell-empty">—</span>';
        }

        cell.innerHTML = display;
      });
    });
  }

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

    // For arrow keys: commit and navigate immediately (Excel-like)
    // For Enter/Tab: commit and navigate with proper timing
    const oldTd = td;
    const isArrowKey = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key);

    commitCell(td, id, key);
    hideAutocomplete();

    // Navigate - instant for arrow keys, delayed for Enter/Tab to respect async saves
    const delay = isArrowKey ? 0 : 100;
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
    }, delay);
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
  const afterIdx = records.findIndex(r => r.id === afterId);
  if (afterIdx === -1) return;

  const r = newEmptyRecord(afterId);

  // Insert directly after the target row in the local array so
  // the re-render shows it immediately in the right position,
  // independent of any sort order applied later.
  records.splice(afterIdx + 1, 0, r);
  renderTable();                        // instant UI update

  // Persist to Firebase in the background
  await window._fbSave(r);

  // Focus first editable cell of the newly inserted row
  setTimeout(() => {
    const rows = document.querySelectorAll('#tableBody tr');
    const insertedRow = [...rows].find(row => row.dataset.id === r.id);
    if (insertedRow) {
      const cell = insertedRow.querySelector('td.editable-cell');
      if (cell) activateCell(cell);
    }
  }, 80);
};


// ─────────────────────────────────────────────
// PATTI NOTE PREVIEW MODAL
// ─────────────────────────────────────────────
let _pattiCurrentRecord = null;

function fillPattiNote(r) {
  document.getElementById('patti_date').textContent = r.date || '—';
  document.getElementById('patti_billno').textContent = r.billNo || '—';
  document.getElementById('patti_area').textContent = r.area || '—';
  document.getElementById('patti_miller').textContent = r.millerName || '—';
  document.getElementById('patti_shop').textContent = r.shopName || '—';
  document.getElementById('patti_brand').textContent = r.brand || '—';
  document.getElementById('patti_place').textContent = r.place || '—';
  document.getElementById('patti_qty').textContent = r.qty || '—';
  document.getElementById('patti_rate').textContent = fmt(r.rate) || '—';
  document.getElementById('patti_amount').textContent = fmt(r.amount) || '—';
  document.getElementById('patti_lr').textContent = fmt(r.lr) || '—';
  document.getElementById('patti_tds').textContent = fmt(r.tds) || '—';
  document.getElementById('patti_shortage').textContent = fmt(r.shortage) || '—';
  document.getElementById('patti_seller').textContent = fmt(r.seller) || '—';
  document.getElementById('patti_netamt').textContent = fmt(r.netAmt) || '0.00';
  document.getElementById('patti_status').textContent = r.status || '—';
  document.getElementById('patti_chqamt').textContent = fmt(r.chqAmt) || '—';
  document.getElementById('patti_chqno').textContent = r.chqNo || '—';
  document.getElementById('patti_paydate').textContent = r.paymentDate || '—';
  document.getElementById('patti_bank').textContent = r.bank || '—';
  document.getElementById('patti_generated').textContent = new Date().toLocaleString('en-IN');
}

async function generatePattiImage(id) {
  const r = records.find(x => x.id === id);
  if (!r) { showToast('Record not found', 'error'); return; }

  _pattiCurrentRecord = r;
  fillPattiNote(r);

  // Open the preview modal
  const modal = document.getElementById('pattiModal');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

// Close patti modal — call from close button, overlay click, or Escape
window.closePattiModal = function (evt) {
  if (evt && evt.target !== document.getElementById('pattiModal')) return;
  document.getElementById('pattiModal').classList.add('hidden');
  document.body.style.overflow = '';
  _pattiCurrentRecord = null;
};

// Escape key closes modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !document.getElementById('pattiModal').classList.contains('hidden')) {
    document.getElementById('pattiModal').classList.add('hidden');
    document.body.style.overflow = '';
    _pattiCurrentRecord = null;
  }
});

// Helper: capture #pattiNote via html2canvas at 3x
async function capturePattiCanvas() {
  const el = document.getElementById('pattiNote');
  return window.html2canvas(el, {
    backgroundColor: '#ffffff',
    scale: 3,
    useCORS: true,
    allowTaint: false,
    logging: false,
    imageTimeout: 3000
  });
}

// Download PNG button handler
window.downloadPattiPng = async function () {
  const btn = document.getElementById('btnPattiDownload');
  const r = _pattiCurrentRecord;
  if (!r) return;
  btn.disabled = true;
  btn.textContent = '⏳ Generating…';
  try {
    const canvas = await capturePattiCanvas();
    canvas.toBlob(blob => {
      if (!blob) { showToast('Failed to generate image', 'error'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Patti_${r.billNo || r.millerName || 'Note'}_${r.date || 'nodate'}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('✔ Patti note downloaded as PNG!');
    }, 'image/png', 1);
  } catch (err) {
    console.error(err);
    showToast('❌ Download failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zm-8 2V5h2v6h1.17L12 13.17 9.83 11H11zm-6 7h14v2H5z"/></svg> Download PNG';
  }
};

// Copy image to clipboard button handler
window.copyPattiImage = async function () {
  const btn = document.getElementById('btnPattiCopy');
  btn.disabled = true;
  btn.textContent = '⏳ Copying…';
  try {
    const canvas = await capturePattiCanvas();
    canvas.toBlob(async blob => {
      if (!blob) { showToast('Failed to generate image', 'error'); return; }
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('📋 Patti image copied! Paste anywhere.');
      } catch (clipErr) {
        // Fallback: open in new tab so user can right-click copy
        const url = URL.createObjectURL(blob);
        const w = window.open();
        w.document.write(`<body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${url}" style="max-width:98%;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,.7)"/></body>`);
        w.document.close();
        showToast('📋 Right-click the image to copy');
      }
    }, 'image/png', 1);
  } catch (err) {
    console.error(err);
    showToast('❌ Copy failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg> Copy Image';
  }
};

// WhatsApp share from patti modal
window.sharePattiWhatsApp = function () {
  const r = _pattiCurrentRecord;
  if (!r) return;
  const netAmt = r.netAmt ? '₹' + fmt(r.netAmt) : '—';
  const amount = r.amount ? '₹' + fmt(r.amount) : '—';
  const msg =
    `🧾 *PATTI NOTE*

*Miller:* ${r.millerName || '—'}
*Shop / Party:* ${r.shopName || '—'}
*Brand:* ${r.brand || '—'}  |  *Place:* ${r.place || '—'}

*Date:* ${r.date || '—'}  |  *Bill No:* ${r.billNo || '—'}  |  *Area:* ${r.area || '—'}
*QTY:* ${r.qty || '—'}  |  *Rate:* ${r.rate || '—'}
*Amount:* ${amount}

*L.R.:* ₹${fmt(r.lr) || '0'}  |  *TDS:* ₹${fmt(r.tds) || '0'}  |  *Shortage:* ₹${fmt(r.shortage) || '0'}  |  *Seller Com:* ₹${fmt(r.seller) || '0'}

💰 *NET AMOUNT: ${netAmt}*

*Chq No:* ${r.chqNo || '—'}  |  *Payment Date:* ${r.paymentDate || '—'}  |  *Bank:* ${r.bank || '—'}
*Status:* ${r.status || 'PENDING'}`;
  window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
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
  return function (...args) {
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
// DELETE ALL ENTRIES
// ─────────────────────────────────────────────
document.getElementById('btnDeleteAll').addEventListener('click', async () => {
  if (!records.length) { showToast('No records to delete.', 'warn'); return; }

  const confirmed = window.confirm(
    `⚠️ Delete ALL ${records.length} record(s)?\n\nThis cannot be undone!`
  );
  if (!confirmed) return;

  showToast(`🗑 Deleting ${records.length} record(s)…`, 'warn');
  try {
    const ids = records.map(r => r.id);
    await Promise.all(ids.map(id => window._fbDelete(id)));
    // onSnapshot will clear local records automatically
    showToast('✔ All records deleted.');
  } catch (err) {
    console.error('Delete all error:', err);
    showToast('❌ Failed to delete all: ' + err.message, 'error');
  }
});

// ─────────────────────────────────────────────
// CSV EXPORT
// ─────────────────────────────────────────────
// EXCEL EXPORT (.xlsx via SheetJS)
// ─────────────────────────────────────────────
const XL_KEYS = COLS.filter(c => c.key !== '_whatsapp').map(c => c.key);
const XL_LABELS = COLS.filter(c => c.key !== '_whatsapp').map(c => c.label);

document.getElementById('btnExport').addEventListener('click', () => {
  if (!records.length) { showToast('No records to export!', 'warn'); return; }

  if (typeof XLSX === 'undefined') {
    showToast('SheetJS not loaded. Check internet connection.', 'error'); return;
  }

  // Build rows: header + data
  const data = [
    XL_LABELS,                                            // header row
    ...getFilteredSorted().map(r => XL_KEYS.map(k => {
      const v = r[k] ?? '';
      // Keep numbers as numbers for Excel
      const num = parseFloat(v);
      return (!isNaN(num) && v !== '' && COLS.find(c => c.key === k)?.type === 'number') ? num : String(v);
    }))
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = XL_KEYS.map(k => {
    const col = COLS.find(c => c.key === k);
    if (col?.type === 'number') return { wch: 13 };
    if (k === 'millerName' || k === 'shopName') return { wch: 22 };
    if (k === 'date' || k === 'paymentDate') return { wch: 12 };
    return { wch: 14 };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Business Records');

  const fileName = `Business_Records_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
  showToast(`✔ Exported ${data.length - 1} record(s) to Excel!`);
});

// ─────────────────────────────────────────────
// EXCEL IMPORT (.xlsx / .xls via SheetJS)
// ─────────────────────────────────────────────

// Create hidden file input for xlsx/xls
const _importInput = document.createElement('input');
_importInput.type = 'file';
_importInput.accept = '.xlsx,.xls';
_importInput.style.display = 'none';
document.body.appendChild(_importInput);

document.getElementById('btnImport').addEventListener('click', () => _importInput.click());

_importInput.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';

  if (typeof XLSX === 'undefined') {
    showToast('SheetJS not loaded. Check internet connection.', 'error'); return;
  }

  try {
    showToast('⏳ Reading Excel file…', 'warn');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (rows.length < 2) { showToast('Excel file is empty or has only a header row.', 'error'); return; }

    // Map Excel column headers → COLS keys (case-insensitive)
    const headerRow = rows[0].map(h => String(h).trim().toLowerCase());
    const labelToKey = {};
    COLS.forEach(c => {
      labelToKey[c.label.toLowerCase()] = c.key;
      labelToKey[c.key.toLowerCase()] = c.key;   // also accept raw key names
    });

    // ── Aliases for common variations in existing Excel files ──
    const ALIASES = {
      'shop loc': 'place', 'shop location': 'place', 'location': 'place', 'loc': 'place',
      'buyer name': 'shopName', 'buyer': 'shopName', 'party name': 'shopName',
      'party': 'shopName', 'customer': 'shopName', 'shop': 'shopName',
      'miller': 'millerName', 'mill name': 'millerName', 'mill': 'millerName',
      'bill no': 'billNo', 'bill number': 'billNo', 'bill #': 'billNo',
      'invoice no': 'billNo', 'invoice': 'billNo',
      'no of days': 'noOfDays', 'days': 'noOfDays', 'pending days': 'noOfDays', 'age': 'noOfDays',
      'cleared': 'noOfDayRec', 'payment status': 'noOfDayRec',
      'c.c.': 'cc', 'cc': 'cc', 'c.c': 'cc', 'c.c.%': 'ccPct', 'cc%': 'ccPct',
      'seller': 'seller', 'seller com': 'seller', 'seller commission': 'seller', 'commission': 'seller',
      'chq./dd': 'chqAmt', 'chq/dd': 'chqAmt', 'chq. amt': 'chqAmt', 'cheque amount': 'chqAmt', 'dd amount': 'chqAmt',
      'chq no': 'chqNo', 'cheque no': 'chqNo', 'cheque no.': 'chqNo', 'dd no': 'chqNo',
      'chq/dd date': 'paymentDate', 'chq. date': 'paymentDate', 'cheque date': 'paymentDate',
      'payment dt': 'paymentDate', 'pay date': 'paymentDate', 'date of payment': 'paymentDate',
      'l.r': 'lr', 'lr': 'lr', 'lr charges': 'lr', 'lr.': 'lr',
      'quantity': 'qty', 'bags': 'qty', 'units': 'qty', 'qty': 'qty',
      'net amount': 'netAmt', 'net amt': 'netAmt',
      'diff in': 'diffIn', 'diff. in': 'diffIn', 'difference': 'diffIn',
    };
    Object.assign(labelToKey, ALIASES);

    const colMap = headerRow.map(h => labelToKey[h] || null);

    if (colMap.every(k => !k)) {
      showToast('No matching columns found. Use exported headers.', 'error'); return;
    }

    let added = 0;
    const writes = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.every(v => v === '' || v == null)) continue; // skip blank rows

      const data = { id: uid(), _isNew: true };
      colMap.forEach((key, j) => {
        if (!key || key === '_whatsapp') return;
        let val = row[j] ?? '';
        // SheetJS returns Date objects when cellDates:true
        if (val instanceof Date) {
          val = val.toISOString().slice(0, 10); // YYYY-MM-DD
        } else {
          val = String(val).trim();
        }
        data[key] = val;
      });
      applyAutoCalc(data);
      writes.push(window._fbSave(data));
      added++;
    }

    await Promise.all(writes);
    showToast(`✔ Imported ${added} record(s) from Excel!`);
  } catch (err) {
    console.error('Excel import error:', err);
    showToast('❌ Failed to read Excel file: ' + err.message, 'error');
  }
});

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

// Add click feedback to primary buttons
document.querySelectorAll('.btn-primary').forEach(btn => {
  addClickFeedback(btn);
});

// Show loading state until first snapshot arrives
document.getElementById('emptyState').classList.add('show');
document.getElementById('emptyState').innerHTML =
  '<div class="empty-icon">⏳</div><p>Connecting to Firestore…</p>';

// Expose generatePattiImage to global scope for inline onclick handlers
window.generatePattiImage = generatePattiImage;
