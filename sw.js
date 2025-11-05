const CACHE = 'recycle-ai-v3';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './manifest.json',
  // Local vendor libs
  './vendor/tf.min.js',
  './vendor/mobilenet.min.js',
  // Local MobileNet model (v2 1.0 224)
  './vendor/mobilenet/model.json',
  './vendor/mobilenet/group1-shard1of4.bin',
  './vendor/mobilenet/group1-shard2of4.bin',
  './vendor/mobilenet/group1-shard3of4.bin',
  './vendor/mobilenet/group1-shard4of4.bin'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
});
self.addEventListener('fetch', (e) => {
  const { request } = e;
  e.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
      return resp;
    }).catch(() => cached))
  );
});
