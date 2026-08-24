type View = 'table' | 'editor' | 'kv' | 'storage';

interface HealthStatus {
  owner: string;
  repo: string;
  branch: string;
  rateLimit: { remaining: number; limit: number };
}

interface Git3Document {
  _id: string;
  [key: string]: unknown;
}

interface StorageFile {
  name: string;
  path: string;
  size: number;
  type: 'file' | 'dir';
}

let currentCollection: string | null = null;
let currentDocId: string | null = null;
let documents: Git3Document[] = [];
let kvData: Record<string, unknown> = {};
let lastHealth: HealthStatus | null = null;
let toastTimer = 0;

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

function input(id: string): HTMLInputElement {
  return $(id) as HTMLInputElement;
}

function toast(message: string): void {
  const el = $('toast');
  el.textContent = message;
  el.classList.remove('hidden');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.add('hidden'), 2400);
}

function setBanner(message: string, isError = false): void {
  const el = $('banner');
  if (!message) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.classList.remove('hidden');
  el.textContent = message;
  el.style.borderColor = isError ? 'var(--danger)' : 'var(--line)';
}

async function api<T = Record<string, unknown>>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`/api${path}`, { ...options, headers });
  if (res.headers.get('content-type')?.includes('application/json') || res.status !== 200) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; needsSetup?: boolean };
    if (data.needsSetup) {
      showConnect();
      throw new Error('Connect GitHub first');
    }
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data as T;
  }
  if (!res.ok) throw new Error(res.statusText);
  return (await res.json()) as T;
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cellValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function isImage(path: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(path);
}

async function loadHealth(): Promise<void> {
  const el = $('health');
  try {
    const health = await api<HealthStatus>('/health');
    lastHealth = health;
    const pct = Math.max(0, Math.min(100, (health.rateLimit.remaining / health.rateLimit.limit) * 100));
    el.classList.add('ok');
    el.classList.remove('err');
    el.innerHTML = `
      <strong>${escapeHtml(health.owner)}/${escapeHtml(health.repo)}</strong><br />
      ${escapeHtml(health.branch)} · ${health.rateLimit.remaining}/${health.rateLimit.limit}
      <div class="meter"><span style="width:${pct}%"></span></div>
    `;
  } catch (err) {
    el.classList.add('err');
    el.classList.remove('ok');
    el.textContent = (err as Error).message;
  }
}

async function loadCollections(): Promise<void> {
  const { collections } = await api<{ collections: string[] }>('/collections');
  const ul = $('collections');
  const empty = $('collections-empty');
  ul.innerHTML = collections.map((name) =>
    `<li data-collection="${escapeHtml(name)}">${escapeHtml(name)}</li>`
  ).join('');
  empty.classList.toggle('hidden', collections.length > 0);

  ul.querySelectorAll('li').forEach((li) => {
    li.addEventListener('click', () => {
      const name = (li as HTMLElement).dataset.collection;
      if (name) void selectCollection(name);
    });
  });

  if (currentCollection) {
    ul.querySelectorAll('li').forEach((li) => {
      li.classList.toggle('active', (li as HTMLElement).dataset.collection === currentCollection);
    });
  } else if (collections.length) {
    await selectCollection(collections[0]!);
  }
}

function showView(view: View): void {
  $('table-view').classList.toggle('hidden', view !== 'table');
  $('editor-view').classList.toggle('hidden', view !== 'editor');
  $('kv-view').classList.toggle('hidden', view !== 'kv');
  $('storage-view').classList.toggle('hidden', view !== 'storage');
  $('table-actions').classList.toggle('hidden', view !== 'table');
  $('delete-doc').classList.toggle('hidden', view !== 'editor' || !currentDocId);
}

function setWorkspace(eyebrow: string, title: string): void {
  $('eyebrow').textContent = eyebrow;
  $('title').textContent = title;
}

async function selectCollection(name: string): Promise<void> {
  currentCollection = name;
  currentDocId = null;
  document.querySelectorAll('#collections li').forEach((li) => {
    li.classList.toggle('active', (li as HTMLElement).dataset.collection === name);
  });
  setWorkspace('Collection', name);
  ($('new-doc') as HTMLButtonElement).disabled = false;
  input('search').disabled = false;
  showView('table');
  await loadDocuments();
}

async function loadDocuments(): Promise<void> {
  if (!currentCollection) return;
  setBanner('Loading…');
  try {
    const { documents: docs } = await api<{ documents: Git3Document[] }>(
      `/collections/${encodeURIComponent(currentCollection)}`
    );
    documents = docs;
    renderTable();
    setBanner('');
  } catch (err) {
    setBanner((err as Error).message, true);
  }
}

function filteredDocs(): Git3Document[] {
  const q = input('search').value.trim().toLowerCase();
  if (!q) return documents;
  return documents.filter((doc) => JSON.stringify(doc).toLowerCase().includes(q));
}

function renderTable(): void {
  const head = $('table-head');
  const body = $('table-body');
  const empty = $('empty-state');
  const wrap = document.querySelector('.table-wrap') as HTMLElement;
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
    body.innerHTML = '<tr><td>No matches.</td></tr>';
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
    row.addEventListener('click', () => openEditor((row as HTMLElement).dataset.id || ''));
  });
}

function openEditor(id: string): void {
  const doc = documents.find((d) => String(d._id) === String(id));
  if (!doc) return;
  currentDocId = id;
  ($('editor') as HTMLTextAreaElement).value = JSON.stringify(doc, null, 2);
  $('editor-label').textContent = 'Editing';
  $('editor-id').textContent = `_id ${id}`;
  showView('editor');
}

function openNewEditor(): void {
  if (!currentCollection) {
    toast('Pick or create a collection first');
    return;
  }
  currentDocId = null;
  ($('editor') as HTMLTextAreaElement).value = JSON.stringify({ name: '', email: '' }, null, 2);
  $('editor-label').textContent = 'New document';
  $('editor-id').textContent = currentCollection;
  showView('editor');
}

async function saveDocument(): Promise<void> {
  if (!currentCollection) return;
  try {
    const parsed = JSON.parse(($('editor') as HTMLTextAreaElement).value) as Git3Document;
    if (currentDocId) {
      await api(`/collections/${encodeURIComponent(currentCollection)}/${encodeURIComponent(currentDocId)}`, {
        method: 'PATCH',
        body: JSON.stringify(parsed),
      });
      toast('Saved');
    } else {
      await api(`/collections/${encodeURIComponent(currentCollection)}`, {
        method: 'POST',
        body: JSON.stringify(parsed),
      });
      toast('Created');
    }
    showView('table');
    await loadDocuments();
    await loadCollections();
  } catch (err) {
    setBanner((err as Error).message, true);
  }
}

async function deleteDocument(): Promise<void> {
  if (!currentDocId || !currentCollection || !confirm('Delete this document?')) return;
  await api(`/collections/${encodeURIComponent(currentCollection)}/${encodeURIComponent(currentDocId)}`, {
    method: 'DELETE',
  });
  toast('Deleted');
  showView('table');
  await loadDocuments();
}

function renderKv(): void {
  const entries = Object.entries(kvData);
  const list = $('kv-list');
  if (!entries.length) {
    list.innerHTML = '<p class="hint">No keys yet.</p>';
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
      const key = (btn as HTMLElement).dataset.delKey || '';
      await api(`/kv/${encodeURIComponent(key)}`, { method: 'DELETE' });
      delete kvData[key];
      renderKv();
      toast('Deleted');
    });
  });
}

async function viewKv(): Promise<void> {
  currentCollection = null;
  document.querySelectorAll('#collections li').forEach((li) => li.classList.remove('active'));
  ($('new-doc') as HTMLButtonElement).disabled = true;
  input('search').disabled = true;
  setWorkspace('Store', 'Key-value');
  showView('kv');
  kvData = (await api<{ kv: Record<string, unknown> }>('/kv')).kv || {};
  renderKv();
}

async function saveKv(): Promise<void> {
  const key = input('kv-key').value.trim();
  if (!key) return toast('Enter a key');
  let value: unknown = input('kv-value').value;
  try {
    value = JSON.parse(String(value));
  } catch {
    /* keep string */
  }
  await api('/kv', { method: 'POST', body: JSON.stringify({ key, value }) });
  kvData[key] = value;
  input('kv-key').value = '';
  input('kv-value').value = '';
  renderKv();
  toast('Saved');
}

async function viewStorage(): Promise<void> {
  currentCollection = null;
  document.querySelectorAll('#collections li').forEach((li) => li.classList.remove('active'));
  ($('new-doc') as HTMLButtonElement).disabled = true;
  input('search').disabled = true;
  setWorkspace('Files', 'Storage');
  showView('storage');
  await loadStorage();
}

async function loadStorage(): Promise<void> {
  const list = $('storage-list');
  try {
    const { files } = await api<{ files: StorageFile[] }>('/storage');
    const items = files.filter((f) => f.type === 'file' || !f.type);
    if (!items.length) {
      list.innerHTML = '<p class="hint">No files yet. Upload a PNG or any file above.</p>';
      return;
    }
    list.innerHTML = items.map((f) => {
      const path = f.path || f.name;
      const preview = isImage(path)
        ? `<img class="file-preview" alt="" src="/api/storage/file?path=${encodeURIComponent(path)}" />`
        : '';
      return `
        <article class="file-card">
          <div>
            <strong>${escapeHtml(path)}</strong>
            <div class="muted">${escapeHtml(f.type)} · ${f.size ?? 0} bytes</div>
          </div>
          <button type="button" data-del-file="${escapeHtml(path)}">Delete</button>
          ${preview}
        </article>
      `;
    }).join('');
    list.querySelectorAll('[data-del-file]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const path = (btn as HTMLElement).dataset.delFile || '';
        if (!confirm(`Delete ${path}?`)) return;
        await api(`/storage?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
        toast('Deleted');
        await loadStorage();
      });
    });
  } catch (err) {
    list.innerHTML = `<p class="hint">${escapeHtml((err as Error).message)}</p>`;
  }
}

async function uploadFile(event: Event): Promise<void> {
  event.preventDefault();
  const fileInput = input('upload-file');
  const file = fileInput.files?.[0];
  if (!file) return toast('Choose a file');
  const form = new FormData();
  form.append('file', file);
  const path = input('upload-path').value.trim();
  if (path) form.append('path', path);
  try {
    await api('/storage', { method: 'POST', body: form });
    fileInput.value = '';
    input('upload-path').value = '';
    toast('Uploaded');
    await loadStorage();
  } catch (err) {
    toast((err as Error).message);
  }
}

function showConnect(prefill?: { owner?: string; repo?: string }): void {
  $('connect').classList.remove('hidden');
  if (prefill?.owner) input('connect-owner').value = prefill.owner;
  if (prefill?.repo) input('connect-repo').value = prefill.repo;
  input('connect-token').value = '';
  input('connect-token').focus();
}

function hideConnect(): void {
  $('connect').classList.add('hidden');
  $('connect-error').classList.add('hidden');
}

async function bootWorkspace(): Promise<void> {
  hideConnect();
  await loadHealth();
  await loadCollections();
}

async function boot(): Promise<void> {
  try {
    const status = await api<{ configured: boolean }>('/status');
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
  const submit = $('connect-submit') as HTMLButtonElement;
  errEl.classList.add('hidden');
  submit.disabled = true;
  submit.textContent = 'Connecting…';
  try {
    await api('/setup', {
      method: 'POST',
      body: JSON.stringify({
        token: input('connect-token').value.trim(),
        owner: input('connect-owner').value.trim(),
        repo: input('connect-repo').value.trim() || 'my-app-db',
      }),
    });
    toast('Connected');
    await bootWorkspace();
  } catch (err) {
    errEl.classList.remove('hidden');
    errEl.textContent = (err as Error).message;
    errEl.style.borderColor = 'var(--danger)';
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
  if (!$('storage-view').classList.contains('hidden')) {
    await loadStorage();
  }
});

$('new-doc').addEventListener('click', openNewEditor);
$('empty-new').addEventListener('click', openNewEditor);
$('save-doc').addEventListener('click', () => void saveDocument());
$('delete-doc').addEventListener('click', () => void deleteDocument());
$('cancel-edit').addEventListener('click', () => {
  showView('table');
  if (currentCollection) setWorkspace('Collection', currentCollection);
});
$('view-kv').addEventListener('click', () => void viewKv());
$('view-storage').addEventListener('click', () => void viewStorage());
$('kv-save').addEventListener('click', () => void saveKv());
$('upload-form').addEventListener('submit', (event) => void uploadFile(event));
input('search').addEventListener('input', renderTable);
$('new-collection').addEventListener('click', () => {
  const name = prompt('Collection name');
  if (!name) return;
  currentCollection = name.trim();
  ($('new-doc') as HTMLButtonElement).disabled = false;
  input('search').disabled = false;
  setWorkspace('Collection', currentCollection);
  documents = [];
  showView('table');
  renderTable();
  toast('Add a document to create it on GitHub');
});

void boot();
