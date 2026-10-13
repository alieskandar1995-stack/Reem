const CACHE_NAME = 'hisabati-v6';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // icon.svg أُزيل — الأيقونة الآن Data URI داخل index.html و manifest.json
      cache.addAll(['/', '/index.html', '/manifest.json'])
    ).catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME && k !== 'shared-files')
            .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith(handleShareTarget(event.request));
    return;
  }

  if (event.request.method !== 'GET') return;
  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((c) => c || caches.match('/index.html')))
  );
});

async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('report') || formData.get('file');

    if (file && file.size > 0 && file.size < 5 * 1024 * 1024) {
      const text = await file.text();
      const cache = await caches.open('shared-files');
      const response = new Response(text, {
        headers: {
          'Content-Type': 'application/json',
          'X-Filename': file.name || 'report.json',
          'X-Shared-At': new Date().toISOString()
        }
      });
      await cache.put('/__shared-file', response);
    }
  } catch (e) {
    console.error('Share target error:', e);
  }

  return Response.redirect('/?shared=1', 303);
}