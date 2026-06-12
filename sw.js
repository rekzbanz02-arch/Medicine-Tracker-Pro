// =====================================================
// Medicine Tracker Pro — Service Worker
// =====================================================

const CACHE = "med-pro-v2";

const ASSETS = [
  "./",
  "./MedicineSched.html",
  "./app.js",
  "./manifest.json"
];

// ---------------- INSTALL: precache core assets ----------------
self.addEventListener("install", e=>{
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ---------------- ACTIVATE: clean old caches ----------------
self.addEventListener("activate", e=>{
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ---------------- FETCH: cache-first, fallback to network ----------------
self.addEventListener("fetch", e=>{
  if(e.request.method !== "GET") return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if(cached) return cached;

      return fetch(e.request).then(response => {
        // Cache successful same-origin responses for next time
        if(response.ok && e.request.url.startsWith(self.location.origin)){
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(()=> cached);
    })
  );
});

// ---------------- PUSH NOTIFICATIONS ----------------
self.addEventListener("push", function(event){
  let data = { title: "🌿 Medicine Reminder", body: "Time to take your medicine" };

  try {
    if(event.data) data = event.data.json();
  } catch(e){
    // keep default
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "icon.png",
      badge: "icon.png",
      vibrate: [200, 100, 200]
    })
  );
});

// ---------------- NOTIFICATION CLICK ----------------
self.addEventListener("notificationclick", event=>{
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then(clients=>{
      for(const client of clients){
        if(client.url.includes("MedicineSched.html") && "focus" in client){
          return client.focus();
        }
      }
      if(self.clients.openWindow) return self.clients.openWindow("./MedicineSched.html");
    })
  );
});
