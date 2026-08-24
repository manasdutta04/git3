let currentCollection = null;
let currentDocId = null;
let documents = [];
let kvData = {};
let lastHealth = null;

function $(id) {
  return document.getElementById(id);
}

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 2400);
}

function setBanner(message, isError) {
  const el = $('banner');
  if (!message) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.classList.remove('hidden');
  el.textContent = message;
  el.style.borderColor = isError ? 'var(--rose)' : 'var(--line)';
}

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (data.needsSetup) {
    showConnect();
    throw new Error('Connect GitHub first');
  }
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cellValue(value) {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

async function loadHealth() {
  const el = $('health');
  try {
    const health = await api('/health');
    lastHealth = health;
    const pct = Math.max(0, Math.min(100, (health.rateLimit.remaining / health.rateLimit.limit) * 100));
    el.classList.add('ok');
    el.classList.remove('err');
    el.innerHTML = `
      <span class="pulse"></span>
      <div>
        <strong>${escapeHtml(health.owner)}/${escapeHtml(health.repo)}</strong><br />
        branch ${escapeHtml(health.branch)}<br />
        API ${health.rateLimit.remaining}/${health.rateLimit.limit}
        <div class="meter"><span style="width:${pct}%"></span></div>
      </div>
    `;
  } catch (err) {
    el.classList.add('err');
    el.classList.remove('ok');
    el.innerHTML = `<span class="pulse"></span><div>${escapeHtml(err.message)}</div>`;
  }
}

async function loadCollections() {
  const { collections } = await api('/collections');
  const ul = $('collections');
  const empty = $('collections-empty');
  ul.innerHTML = collections.map((name) =>
    `<li data-collection="${escapeHtml(name)}">${escapeHtml(name)}</li>`
  ).join('');
  empty.classList.toggle('hidden', collections.length > 0);

  ul.querySelectorAll('li').forEach((li) => {
    li.addEventListener('click', () => selectCollection(li.dataset.collection));
  });

  if (currentCollection) {
    ul.querySelectorAll('li').forEach((li) => {
      li.classList.toggle('active', li.dataset.collection === currentCollection);
    });
  } else if (collections.length) {
    await selectCollection(collections[0]);
  }
}

function showView(view) {
  $('table-view').classList.toggle('hidden', view !== 'table');
  $('editor-view').classList.toggle('hidden', view !== 'editor');
  $('kv-view').classList.toggle('hidden', view !== 'kv');
  $('storage-view').classList.toggle('hidden', view !== 'storage');
  $('table-actions').classList.toggle('hidden', view !== 'table');
  $('delete-doc').classList.toggle('hidden', view !== 'editor' || !currentDocId);
}

function setWorkspace(eyebrow, title) {
  $('eyebrow').textContent = eyebrow;
  $('title').textContent = title;
}

async function selectCollection(name) {
  currentCollection = name;
  currentDocId = null;
  document.querySelectorAll('#collections li').forEach((li) => {
    li.classList.toggle('active', li.dataset.collection === name);
  });
  setWorkspace('Collection', name);
  $('new-doc').disabled = false;
  $('search').disabled = false;
  showView('table');
  await loadDocuments();
}

async function loadDocuments() {
  if (!currentCollection) return;
  setBanner('Loading documents from GitHub…');
  try {
    const { documents: docs } = await api(`/collections/${encodeURIComponent(currentCollection)}`);
    documents = docs;
    renderTable();
    setBanner('');
  } catch (err) {
    setBanner(err.message, true);
  }
}

function filteredDocs() {
  const q = $('search').value.trim().toLowerCase();
  if (!q) return documents;
  return documents.filter((doc) => JSON.stringify(doc).toLowerCase().includes(q));
}

function renderTable() {
  const head = $('table-head');
  const body = $('table-body');
  const empty = $('empty-state');
  const wrap = document.querySelector('.table-wrap');
  const rows = filteredDocs();

  if (!documents.length) {
    wrap.classList.add('hidden');
    empty.classList.remove('hidden');
    head.innerHTML = '';
    body.innerHTML = '';
    return;
  }

  empty.classList.add('hidden');
  wrap.classList.remove('hidden');

  if (!rows.length) {
    head.innerHTML = '';
    body.innerHTML = '<tr><td>No documents match this filter.</td></tr>';
    return;
  }

  const keys = ['_id', ...[...new Set(rows.flatMap((d) => Object.keys(d)))].filter((k) => k !== '_id')];
  head.innerHTML = `<tr>${keys.map((k) => `<th>${escapeHtml(k)}</th>`).join('')}</tr>`;
  body.innerHTML = rows.map((doc) =>
    `<tr data-id="${escapeHtml(doc._id)}">${keys.map((k) => {
      const raw = cellValue(doc[k]);
      const cls = k === '_id' ? 'id-chip' : '';
      return `<td class="${cls}" title="${escapeHtml(raw)}">${escapeHtml(raw)}</td>`;
    }).join('')}</tr>`
  ).join('');

  body.querySelectorAll('tr[data-id]').forEach((row) => {
    row.addEventListener('click', () => openEditor(row.dataset.id));
  });
}

function openEditor(id) {
  const doc = documents.find((d) => String(d._id) === String(id));
  if (!doc) return;
  currentDocId = id;
  $('editor').value = JSON.stringify(doc, null, 2);
  $('editor-label').textContent = 'Editing document';
  $('editor-id').textContent = `_id ${id}`;
  showView('editor');
}

function openNewEditor() {
  if (!currentCollection) {
    toast('Pick or create a collection first');
    return;
  }
  currentDocId = null;
  $('editor').value = JSON.stringify({ name: '', email: '' }, null, 2);
  $('editor-label').textContent = 'New document';
  $('editor-id').textContent = currentCollection;
  showView('editor');
}

async function saveDocument() {
  try {
    const parsed = JSON.parse($('editor').value);
    if (currentDocId) {
      await api(`/collections/${encodeURIComponent(currentCollection)}/${encodeURIComponent(currentDocId)}`, {
        method: 'PATCH',
        body: JSON.stringify(parsed),
      });
      toast('Document updated');
    } else {
      await api(`/collections/${encodeURIComponent(currentCollection)}`, {
        method: 'POST',
        body: JSON.stringify(parsed),
      });
      toast('Document created');
    }
    showView('table');
    await loadDocuments();
    await loadCollections();
  } catch (err) {
    setBanner(err.message, true);
  }
}

async function deleteDocument() {
  if (!currentDocId || !confirm('Delete this document from GitHub?')) return;
  await api(`/collections/${encodeURIComponent(currentCollection)}/${encodeURIComponent(currentDocId)}`, {
    method: 'DELETE',
  });
  toast('Document deleted');
  showView('table');
  await loadDocuments();
}

function renderKv() {
  const entries = Object.entries(kvData);
  const list = $('kv-list');
  if (!entries.length) {
    list.innerHTML = '<p class="hint">No keys yet. Set one above.</p>';
    return;
  }
  list.innerHTML = entries.map(([key, value]) => `
    <article class="kv-card">
      <div class="k">${escapeHtml(key)}</div>
      <button type="button" data-del-key="${escapeHtml(key)}">Delete</button>
      <div class="v">${escapeHtml(typeof value === 'string' ? value : JSON.stringify(value))}</div>
    </article>
  `).join('');
  list.querySelectorAll('[data-del-key]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/kv/${encodeURIComponent(btn.dataset.delKey)}`, { method: 'DELETE' });
      delete kvData[btn.dataset.delKey];
      renderKv();
      toast('Key deleted');
    });
  });
}

async function viewKv() {
  currentCollection = null;
  document.querySelectorAll('#collections li').forEach((li) => li.classList.remove('active'));
  $('new-doc').disabled = true;
  $('search').disabled = true;
  setWorkspace('Store', 'Key-value');
  showView('kv');
  kvData = (await api('/kv')).kv || {};
  renderKv();
}

async function saveKv() {
  const key = $('kv-key').value.trim();
  if (!key) return toast('Enter a key');
  let value = $('kv-value').value;
  try {
    value = JSON.parse(value);
  } catch {
    /* keep as string */
  }
  await api('/kv', { method: 'POST', body: JSON.stringify({ key, value }) });
  kvData[key] = value;
  $('kv-key').value = '';
  $('kv-value').value = '';
  renderKv();
  toast('Key saved');
}

async function viewStorage() {
  currentCollection = null;
  document.querySelectorAll('#collections li').forEach((li) => li.classList.remove('active'));
  $('new-doc').disabled = true;
  $('search').disabled = true;
  setWorkspace('Store', 'File storage');
  showView('storage');
  try {
    const { files } = await api('/storage');
    const list = $('storage-list');
    if (!files.length) {
      list.innerHTML = '<p class="hint">No files in /storage yet. Upload via db.storage() in your app.</p>';
      return;
    }
    list.innerHTML = files.map((f) => `
      <article class="file-card">
        <strong>${escapeHtml(f.path || f.name)}</strong>
        <span class="muted">${escapeHtml(f.type)} · ${f.size ?? 0} bytes</span>
      </article>
    `).join('');
  } catch (err) {
    $('storage-list').innerHTML = `<p class="hint">${escapeHtml(err.message)}</p>`;
  }
}

function showConnect(prefill) {
  $('connect').classList.remove('hidden');
  if (prefill?.owner) $('connect-owner').value = prefill.owner;
  if (prefill?.repo) $('connect-repo').value = prefill.repo;
  $('connect-token').value = '';
  $('connect-token').focus();
}

function hideConnect() {
  $('connect').classList.add('hidden');
  $('connect-error').classList.add('hidden');
}

async function bootWorkspace() {
  hideConnect();
  await loadHealth();
  await loadCollections();
}

async function boot() {
  try {
    const status = await api('/status');
    if (!status.configured) {
      showConnect();
      return;
    }
    await bootWorkspace();
  } catch {
    showConnect();
  }
}

$('connect-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const errEl = $('connect-error');
  const submit = $('connect-submit');
  errEl.classList.add('hidden');
  submit.disabled = true;
  submit.textContent = 'Connecting…';
  try {
    await api('/setup', {
      method: 'POST',
      body: JSON.stringify({
        token: $('connect-token').value.trim(),
        owner: $('connect-owner').value.trim(),
        repo: $('connect-repo').value.trim() || 'my-app-db',
      }),
    });
    toast('Connected');
    await bootWorkspace();
  } catch (err) {
    errEl.classList.remove('hidden');
    errEl.textContent = err.message;
    errEl.style.borderColor = 'var(--rose)';
  } finally {
    submit.disabled = false;
    submit.textContent = 'Connect';
  }
});

$('reconnect').addEventListener('click', () => {
  showConnect(lastHealth || {});
});

$('refresh').addEventListener('click', async () => {
  await loadHealth();
  await loadCollections();
  if (!$('table-view').classList.contains('hidden') && currentCollection) {
    await loadDocuments();
  }
});

$('new-doc').addEventListener('click', openNewEditor);
$('empty-new').addEventListener('click', openNewEditor);
$('save-doc').addEventListener('click', saveDocument);
$('delete-doc').addEventListener('click', deleteDocument);
$('cancel-edit').addEventListener('click', () => {
  showView('table');
  if (currentCollection) setWorkspace('Collection', currentCollection);
});
$('view-kv').addEventListener('click', viewKv);
$('view-storage').addEventListener('click', viewStorage);
$('kv-save').addEventListener('click', saveKv);
$('search').addEventListener('input', renderTable);
$('new-collection').addEventListener('click', () => {
  const name = prompt('Collection name');
  if (!name) return;
  currentCollection = name.trim();
  $('new-doc').disabled = false;
  $('search').disabled = false;
  setWorkspace('Collection', currentCollection);
  documents = [];
  showView('table');
  renderTable();
  toast('Collection ready — add a document to create it on GitHub');
});

boot();
