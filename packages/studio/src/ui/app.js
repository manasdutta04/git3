let currentCollection = null;
let currentDocId = null;
let documents = [];

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function loadHealth() {
  try {
    const health = await api('/health');
    const el = document.getElementById('health');
    el.innerHTML = `
      <strong>${health.owner}/${health.repo}</strong><br/>
      Branch: ${health.branch}<br/>
      Rate limit: ${health.rateLimit.remaining}/${health.rateLimit.limit}
    `;
    el.style.color = 'var(--green)';
  } catch (err) {
    document.getElementById('health').textContent = err.message;
  }
}

async function loadCollections() {
  const { collections } = await api('/collections');
  const ul = document.getElementById('collections');
  ul.innerHTML = collections.map((name) =>
    `<li data-collection="${name}">${name}</li>`
  ).join('');

  ul.querySelectorAll('li').forEach((li) => {
    li.addEventListener('click', () => selectCollection(li.dataset.collection));
  });

  if (collections.length && !currentCollection) {
    selectCollection(collections[0]);
  }
}

function showView(view) {
  document.getElementById('table-view').classList.toggle('hidden', view !== 'table');
  document.getElementById('editor-view').classList.toggle('hidden', view !== 'editor');
  document.getElementById('kv-view').classList.toggle('hidden', view !== 'kv');
}

async function selectCollection(name) {
  currentCollection = name;
  currentDocId = null;
  document.querySelectorAll('#collections li').forEach((li) => {
    li.classList.toggle('active', li.dataset.collection === name);
  });
  document.getElementById('title').textContent = name;
  document.getElementById('new-doc').disabled = false;
  showView('table');
  await loadDocuments();
}

async function loadDocuments() {
  const { documents: docs } = await api(`/collections/${currentCollection}`);
  documents = docs;
  renderTable();
}

function renderTable() {
  const head = document.getElementById('table-head');
  const body = document.getElementById('table-body');

  if (!documents.length) {
    head.innerHTML = '';
    body.innerHTML = '<tr><td>No documents yet</td></tr>';
    return;
  }

  const keys = [...new Set(documents.flatMap((d) => Object.keys(d)))];
  head.innerHTML = `<tr>${keys.map((k) => `<th>${k}</th>`).join('')}</tr>`;
  body.innerHTML = documents.map((doc) =>
    `<tr data-id="${doc._id}">${keys.map((k) => `<td>${JSON.stringify(doc[k] ?? '')}</td>`).join('')}</tr>`
  ).join('');

  body.querySelectorAll('tr[data-id]').forEach((row) => {
    row.addEventListener('click', () => openEditor(row.dataset.id));
  });
}

function openEditor(id) {
  const doc = documents.find((d) => String(d._id) === String(id));
  if (!doc) return;
  currentDocId = id;
  document.getElementById('editor').value = JSON.stringify(doc, null, 2);
  showView('editor');
}

function openNewEditor() {
  currentDocId = null;
  document.getElementById('editor').value = JSON.stringify({ name: '', email: '' }, null, 2);
  showView('editor');
}

async function saveDocument() {
  try {
    const parsed = JSON.parse(document.getElementById('editor').value);
    if (currentDocId) {
      await api(`/collections/${currentCollection}/${currentDocId}`, {
        method: 'PATCH',
        body: JSON.stringify(parsed),
      });
    } else {
      await api(`/collections/${currentCollection}`, {
        method: 'POST',
        body: JSON.stringify(parsed),
      });
    }
    showView('table');
    await loadDocuments();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteDocument() {
  if (!currentDocId || !confirm('Delete this document?')) return;
  await api(`/collections/${currentCollection}/${currentDocId}`, { method: 'DELETE' });
  showView('table');
  await loadDocuments();
}

async function viewKv() {
  const { kv } = await api('/kv');
  document.getElementById('kv-content').textContent = JSON.stringify(kv, null, 2);
  document.getElementById('title').textContent = 'KV Store';
  showView('kv');
}

document.getElementById('refresh').addEventListener('click', async () => {
  await loadHealth();
  if (currentCollection) await loadDocuments();
  else await loadCollections();
});

document.getElementById('new-doc').addEventListener('click', openNewEditor);
document.getElementById('save-doc').addEventListener('click', saveDocument);
document.getElementById('delete-doc').addEventListener('click', deleteDocument);
document.getElementById('cancel-edit').addEventListener('click', () => showView('table'));
document.getElementById('view-kv').addEventListener('click', viewKv);

loadHealth();
loadCollections();
