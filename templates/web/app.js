const API = 'http://127.0.0.1:3850/api';
const COLLECTION = 'notices';

const where = document.getElementById('where');
const feed = document.getElementById('feed');
const form = document.getElementById('compose');
const statusEl = document.getElementById('status');

function setStatus(text) {
  statusEl.textContent = text;
}

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
}

function formatWhen(ts) {
  if (!ts) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts));
}

function render(documents) {
  const notes = [...documents].sort(
    (a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)
  );
  feed.innerHTML = notes
    .map(
      (note) => `
    <article class="notice">
      <strong>${escapeHtml(note.author || 'Anonymous')}</strong>
      <time>${escapeHtml(formatWhen(note.createdAt))}</time>
      <p>${escapeHtml(note.body || '')}</p>
    </article>`
    )
    .join('');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function load() {
  const health = await api('/health');
  where.textContent = `${health.owner}/${health.repo} · collection ${COLLECTION}`;
  const { documents } = await api(`/collections/${COLLECTION}`);
  render(documents);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const author = document.getElementById('author').value.trim();
  const body = document.getElementById('body').value.trim();
  if (!author || !body) return;
  setStatus('Writing…');
  try {
    await api(`/collections/${COLLECTION}`, {
      method: 'POST',
      body: JSON.stringify({ author, body, createdAt: Date.now(), source: 'templates/web' }),
    });
    document.getElementById('body').value = '';
    setStatus('Saved in the repo.');
    await load();
  } catch (err) {
    setStatus(err.message);
  }
});

load().catch((err) => {
  where.textContent = 'Could not reach git3 serve. Run: npx git3 serve';
  setStatus(err.message);
});
