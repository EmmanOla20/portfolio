// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function toast(msg, type = 'info') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast toast-${type}`;
  el.hidden = false;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.hidden = true; }, 3000);
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---------- Auth flow ----------
async function checkAuth() {
  try {
    await api('/api/me');
    showDashboard();
  } catch {
    showLogin();
  }
}

function showLogin() {
  $('#login-view').hidden = false;
  $('#dashboard-view').hidden = true;
  $('#logout-btn').hidden = true;
  $('#current-user').textContent = '';
}

function showDashboard() {
  $('#login-view').hidden = true;
  $('#dashboard-view').hidden = false;
  $('#logout-btn').hidden = false;
  $('#current-user').textContent = 'Logged in as admin';
  loadProjects();
  loadMessages();
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#login-btn');
  const status = $('#login-status');
  btn.disabled = true;
  btn.textContent = 'Logging in...';
  status.textContent = '';

  try {
    await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({
        username: $('#username').value,
        password: $('#password').value
      })
    });
    $('#login-form').reset();
    showDashboard();
  } catch (err) {
    status.textContent = err.message;
    status.style.color = '#f87171';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Login';
  }
});

$('#logout-btn').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  showLogin();
});

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.hidden = true);
    tab.classList.add('active');
    $(`#tab-${tab.dataset.tab}`).hidden = false;
  });
});

// ---------- Projects ----------
async function loadProjects() {
  const list = $('#projects-list');
  list.innerHTML = '<p class="muted-text">Loading...</p>';

  try {
    const projects = await api('/api/projects');
    if (!projects.length) {
      list.innerHTML = '<p class="muted-text">No projects yet.</p>';
      return;
    }
    list.innerHTML = projects.map(p => `
      <div class="row" data-id="${p.id}">
        <div class="row-main">
          <strong>${escapeHtml(p.title)}</strong>
          <span class="muted-text">${escapeHtml(p.description)}</span>
        </div>
        <div class="row-actions">
          <button class="btn small" data-action="edit">Edit</button>
          <button class="btn small danger" data-action="delete">Delete</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = `<p style="color:#f87171">${escapeHtml(err.message)}</p>`;
  }
}

$('#new-project-btn').addEventListener('click', () => {
  $('#project-form').reset();
  $('#project-id').value = '';
  $('#project-form').hidden = false;
  $('#project-title').focus();
});

$('#cancel-project-btn').addEventListener('click', () => {
  $('#project-form').hidden = true;
});

$('#project-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#project-id').value;
  const payload = {
    title: $('#project-title').value,
    description: $('#project-description').value,
    url: $('#project-url').value,
    tags: $('#project-tags').value.split(',').map(t => t.trim()).filter(Boolean)
  };

  try {
    if (id) {
      await api(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      toast('Project updated', 'success');
    } else {
      await api('/api/projects', { method: 'POST', body: JSON.stringify(payload) });
      toast('Project created', 'success');
    }
    $('#project-form').hidden = true;
    loadProjects();
  } catch (err) {
    toast(err.message, 'error');
  }
});

// ---------- Messages ----------
async function loadMessages() {
  const list = $('#messages-list');
  list.innerHTML = '<p class="muted-text">Loading...</p>';

  try {
    const messages = await api('/api/messages');
    const unread = messages.filter(m => !m.read).length;
    $('#messages-count').textContent = `${messages.length} total · ${unread} unread`;

    if (!messages.length) {
      list.innerHTML = '<p class="muted-text">No messages yet.</p>';
      return;
    }

    messages.sort((a, b) => new Date(b.date) - new Date(a.date));
    list.innerHTML = messages.map(m => `
      <div class="row ${m.read ? 'read' : 'unread'}" data-id="${m.id}">
        <div class="row-main">
          <strong>${escapeHtml(m.name)} &lt;${escapeHtml(m.email)}&gt;</strong>
          <span class="muted-text">${new Date(m.date).toLocaleString()}</span>
          <p>${escapeHtml(m.message)}</p>
        </div>
        <div class="row-actions">
          <button class="btn small" data-action="toggle-read" data-read="${m.read}">
            Mark ${m.read ? 'unread' : 'read'}
          </button>
          <button class="btn small danger" data-action="delete-message">Delete</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = `<p style="color:#f87171">${escapeHtml(err.message)}</p>`;
  }
}

// ---------- Row action delegation ----------
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const row = btn.closest('.row');
  const id = row?.dataset.id;
  if (!id) return;

  const action = btn.dataset.action;

  // --- Project edit ---
  if (action === 'edit') {
    const projects = await api('/api/projects');
    const p = projects.find(x => x.id === id);
    if (!p) return;
    $('#project-id').value = p.id;
    $('#project-title').value = p.title;
    $('#project-description').value = p.description;
    $('#project-url').value = p.url;
    $('#project-tags').value = (p.tags || []).join(', ');
    $('#project-form').hidden = false;
    $('#project-form').scrollIntoView({ behavior: 'smooth' });
    return;
  }

  // --- Project delete ---
  if (action === 'delete') {
    if (!confirm('Delete this project?')) return;
    try {
      await api(`/api/projects/${id}`, { method: 'DELETE' });
      toast('Project deleted', 'success');
      loadProjects();
    } catch (err) {
      toast(err.message, 'error');
    }
    return;
  }

  // --- Message toggle read ---
  if (action === 'toggle-read') {
    const read = btn.dataset.read === 'true';
    try {
      await api(`/api/messages/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ read: !read })
      });
      loadMessages();
    } catch (err) {
      toast(err.message, 'error');
    }
    return;
  }

  // --- Message delete ---
  if (action === 'delete-message') {
    if (!confirm('Delete this message?')) return;
    try {
      await api(`/api/messages/${id}`, { method: 'DELETE' });
      toast('Message deleted', 'success');
      loadMessages();
    } catch (err) {
      toast(err.message, 'error');
    }
  }
});

// ---------- Init ----------
checkAuth();