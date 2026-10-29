const CACHE='memo-shell-online-v28';
const SCOPE=new URL(self.registration.scope);
const INDEX_URL=new URL('index.html',SCOPE).href;
const CORE=['index.html','tasks.html','tasks-store.js','supabase.js','cloud-config.js','cloud-sync.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','mobile-one-screen.js?v=21','push.js?v=1'].map(name=>new URL(name,SCOPE).href);
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.origin!==location.origin||event.request.method!=='GET'||!url.pathname.startsWith(SCOPE.pathname))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
    return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||(event.request.mode==='navigate'?caches.match(INDEX_URL):Response.error()))));
});

function storeTestReceipt(payload) {
  if (!String(payload.title || '').includes('재시험')) return Promise.resolve();
  return new Promise(resolve => {
    const request = indexedDB.open('memo-push-receipts', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('receipts')) db.createObjectStore('receipts', { keyPath: 'id' });
    };
    request.onerror = () => resolve();
    request.onsuccess = () => {
      const db = request.result;
      try {
        const tx = db.transaction('receipts', 'readwrite');
        tx.objectStore('receipts').put({ id: String(payload.tag || Date.now()), title: String(payload.title || ''), receivedAt: new Date().toISOString(), displayStatus: String(payload.displayStatus || 'push-event') });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); resolve(); };
      } catch { db.close(); resolve(); }
    };
  });
}

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch {}
  const title = payload.title || '메모장 알림';
  const options = {
    body: payload.body || '설정한 알림 시간이에요.',
    icon: new URL('icon-192.png', SCOPE).href,
    badge: new URL('icon-192.png', SCOPE).href,
    tag: payload.tag || 'memo-push',
    requireInteraction: String(payload.title || '').includes('재시험'),
    data: { url: payload.url || INDEX_URL }
  };
  event.waitUntil(self.registration.showNotification(title, options).then(() => storeTestReceipt(Object.assign({}, payload, { displayStatus: 'resolved' })), () => storeTestReceipt(Object.assign({}, payload, { displayStatus: 'rejected' }))));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data && event.notification.data.url || INDEX_URL;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    for (const client of windows) {
      if (client.url.startsWith(SCOPE.origin + SCOPE.pathname)) {
        return client.focus().then(() => client.navigate ? client.navigate(target) : undefined);
      }
    }
    return self.clients.openWindow(target);
  }));
});
