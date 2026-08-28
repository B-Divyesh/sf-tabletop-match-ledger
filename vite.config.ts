import { createHash } from 'node:crypto';
import { readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

async function filesIn(directory: string, relative = ''): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const path = `${relative}/${entry.name}`;
    return entry.isDirectory() ? filesIn(resolve(directory, entry.name), path) : [path];
  }));
  return files.flat();
}

function offlineWorker(): Plugin {
  return {
    name: 'ledger-offline-worker',
    apply: 'build',
    async closeBundle() {
      const output = resolve(__dirname, 'dist');
      const precache = (await filesIn(output)).filter(file => !file.endsWith('.map') && !['/sw.js', '/_headers'].includes(file));
      const version = createHash('sha256').update(precache.join('\n')).digest('hex').slice(0, 12);
      const source = `const VERSION = 'ledger-${version}';
const SHELL = \`${'${VERSION}'}-shell\`;
const RUNTIME = \`${'${VERSION}'}-runtime\`;
const PRECACHE = ${JSON.stringify(precache)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => ![SHELL, RUNTIME].includes(key)).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ valid: false, reason: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => { const copy = response.clone(); caches.open(RUNTIME).then(cache => cache.put(request, copy)); return response; }).catch(async () => (await caches.match(request)) || (await caches.match('/index.html')) || caches.match('/offline.html')));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => { if (response.ok) { const copy = response.clone(); caches.open(RUNTIME).then(cache => cache.put(request, copy)); } return response; })));
});
self.addEventListener('message', event => { if (event.data === 'SKIP_WAITING') self.skipWaiting(); });
`;
      await writeFile(resolve(output, 'sw.js'), source);
    }
  };
}

export default defineConfig({
  plugins: [offlineWorker()],
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        privacy: resolve(__dirname, 'privacy/index.html'),
        terms: resolve(__dirname, 'terms/index.html')
      }
    }
  }
});
