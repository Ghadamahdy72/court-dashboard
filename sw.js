// ─── Service Worker: Cache Strategy ───────────────────────────
const CACHE_NAME = 'court-dash-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap'
];

// ─── تثبيت Service Worker وتخزين الموارد الثابتة ───
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('تحذير: تعذر تخزين بعض الموارد:', err);
        // نتابع حتى لو فشل بعض الموارد
        return cache.addAll(
          STATIC_ASSETS.filter(url => !url.includes('https://'))
        );
      });
    })
  );
  self.skipWaiting();
});

// ─── تنشيط Service Worker وتنظيف الـ Caches القديمة ───
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ─── معالجة الطلبات: Cache First للموارد الثابتة، Network First للبقية ───
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // تخطي الطلبات غير الـ GET
  if (request.method !== 'GET') {
    return;
  }

  // استراتيجية مختلفة حسب نوع المورد
  if (url.pathname === '/' || url.pathname === '/index.html' || 
      url.pathname.endsWith('.html') || 
      url.href.includes('fonts.googleapis.com') ||
      url.href.includes('cdn.jsdelivr.net')) {
    // Cache First: للموارد الثابتة (HTML، CSS، Libraries)
    event.respondWith(cacheFirst(request));
  } else {
    // Network First: للبيانات الديناميكية
    event.respondWith(networkFirst(request));
  }
});

// ─── Cache First Strategy ───────────────────────────────────
async function cacheFirst(request) {
  try {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // إذا فشل الشبك والـ Cache، أرجع خطأ offline
    const offline = await caches.match('./index.html');
    if (offline) return offline;
    return new Response('لا يتوفر الإنترنت', { status: 503 });
  }
}

// ─── Network First Strategy ────────────────────────────────
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // إذا فشل الشبك، حاول الـ Cache
    const cached = await caches.match(request);
    return cached || new Response('لا يتوفر الإنترنت', { status: 503 });
  }
}

// ─── معالجة الرسائل من العميل (Optional) ───────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
