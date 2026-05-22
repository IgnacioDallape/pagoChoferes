/* ============================================================
   Auth
============================================================ */

const AUTH_USERS = [
  { username: 'ignacio', pass: '2406', id: '' },
  { username: 'damian',  pass: '2026', id: 'damian' },
];

let currentUser = null;

function storageKey() {
  return currentUser?.id ? `sueldo_choferes_v1_${currentUser.id}` : 'sueldo_choferes_v1';
}

function initAuth() {
  const saved = localStorage.getItem('sc_session');
  if (saved) {
    const user = AUTH_USERS.find(u => u.username === saved);
    if (user) {
      currentUser = user;
      db = loadDb();
      updateTopbarUser();
      showView('view-main');
      renderDriverGrid();
      return;
    }
  }
  showView('view-login');
}

function login(e) {
  e.preventDefault();
  const username = document.getElementById('login-user').value.trim().toLowerCase();
  const pass     = document.getElementById('login-pass').value;
  const user     = AUTH_USERS.find(u => u.username === username && u.pass === pass);
  const errEl    = document.getElementById('login-error');

  if (!user) {
    errEl.style.display = 'block';
    document.getElementById('login-pass').value = '';
    return;
  }

  errEl.style.display = 'none';
  currentUser = user;
  localStorage.setItem('sc_session', username);
  db = loadDb();
  updateTopbarUser();
  showView('view-main');
  renderDriverGrid();
}

function logout() {
  localStorage.removeItem('sc_session');
  currentUser = null;
  db = { choferes: [], viajes: [] };
  driverSearch = '';
  document.getElementById('driver-search').value = '';
  showView('view-login');
}

function updateTopbarUser() {
  const el = document.getElementById('topbar-username');
  if (el) el.textContent = currentUser?.username || '';
}

/* ============================================================
   Storage & State
============================================================ */

let db = { choferes: [], viajes: [] };
let currentDriverId = null;
let tripFilter = 'all';
let tripSearch = '';
let driverSearch = '';
let confirmCallback = null;

function loadDb() {
  try {
    const raw    = localStorage.getItem(storageKey());
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      choferes: parsed?.choferes || [],
      viajes:   parsed?.viajes   || [],
    };
  } catch {
    return { choferes: [], viajes: [] };
  }
}

function saveDb() {
  localStorage.setItem(storageKey(), JSON.stringify(db));
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ============================================================
   Computed helpers
============================================================ */

function getDriverTrips(driverId) {
  return db.viajes.filter(v => v.choferId === driverId);
}

function getDriverOwed(driverId) {
  return getDriverTrips(driverId)
    .filter(v => !v.pagado)
    .reduce((sum, v) => sum + (v.importe || 0), 0);
}

function formatMoney(n) {
  const val = n || 0;
  return '$ ' + val.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

function driverInitials(nombre) {
  return nombre.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ============================================================
   Global stats
============================================================ */

function updateGlobalStats() {
  const totalOwed    = db.choferes.reduce((s, c) => s + getDriverOwed(c.id), 0);
  const pendingTrips = db.viajes.filter(v => !v.pagado).length;
  const paidTrips    = db.viajes.filter(v =>  v.pagado).length;

  document.getElementById('stat-total-owed').textContent    = formatMoney(totalOwed);
  document.getElementById('stat-pending-trips').textContent = pendingTrips;
  document.getElementById('stat-paid-trips').textContent    = paidTrips;
  document.getElementById('stat-drivers').textContent       = db.choferes.length;
}

/* ============================================================
   Views
============================================================ */

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function goBack() {
  currentDriverId = null;
  tripFilter = 'all';
  tripSearch = '';
  showView('view-main');
  renderDriverGrid();
}

/* ============================================================
   Driver list
============================================================ */

function renderDriverGrid() {
  updateGlobalStats();

  const grid = document.getElementById('driver-grid');
  const q = driverSearch.toLowerCase();
  const filtered = db.choferes.filter(c => c.nombre.toLowerCase().includes(q));

  if (!filtered.length) {
    const isSearch = !!driverSearch;
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </div>
        <p>${isSearch ? 'No se encontraron choferes.' : 'Todavía no hay choferes cargados.'}</p>
        ${!isSearch ? '<small>Hacé clic en "Nuevo Chofer" para empezar.</small>' : ''}
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(c => {
    const trips   = getDriverTrips(c.id);
    const owed    = getDriverOwed(c.id);
    const pending = trips.filter(v => !v.pagado).length;
    const paid    = trips.filter(v =>  v.pagado).length;

    return `
      <div class="driver-card" onclick="openDriver('${c.id}')">
        <div class="driver-card-top">
          <div class="driver-card-info">
            <div class="driver-card-name">${escHtml(c.nombre)}</div>
            ${c.telefono ? `<div class="driver-card-phone">${escHtml(c.telefono)}</div>` : ''}
          </div>
          <div class="driver-avatar">${driverInitials(c.nombre)}</div>
        </div>
        <div class="driver-card-owed${owed === 0 ? ' zero' : ''}">${formatMoney(owed)}</div>
        <div class="driver-card-badges">
          <span class="badge badge-pending">${pending} pendiente${pending !== 1 ? 's' : ''}</span>
          <span class="badge badge-paid">${paid} pagado${paid !== 1 ? 's' : ''}</span>
        </div>
      </div>`;
  }).join('');
}

function onDriverSearch(val) {
  driverSearch = val;
  renderDriverGrid();
}

/* ============================================================
   Driver detail
============================================================ */

function openDriver(id) {
  currentDriverId = id;
  tripFilter = 'all';
  tripSearch = '';

  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.filter === 'all')
  );

  showView('view-driver');
  renderDriverDetail();
}

function renderDriverDetail() {
  const driver = db.choferes.find(c => c.id === currentDriverId);
  if (!driver) { goBack(); return; }

  document.getElementById('detail-driver-name').textContent  = driver.nombre;
  document.getElementById('detail-driver-phone').textContent = driver.telefono || '';

  const trips   = getDriverTrips(currentDriverId);
  const owed    = getDriverOwed(currentDriverId);
  const pending = trips.filter(v => !v.pagado).length;
  const paid    = trips.filter(v =>  v.pagado).length;

  document.getElementById('detail-total-owed').textContent   = formatMoney(owed);
  document.getElementById('detail-pending-count').textContent = pending;
  document.getElementById('detail-paid-count').textContent    = paid;

  renderTripList();
}

/* ============================================================
   Trip list
============================================================ */

function setTripFilter(filter, btn) {
  tripFilter = filter;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTripList();
}

function onTripSearch(val) {
  tripSearch = val;
  renderTripList();
}

function renderTripList() {
  const list = document.getElementById('trip-list');
  let trips = getDriverTrips(currentDriverId);

  if (tripFilter === 'pending') trips = trips.filter(v => !v.pagado);
  if (tripFilter === 'paid')    trips = trips.filter(v =>  v.pagado);

  if (tripSearch) {
    const q = tripSearch.toLowerCase();
    trips = trips.filter(v => (v.observaciones || '').toLowerCase().includes(q));
  }

  trips.sort((a, b) => b.fecha.localeCompare(a.fecha));

  if (!trips.length) {
    const isEmpty  = !tripSearch && tripFilter === 'all';
    const isFilter = tripFilter !== 'all';
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
            <rect x="1" y="10" width="15" height="10" rx="1.5"/>
            <path d="M16 14h4l3 3v3h-7V14z"/>
            <circle cx="5" cy="20" r="2"/><circle cx="19" cy="20" r="2"/>
          </svg>
        </div>
        <p>${isEmpty ? 'No hay viajes cargados.' : isFilter ? 'No hay viajes con ese estado.' : 'Sin resultados para esa búsqueda.'}</p>
        ${isEmpty ? '<small>Hacé clic en "Agregar Viaje" para empezar.</small>' : ''}
      </div>`;
    return;
  }

  list.innerHTML = trips.map(v => {
    const stateClass = v.pagado ? 'paid' : 'pending';
    const badgeClass = v.pagado ? 'badge-paid' : 'badge-pending';
    const badgeText  = v.pagado ? 'Pagado' : 'Pendiente';

    return `
      <div class="trip-card ${stateClass}">
        <div class="trip-card-top">
          <div class="trip-card-left">
            <div class="trip-importe ${stateClass}">${formatMoney(v.importe)}</div>
            ${v.observaciones ? `<div class="trip-obs-inline">${escHtml(v.observaciones)}</div>` : ''}
          </div>
          <div class="trip-card-right">
            <span class="trip-date">${formatDate(v.fecha)}</span>
            <span class="badge ${badgeClass}">${badgeText}</span>
          </div>
        </div>
        <div class="trip-card-bottom">
          <div class="trip-card-actions">
            ${!v.pagado
              ? `<button class="btn-mark-paid" onclick="markPaid('${v.id}')">✓ Marcar pagado</button>`
              : `<button class="btn-mark-unpaid" onclick="markUnpaid('${v.id}')">Desmarcar</button>`
            }
            <button class="btn-icon" onclick="openEditTrip('${v.id}')" title="Editar">
              <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
              </svg>
            </button>
            <button class="btn-icon" onclick="confirmDeleteTrip('${v.id}')" title="Eliminar" style="color:var(--danger)">
              <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
}

/* ============================================================
   Driver CRUD
============================================================ */

function openAddDriver() {
  document.getElementById('modal-driver-title').textContent = 'Nuevo Chofer';
  document.getElementById('driver-nombre').value       = '';
  document.getElementById('driver-telefono').value     = '';
  document.getElementById('driver-observaciones').value = '';
  document.getElementById('driver-edit-id').value      = '';
  openModal('modal-driver');
  setTimeout(() => document.getElementById('driver-nombre').focus(), 80);
}

function openEditDriver() {
  const driver = db.choferes.find(c => c.id === currentDriverId);
  if (!driver) return;
  document.getElementById('modal-driver-title').textContent  = 'Editar Chofer';
  document.getElementById('driver-nombre').value             = driver.nombre;
  document.getElementById('driver-telefono').value           = driver.telefono || '';
  document.getElementById('driver-observaciones').value      = driver.observaciones || '';
  document.getElementById('driver-edit-id').value            = driver.id;
  openModal('modal-driver');
  setTimeout(() => document.getElementById('driver-nombre').focus(), 80);
}

function saveDriver(e) {
  e.preventDefault();
  const editId = document.getElementById('driver-edit-id').value;
  const data = {
    nombre:        document.getElementById('driver-nombre').value.trim(),
    telefono:      document.getElementById('driver-telefono').value.trim(),
    observaciones: document.getElementById('driver-observaciones').value.trim(),
  };

  if (editId) {
    const idx = db.choferes.findIndex(c => c.id === editId);
    if (idx !== -1) db.choferes[idx] = { ...db.choferes[idx], ...data };
  } else {
    db.choferes.push({ id: genId(), ...data });
  }

  saveDb();
  closeModal('modal-driver');

  if (currentDriverId) renderDriverDetail();
  else renderDriverGrid();
}

function confirmDeleteDriver() {
  const driver = db.choferes.find(c => c.id === currentDriverId);
  if (!driver) return;
  showConfirm(
    'Eliminar Chofer',
    `¿Eliminar a "${driver.nombre}" y todos sus viajes registrados? Esta acción no se puede deshacer.`,
    () => {
      db.viajes   = db.viajes.filter(v => v.choferId !== currentDriverId);
      db.choferes = db.choferes.filter(c => c.id !== currentDriverId);
      saveDb();
      goBack();
    },
    'Eliminar'
  );
}

/* ============================================================
   Trip CRUD
============================================================ */

function openAddTrip() {
  document.getElementById('modal-trip-title').textContent  = 'Nuevo Viaje';
  document.getElementById('trip-fecha').value              = new Date().toISOString().slice(0, 10);
  document.getElementById('trip-importe').value            = '';
  document.getElementById('trip-observaciones').value      = '';
  document.getElementById('trip-edit-id').value            = '';
  openModal('modal-trip');
  setTimeout(() => document.getElementById('trip-importe').focus(), 80);
}

function openEditTrip(id) {
  const trip = db.viajes.find(v => v.id === id);
  if (!trip) return;
  document.getElementById('modal-trip-title').textContent  = 'Editar Viaje';
  document.getElementById('trip-fecha').value              = trip.fecha;
  document.getElementById('trip-importe').value            = trip.importe;
  document.getElementById('trip-observaciones').value      = trip.observaciones || '';
  document.getElementById('trip-edit-id').value            = trip.id;
  openModal('modal-trip');
}

function saveTrip(e) {
  e.preventDefault();
  const editId = document.getElementById('trip-edit-id').value;
  const data = {
    choferId:      currentDriverId,
    fecha:         document.getElementById('trip-fecha').value,
    importe:       parseFloat(document.getElementById('trip-importe').value) || 0,
    pagado:        editId ? (db.viajes.find(v => v.id === editId)?.pagado || false) : false,
    observaciones: document.getElementById('trip-observaciones').value.trim(),
  };

  if (editId) {
    const idx = db.viajes.findIndex(v => v.id === editId);
    if (idx !== -1) db.viajes[idx] = { ...db.viajes[idx], ...data };
  } else {
    db.viajes.push({ id: genId(), ...data });
  }

  saveDb();
  closeModal('modal-trip');
  renderDriverDetail();
}

function markPaid(id) {
  const trip = db.viajes.find(v => v.id === id);
  if (!trip) return;
  trip.pagado = true;
  saveDb();
  renderDriverDetail();
}

function markUnpaid(id) {
  const trip = db.viajes.find(v => v.id === id);
  if (!trip) return;
  trip.pagado = false;
  saveDb();
  renderDriverDetail();
}

function confirmDeleteTrip(id) {
  const trip = db.viajes.find(v => v.id === id);
  if (!trip) return;
  showConfirm(
    'Eliminar Viaje',
    `¿Eliminar el viaje del ${formatDate(trip.fecha)} por ${formatMoney(trip.importe)}?`,
    () => {
      db.viajes = db.viajes.filter(v => v.id !== id);
      saveDb();
      renderDriverDetail();
    },
    'Eliminar'
  );
}

function confirmDeletePaidTrips() {
  const paid = getDriverTrips(currentDriverId).filter(v => v.pagado);
  if (!paid.length) {
    showConfirm('Sin viajes pagados', 'No hay viajes marcados como pagados para eliminar.', null, null);
    return;
  }
  showConfirm(
    'Eliminar Viajes Pagados',
    `¿Eliminar ${paid.length} viaje${paid.length !== 1 ? 's' : ''} marcado${paid.length !== 1 ? 's' : ''} como pagado${paid.length !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`,
    () => {
      const paidIds = new Set(paid.map(v => v.id));
      db.viajes = db.viajes.filter(v => !paidIds.has(v.id));
      saveDb();
      renderDriverDetail();
    },
    'Eliminar'
  );
}

/* ============================================================
   Modals
============================================================ */

function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

function closeModalOutside(e, id) {
  if (e.target === e.currentTarget) closeModal(id);
}

function showConfirm(title, message, onOk, okLabel) {
  document.getElementById('confirm-title').textContent   = title;
  document.getElementById('confirm-message').textContent = message;

  const okBtn = document.getElementById('confirm-ok-btn');
  if (onOk) {
    okBtn.textContent = okLabel || 'Eliminar';
    okBtn.style.display = '';
    confirmCallback = onOk;
    okBtn.onclick = () => { closeModal('modal-confirm'); confirmCallback && confirmCallback(); };
  } else {
    okBtn.style.display = 'none';
  }

  openModal('modal-confirm');
}

/* ============================================================
   Keyboard shortcuts
============================================================ */

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
  }
});

/* ============================================================
   Init
============================================================ */

initAuth();
