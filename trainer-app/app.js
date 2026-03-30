/* ════════════════════════════════════════
   TrainTrack — Personal Trainer App
   Data stored in localStorage
   ════════════════════════════════════════ */

// ── Utilities ──────────────────────────────────────────────────────────────

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const fmt = {
  date(iso) {
    if (!iso) return '';
    const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  },
  time(t) { return t || ''; },
  initials(name) {
    return (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  },
  age(dob) {
    if (!dob) return '';
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / 31557600000);
  },
  duration(mins) {
    if (!mins) return '';
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60 ? mins % 60 + 'm' : ''}`.trim() : `${mins}m`;
  },
};

const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ── Storage (localStorage) ──────────────────────────────────────────────────

const DB = (() => {
  const read = k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const store = key => ({
    all: () => read(key),
    get: id => read(key).find(r => r.id === id),
    add(data) {
      const rows = read(key);
      const row = { ...data, id: uid(), createdAt: new Date().toISOString() };
      rows.push(row); write(key, rows); return row;
    },
    update(id, data) {
      const rows = read(key).map(r => r.id === id ? { ...r, ...data } : r);
      write(key, rows);
      return rows.find(r => r.id === id);
    },
    delete(id) { write(key, read(key).filter(r => r.id !== id)); },
    save: rows => write(key, rows),
  });

  return {
    clients:  store('tt_clients'),
    workouts: store('tt_workouts'),
    progress: store('tt_progress'),
    sessions: store('tt_sessions'),
  };
})();

// ── App State ───────────────────────────────────────────────────────────────

const State = {
  tab: 'clients',
  detail: null,        // { type, id }
  filterClientId: null,
};

// ── DOM refs ────────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);
const main      = () => $('main-content');
const pageTitle = () => $('page-title');
const addBtn    = () => $('add-btn');
const headerLeft = () => $('header-left');

// ── Modal ───────────────────────────────────────────────────────────────────

const Modal = {
  open(title, bodyHtml, onReady) {
    $('modal-title').textContent = title;
    $('modal-body').innerHTML = bodyHtml;
    $('modal-overlay').classList.remove('hidden');
    if (onReady) onReady($('modal-body'));
  },
  close() {
    $('modal-overlay').classList.add('hidden');
    $('modal-body').innerHTML = '';
  },
};

// ── Router ──────────────────────────────────────────────────────────────────

function navigate(tab, detail = null) {
  State.tab = tab;
  State.detail = detail;

  // Update nav
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });

  // Header left (back button)
  if (detail) {
    headerLeft().innerHTML = `<button class="back-btn" id="back-btn">&#8592; Back</button>`;
    $('back-btn').addEventListener('click', () => navigate(tab));
  } else {
    headerLeft().innerHTML = '';
  }

  addBtn().style.display = '';
  renderScreen();
}

// ── Screens ─────────────────────────────────────────────────────────────────

function renderScreen() {
  const screens = {
    clients:  detail => detail ? renderClientDetail(detail.id) : renderClients(),
    workouts: detail => detail ? renderWorkoutDetail(detail.id) : renderWorkouts(),
    progress: renderProgress,
    schedule: renderSchedule,
  };
  (screens[State.tab])(State.detail);
}

// ═══════════════════════════════════════════════
// CLIENTS
// ═══════════════════════════════════════════════

function renderClients() {
  pageTitle().textContent = 'Clients';
  const clients = DB.clients.all().sort((a,b) => a.name.localeCompare(b.name));

  if (!clients.length) {
    main().innerHTML = `<div class="empty">
      <div class="empty-icon">&#128101;</div>
      <p>No clients yet.<br>Tap <strong>+</strong> to add your first client.</p>
    </div>`;
    return;
  }

  main().innerHTML = clients.map(c => `
    <div class="card" data-id="${esc(c.id)}" data-action="client-detail">
      <div class="card-header">
        <div>
          <div class="card-title">${esc(c.name)}</div>
          <div class="card-subtitle">${c.dob ? fmt.age(c.dob) + ' yrs' : ''}${c.dob && c.phone ? ' &bull; ' : ''}${esc(c.phone||'')}</div>
        </div>
        <div class="detail-avatar" style="width:40px;height:40px;font-size:15px">${esc(fmt.initials(c.name))}</div>
      </div>
      ${c.goals ? `<div class="card-body">${esc(c.goals)}</div>` : ''}
    </div>
  `).join('');

  main().querySelectorAll('[data-action="client-detail"]').forEach(el => {
    el.addEventListener('click', () => navigate('clients', { id: el.dataset.id }));
  });
}

function renderClientDetail(id) {
  const client = DB.clients.get(id);
  if (!client) { navigate('clients'); return; }

  const sessions = DB.sessions.all().filter(s => s.clientId === id);
  const upcoming = sessions.filter(s => !s.completed && s.date >= today()).length;
  const progress = DB.progress.all().filter(p => p.clientId === id);

  pageTitle().textContent = client.name.split(' ')[0];
  addBtn().style.display = 'none';

  main().innerHTML = `
    <div class="detail-header">
      <div class="detail-avatar">${esc(fmt.initials(client.name))}</div>
      <div>
        <div class="detail-name">${esc(client.name)}</div>
        <div class="detail-sub">${c_joined(client.createdAt)}</div>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-value">${sessions.length}</div>
        <div class="stat-label">Sessions</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${upcoming}</div>
        <div class="stat-label">Upcoming</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${progress.length}</div>
        <div class="stat-label">Check-ins</div>
      </div>
    </div>

    <div class="section-block">
      <div class="section-block-title">Contact</div>
      ${infoRow('Email', client.email)}
      ${infoRow('Phone', client.phone)}
      ${infoRow('Date of Birth', client.dob ? fmt.date(client.dob) + ` (${fmt.age(client.dob)})` : '')}
    </div>

    ${client.goals ? `<div class="section-block">
      <div class="section-block-title">Goals</div>
      <p style="font-size:14px;line-height:1.6;color:var(--text)">${esc(client.goals)}</p>
    </div>` : ''}

    ${client.notes ? `<div class="section-block">
      <div class="section-block-title">Notes</div>
      <p style="font-size:14px;line-height:1.6;color:var(--text-muted)">${esc(client.notes)}</p>
    </div>` : ''}

    <div class="btn-row">
      <button class="btn btn-ghost" id="edit-client-btn">Edit</button>
      <button class="btn btn-danger" id="delete-client-btn">Delete</button>
    </div>
  `;

  $('edit-client-btn').addEventListener('click', () => openClientForm(client));
  $('delete-client-btn').addEventListener('click', () => {
    if (confirm(`Delete ${client.name}? This cannot be undone.`)) {
      DB.clients.delete(id);
      navigate('clients');
    }
  });
}

function c_joined(iso) {
  if (!iso) return 'Client';
  return 'Since ' + fmt.date(iso.slice(0,10));
}

function infoRow(label, value) {
  if (!value) return '';
  return `<div class="info-row"><span class="info-label">${esc(label)}</span><span class="info-value">${esc(value)}</span></div>`;
}

function openClientForm(existing = null) {
  const title = existing ? 'Edit Client' : 'New Client';
  const c = existing || {};
  Modal.open(title, `
    <div class="form-group">
      <label class="form-label">Full Name *</label>
      <input class="form-input" id="f-name" type="text" value="${esc(c.name||'')}" placeholder="Jane Smith" autocomplete="name">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-input" id="f-email" type="email" value="${esc(c.email||'')}" placeholder="jane@email.com" autocomplete="email">
      </div>
      <div class="form-group">
        <label class="form-label">Phone</label>
        <input class="form-input" id="f-phone" type="tel" value="${esc(c.phone||'')}" placeholder="07xxx" autocomplete="tel">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Date of Birth</label>
      <input class="form-input" id="f-dob" type="date" value="${esc(c.dob||'')}">
    </div>
    <div class="form-group">
      <label class="form-label">Goals</label>
      <textarea class="form-textarea" id="f-goals" placeholder="Lose weight, build muscle, improve fitness...">${esc(c.goals||'')}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea class="form-textarea" id="f-notes" placeholder="Injuries, preferences, medical info...">${esc(c.notes||'')}</textarea>
    </div>
    <div class="btn-row">
      <button class="btn btn-ghost" id="modal-cancel-btn">Cancel</button>
      <button class="btn btn-primary" id="modal-save-btn">${existing ? 'Save Changes' : 'Add Client'}</button>
    </div>
  `);

  $('modal-cancel-btn').addEventListener('click', Modal.close);
  $('modal-save-btn').addEventListener('click', () => {
    const name = $('f-name').value.trim();
    if (!name) { $('f-name').focus(); return; }
    const data = {
      name,
      email: $('f-email').value.trim(),
      phone: $('f-phone').value.trim(),
      dob:   $('f-dob').value,
      goals: $('f-goals').value.trim(),
      notes: $('f-notes').value.trim(),
    };
    if (existing) {
      DB.clients.update(existing.id, data);
      Modal.close();
      navigate('clients', { id: existing.id });
    } else {
      const saved = DB.clients.add(data);
      Modal.close();
      navigate('clients', { id: saved.id });
    }
  });
}

// ═══════════════════════════════════════════════
// WORKOUTS
// ═══════════════════════════════════════════════

function renderWorkouts() {
  pageTitle().textContent = 'Workouts';
  const workouts = DB.workouts.all().sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  const clients  = DB.clients.all();

  if (!workouts.length) {
    main().innerHTML = `<div class="empty">
      <div class="empty-icon">&#128170;</div>
      <p>No workout plans yet.<br>Tap <strong>+</strong> to create one.</p>
    </div>`;
    return;
  }

  main().innerHTML = workouts.map(w => {
    const client = w.clientId ? clients.find(c => c.id === w.clientId) : null;
    const exCount = (w.exercises || []).length;
    return `
      <div class="card" data-id="${esc(w.id)}" data-action="workout-detail">
        <div class="card-header">
          <div>
            <div class="card-title">${esc(w.name)}</div>
            <div class="card-subtitle">${exCount} exercise${exCount !== 1 ? 's' : ''}</div>
          </div>
          ${client ? `<span class="badge">${esc(fmt.initials(client.name))}</span>` : '<span class="badge gray">Template</span>'}
        </div>
        ${w.description ? `<div class="card-body">${esc(w.description)}</div>` : ''}
      </div>
    `;
  }).join('');

  main().querySelectorAll('[data-action="workout-detail"]').forEach(el => {
    el.addEventListener('click', () => navigate('workouts', { id: el.dataset.id }));
  });
}

function renderWorkoutDetail(id) {
  const w = DB.workouts.get(id);
  if (!w) { navigate('workouts'); return; }
  const clients = DB.clients.all();
  const client = w.clientId ? clients.find(c => c.id === w.clientId) : null;

  pageTitle().textContent = 'Workout';
  addBtn().style.display = 'none';

  const exercises = w.exercises || [];

  main().innerHTML = `
    <div style="margin-bottom:16px">
      <div style="font-size:22px;font-weight:700;margin-bottom:4px">${esc(w.name)}</div>
      ${client ? `<div style="font-size:13px;color:var(--primary-light)">Assigned to ${esc(client.name)}</div>` : '<div style="font-size:13px;color:var(--text-muted)">Unassigned template</div>'}
      ${w.description ? `<div style="font-size:14px;color:var(--text-muted);margin-top:8px">${esc(w.description)}</div>` : ''}
    </div>

    <div class="section-block">
      <div class="section-block-title">${exercises.length} Exercise${exercises.length !== 1 ? 's' : ''}</div>
      ${exercises.length ? exercises.map((ex, i) => `
        <div class="exercise-item">
          <div>
            <div class="exercise-name">${i+1}. ${esc(ex.name)}</div>
            ${ex.notes ? `<div style="font-size:12px;color:var(--text-muted)">${esc(ex.notes)}</div>` : ''}
          </div>
          <div class="exercise-meta">
            ${ex.sets ? `${esc(ex.sets)} sets` : ''}
            ${ex.reps ? ` &times; ${esc(ex.reps)}` : ''}
            ${ex.weight ? `<br>${esc(ex.weight)} kg` : ''}
          </div>
        </div>
      `).join('') : '<p style="font-size:14px;color:var(--text-muted)">No exercises added.</p>'}
    </div>

    <div class="btn-row">
      <button class="btn btn-ghost" id="edit-workout-btn">Edit</button>
      <button class="btn btn-danger" id="delete-workout-btn">Delete</button>
    </div>
  `;

  $('edit-workout-btn').addEventListener('click', () => openWorkoutForm(w));
  $('delete-workout-btn').addEventListener('click', () => {
    if (confirm(`Delete "${w.name}"?`)) {
      DB.workouts.delete(id);
      navigate('workouts');
    }
  });
}

function openWorkoutForm(existing = null) {
  const w = existing || {};
  const clients = DB.clients.all();
  let exercises = JSON.parse(JSON.stringify(w.exercises || []));

  Modal.open(existing ? 'Edit Workout' : 'New Workout', `
    <div class="form-group">
      <label class="form-label">Plan Name *</label>
      <input class="form-input" id="f-wname" type="text" value="${esc(w.name||'')}" placeholder="e.g. Push Day A">
    </div>
    <div class="form-group">
      <label class="form-label">Assign to Client</label>
      <select class="form-select" id="f-wclient">
        <option value="">Unassigned (Template)</option>
        ${clients.map(c => `<option value="${esc(c.id)}" ${w.clientId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <input class="form-input" id="f-wdesc" type="text" value="${esc(w.description||'')}" placeholder="e.g. 3 days per week, push focus">
    </div>

    <div class="form-group">
      <label class="form-label">Exercises</label>
      <div id="exercise-list-builder"></div>
      <button class="btn btn-ghost" id="add-exercise-btn" style="margin-top:4px">+ Add Exercise</button>
    </div>

    <div class="btn-row">
      <button class="btn btn-ghost" id="modal-cancel-btn">Cancel</button>
      <button class="btn btn-primary" id="modal-save-btn">${existing ? 'Save Changes' : 'Create Plan'}</button>
    </div>
  `, body => {
    renderExerciseBuilder(body, exercises);

    body.querySelector('#add-exercise-btn').addEventListener('click', () => {
      exercises.push({ name: '', sets: '3', reps: '10', weight: '', notes: '' });
      renderExerciseBuilder(body, exercises);
    });

    body.querySelector('#modal-cancel-btn').addEventListener('click', Modal.close);
    body.querySelector('#modal-save-btn').addEventListener('click', () => {
      const name = $('f-wname').value.trim();
      if (!name) { $('f-wname').focus(); return; }
      syncExercisesFromDOM(body, exercises);
      const clean = exercises.filter(e => e.name.trim());
      const data = {
        name,
        clientId: $('f-wclient').value || null,
        description: $('f-wdesc').value.trim(),
        exercises: clean,
      };
      if (existing) {
        DB.workouts.update(existing.id, data);
        Modal.close();
        navigate('workouts', { id: existing.id });
      } else {
        const saved = DB.workouts.add(data);
        Modal.close();
        navigate('workouts', { id: saved.id });
      }
    });
  });
}

function renderExerciseBuilder(body, exercises) {
  const container = body.querySelector('#exercise-list-builder');
  container.innerHTML = exercises.map((ex, i) => `
    <div class="exercise-builder-item" data-ex="${i}">
      <input type="text" placeholder="Exercise name (e.g. Barbell Squat)" value="${esc(ex.name)}" data-field="name">
      <div class="exercise-num-inputs">
        <input type="number" placeholder="Sets" value="${esc(ex.sets)}" data-field="sets" min="1">
        <input type="number" placeholder="Reps" value="${esc(ex.reps)}" data-field="reps" min="1">
        <input type="number" placeholder="kg" value="${esc(ex.weight)}" data-field="weight" min="0" step="0.5">
      </div>
      <input type="text" placeholder="Notes (optional)" value="${esc(ex.notes||'')}" data-field="notes">
      <button class="exercise-remove" data-remove="${i}">Remove</button>
    </div>
  `).join('');

  container.querySelectorAll('.exercise-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      syncExercisesFromDOM(body, exercises);
      exercises.splice(parseInt(btn.dataset.remove), 1);
      renderExerciseBuilder(body, exercises);
    });
  });
}

function syncExercisesFromDOM(body, exercises) {
  body.querySelectorAll('.exercise-builder-item').forEach((item, i) => {
    if (!exercises[i]) return;
    exercises[i].name   = item.querySelector('[data-field="name"]').value;
    exercises[i].sets   = item.querySelector('[data-field="sets"]').value;
    exercises[i].reps   = item.querySelector('[data-field="reps"]').value;
    exercises[i].weight = item.querySelector('[data-field="weight"]').value;
    exercises[i].notes  = item.querySelector('[data-field="notes"]').value;
  });
}

// ═══════════════════════════════════════════════
// PROGRESS
// ═══════════════════════════════════════════════

function renderProgress() {
  pageTitle().textContent = 'Progress';
  const clients = DB.clients.all().sort((a,b) => a.name.localeCompare(b.name));

  if (!clients.length) {
    main().innerHTML = `<div class="empty">
      <div class="empty-icon">&#128200;</div>
      <p>Add clients first, then track their progress here.</p>
    </div>`;
    addBtn().style.display = 'none';
    return;
  }

  const activeId = State.filterClientId && clients.find(c => c.id === State.filterClientId)
    ? State.filterClientId
    : clients[0].id;
  State.filterClientId = activeId;

  const entries = DB.progress.all()
    .filter(p => p.clientId === activeId)
    .sort((a,b) => b.date.localeCompare(a.date));

  main().innerHTML = `
    <div class="filter-bar" id="client-filter">
      ${clients.map(c => `
        <button class="filter-chip ${c.id === activeId ? 'active' : ''}" data-cid="${esc(c.id)}">${esc(c.name.split(' ')[0])}</button>
      `).join('')}
    </div>
    ${renderProgressEntries(entries, activeId)}
  `;

  main().querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      State.filterClientId = btn.dataset.cid;
      renderProgress();
    });
  });

  main().querySelectorAll('[data-action="delete-progress"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('Delete this check-in?')) {
        DB.progress.delete(btn.dataset.id);
        renderProgress();
      }
    });
  });
}

function renderProgressEntries(entries, clientId) {
  if (!entries.length) {
    return `<div class="empty" style="padding:40px 24px">
      <div class="empty-icon">&#128202;</div>
      <p>No check-ins yet.<br>Tap <strong>+</strong> to log progress.</p>
    </div>`;
  }

  const weights = entries.map(e => parseFloat(e.weight)).filter(n => !isNaN(n));
  const latestWeight = weights[0];
  const prevWeight   = weights[1];
  const change       = latestWeight && prevWeight ? (latestWeight - prevWeight).toFixed(1) : null;
  const trend        = change === null ? '' : change < 0 ? 'trend-down' : change > 0 ? 'trend-up' : 'trend-flat';
  const trendIcon    = change === null ? '' : change < 0 ? '&#8595;' : change > 0 ? '&#8593;' : '&#8212;';

  const header = latestWeight ? `
    <div class="section-block" style="margin-bottom:12px">
      <div class="section-block-title">Latest</div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <span style="font-size:28px;font-weight:700;color:var(--primary-light)">${latestWeight} kg</span>
          ${change !== null ? `<span class="${trend}" style="margin-left:8px;font-size:15px;font-weight:600">${trendIcon} ${Math.abs(change)} kg</span>` : ''}
        </div>
        <div style="font-size:12px;color:var(--text-muted)">${fmt.date(entries[0].date)}</div>
      </div>
    </div>
  ` : '';

  const list = entries.map(e => `
    <div class="card" style="cursor:default">
      <div class="card-header" style="margin-bottom:${e.notes || hasMeasurements(e) ? '8px' : '0'}">
        <div>
          <div class="card-title">${fmt.date(e.date)}</div>
          ${e.weight ? `<div class="card-subtitle">${esc(e.weight)} kg</div>` : ''}
        </div>
        <button class="btn-sm danger" data-action="delete-progress" data-id="${esc(e.id)}">Delete</button>
      </div>
      ${hasMeasurements(e) ? renderMeasurements(e) : ''}
      ${e.notes ? `<div class="card-body" style="margin-top:6px">${esc(e.notes)}</div>` : ''}
    </div>
  `).join('');

  return header + list;
}

function hasMeasurements(e) {
  const m = e.measurements || {};
  return Object.values(m).some(v => v);
}

function renderMeasurements(e) {
  const m = e.measurements || {};
  const items = [
    ['Chest', m.chest], ['Waist', m.waist], ['Hips', m.hips],
    ['Arms', m.arms], ['Legs', m.legs],
  ].filter(([,v]) => v);
  if (!items.length) return '';
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
    ${items.map(([l, v]) => `<span style="font-size:12px;background:var(--surface2);padding:3px 8px;border-radius:6px;color:var(--text-muted)">${l}: <strong style="color:var(--text)">${esc(v)} cm</strong></span>`).join('')}
  </div>`;
}

function openProgressForm() {
  const clients = DB.clients.all().sort((a,b) => a.name.localeCompare(b.name));
  if (!clients.length) return;

  Modal.open('Log Progress', `
    <div class="form-group">
      <label class="form-label">Client *</label>
      <select class="form-select" id="f-pclient">
        ${clients.map(c => `<option value="${esc(c.id)}" ${State.filterClientId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Date *</label>
      <input class="form-input" id="f-pdate" type="date" value="${today()}">
    </div>
    <div class="form-group">
      <label class="form-label">Weight (kg)</label>
      <input class="form-input" id="f-pweight" type="number" placeholder="e.g. 80.5" step="0.1" min="0">
    </div>
    <div class="section-block-title" style="margin:12px 0 8px">Body Measurements (cm) — optional</div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Chest</label>
        <input class="form-input" id="f-chest" type="number" placeholder="cm" step="0.5">
      </div>
      <div class="form-group">
        <label class="form-label">Waist</label>
        <input class="form-input" id="f-waist" type="number" placeholder="cm" step="0.5">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Hips</label>
        <input class="form-input" id="f-hips" type="number" placeholder="cm" step="0.5">
      </div>
      <div class="form-group">
        <label class="form-label">Arms</label>
        <input class="form-input" id="f-arms" type="number" placeholder="cm" step="0.5">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Legs</label>
      <input class="form-input" id="f-legs" type="number" placeholder="cm" step="0.5">
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea class="form-textarea" id="f-pnotes" placeholder="How did it go? Any observations..."></textarea>
    </div>
    <div class="btn-row">
      <button class="btn btn-ghost" id="modal-cancel-btn">Cancel</button>
      <button class="btn btn-primary" id="modal-save-btn">Save Check-in</button>
    </div>
  `);

  $('modal-cancel-btn').addEventListener('click', Modal.close);
  $('modal-save-btn').addEventListener('click', () => {
    const clientId = $('f-pclient').value;
    const date = $('f-pdate').value;
    if (!clientId || !date) return;
    const data = {
      clientId, date,
      weight: $('f-pweight').value || null,
      measurements: {
        chest: $('f-chest').value || null,
        waist: $('f-waist').value || null,
        hips:  $('f-hips').value || null,
        arms:  $('f-arms').value || null,
        legs:  $('f-legs').value || null,
      },
      notes: $('f-pnotes').value.trim(),
    };
    State.filterClientId = clientId;
    DB.progress.add(data);
    Modal.close();
    renderProgress();
  });
}

// ═══════════════════════════════════════════════
// SCHEDULE
// ═══════════════════════════════════════════════

function renderSchedule() {
  pageTitle().textContent = 'Schedule';
  const clients  = DB.clients.all();
  const sessions = DB.sessions.all().sort((a,b) => {
    const da = a.date + (a.time || '');
    const db = b.date + (b.time || '');
    return da.localeCompare(db);
  });

  if (!sessions.length) {
    main().innerHTML = `<div class="empty">
      <div class="empty-icon">&#128197;</div>
      <p>No sessions booked.<br>Tap <strong>+</strong> to schedule one.</p>
    </div>`;
    return;
  }

  // Group by date
  const groups = {};
  sessions.forEach(s => {
    const key = s.date || 'No date';
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });

  const todayStr = today();
  let html = '';

  Object.entries(groups).forEach(([date, sess]) => {
    const label = date === todayStr ? 'Today' :
                  date === addDays(todayStr, 1) ? 'Tomorrow' :
                  date < todayStr ? fmt.date(date) + ' (Past)' :
                  fmt.date(date);
    html += `<div class="date-group-label">${esc(label)}</div>`;
    sess.forEach(s => {
      const client = s.clientId ? clients.find(c => c.id === s.clientId) : null;
      html += `
        <div class="card ${s.completed ? 'session-done' : ''}" style="cursor:default">
          <div class="card-header" style="margin-bottom:6px">
            <div>
              <div class="card-title">${client ? esc(client.name) : 'No client'}</div>
              <div class="card-subtitle">${esc(s.type||'PT Session')}${s.duration ? ' &bull; ' + fmt.duration(parseInt(s.duration)) : ''}</div>
            </div>
            <span class="session-time">${esc(s.time||'TBD')}</span>
          </div>
          ${s.notes ? `<div class="card-body" style="margin-bottom:8px">${esc(s.notes)}</div>` : ''}
          <div style="display:flex;gap:6px;margin-top:2px">
            ${!s.completed ? `<button class="btn-sm primary" data-action="complete-session" data-id="${esc(s.id)}">&#10003; Done</button>` : '<span class="badge gray">Completed</span>'}
            <button class="btn-sm ghost" data-action="edit-session" data-id="${esc(s.id)}">Edit</button>
            <button class="btn-sm danger" data-action="delete-session" data-id="${esc(s.id)}">Delete</button>
          </div>
        </div>
      `;
    });
  });

  main().innerHTML = html;

  main().querySelectorAll('[data-action="complete-session"]').forEach(btn => {
    btn.addEventListener('click', () => {
      DB.sessions.update(btn.dataset.id, { completed: true });
      renderSchedule();
    });
  });

  main().querySelectorAll('[data-action="edit-session"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = DB.sessions.get(btn.dataset.id);
      if (s) openSessionForm(s);
    });
  });

  main().querySelectorAll('[data-action="delete-session"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this session?')) {
        DB.sessions.delete(btn.dataset.id);
        renderSchedule();
      }
    });
  });
}

function openSessionForm(existing = null) {
  const s = existing || {};
  const clients = DB.clients.all().sort((a,b) => a.name.localeCompare(b.name));

  Modal.open(existing ? 'Edit Session' : 'Book Session', `
    <div class="form-group">
      <label class="form-label">Client</label>
      <select class="form-select" id="f-sclient">
        <option value="">No specific client</option>
        ${clients.map(c => `<option value="${esc(c.id)}" ${s.clientId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Date *</label>
        <input class="form-input" id="f-sdate" type="date" value="${esc(s.date || today())}">
      </div>
      <div class="form-group">
        <label class="form-label">Time</label>
        <input class="form-input" id="f-stime" type="time" value="${esc(s.time||'')}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Duration (mins)</label>
        <input class="form-input" id="f-sduration" type="number" value="${esc(s.duration||60)}" min="15" step="15">
      </div>
      <div class="form-group">
        <label class="form-label">Type</label>
        <select class="form-select" id="f-stype">
          ${['PT Session','Group Class','Assessment','Online','Other'].map(t =>
            `<option ${(s.type||'PT Session') === t ? 'selected' : ''}>${t}</option>`
          ).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea class="form-textarea" id="f-snotes" placeholder="Session notes, workout focus...">${esc(s.notes||'')}</textarea>
    </div>
    <div class="btn-row">
      <button class="btn btn-ghost" id="modal-cancel-btn">Cancel</button>
      <button class="btn btn-primary" id="modal-save-btn">${existing ? 'Save Changes' : 'Book Session'}</button>
    </div>
  `);

  $('modal-cancel-btn').addEventListener('click', Modal.close);
  $('modal-save-btn').addEventListener('click', () => {
    const date = $('f-sdate').value;
    if (!date) { $('f-sdate').focus(); return; }
    const data = {
      clientId: $('f-sclient').value || null,
      date,
      time:     $('f-stime').value,
      duration: $('f-sduration').value,
      type:     $('f-stype').value,
      notes:    $('f-snotes').value.trim(),
      completed: existing ? existing.completed : false,
    };
    if (existing) {
      DB.sessions.update(existing.id, data);
    } else {
      DB.sessions.add(data);
    }
    Modal.close();
    renderSchedule();
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── Add button dispatch ───────────────────────────────────────────────────────

function onAddBtn() {
  switch (State.tab) {
    case 'clients':  openClientForm(); break;
    case 'workouts': openWorkoutForm(); break;
    case 'progress': openProgressForm(); break;
    case 'schedule': openSessionForm(); break;
  }
}

// ── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      State.detail = null;
      State.filterClientId = null;
      navigate(btn.dataset.tab);
    });
  });

  // Add button
  addBtn().addEventListener('click', onAddBtn);

  // Modal close
  $('modal-close').addEventListener('click', Modal.close);
  $('modal-overlay').addEventListener('click', e => {
    if (e.target === $('modal-overlay')) Modal.close();
  });

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Initial render
  navigate('clients');
});
