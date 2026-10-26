const CACHE='memo-shell-online-v5';
const SCOPE=new URL(self.registration.scope);
const INDEX_URL=new URL('index.html',SCOPE).href;
const CORE=['index.html','tasks.html','tasks-store.js','supabase.js','cloud-config.js','cloud-sync.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png'].map(name=>new URL(name,SCOPE).href);
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
