// =====================================================
// Medicine Tracker Pro — Service Worker (fixed)
// =====================================================

const CACHE = "med-pro-v3";
const ASSETS = [
  "./",
  "./MedicineTrackerPro.html",
  "./MedicineTrackerPro.html",
  "./app.js",
  "./manifest.json"
];

let reminderTimers = [];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(ASSETS.map(asset => cache.add(asset)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if(cached) return cached;
      return fetch(event.request).then(response => {
        if(response && response.ok && event.request.url.startsWith(self.location.origin)){
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached || caches.match("./MedicineTrackerPro.html"));
    })
  );
});

self.addEventListener("message", event => {
  const { type, payload } = event.data || {};
  if(type === "SCHEDULE_REMINDERS"){
    scheduleAll((payload && payload.meds) || []);
  }
});

function scheduleAll(meds){
  reminderTimers.forEach(timer => clearTimeout(timer));
  reminderTimers = [];

  const now = new Date();
  meds.forEach(med => {
    if(!med || !med.time || !med.name) return;

    const [hour, minute] = String(med.time).split(":").map(Number);
    if(Number.isNaN(hour) || Number.isNaN(minute)) return;

    const target = new Date();
    target.setHours(hour, minute, 0, 0);
    if(target <= now) target.setDate(target.getDate() + 1);

    const delay = Math.max(1000, target.getTime() - now.getTime());
    const timer = setTimeout(() => {
      showMedicineNotification(med);
      scheduleAll(meds); // prepare the next daily reminder after firing
    }, delay);

    reminderTimers.push(timer);
  });
}

function showMedicineNotification(med){
  self.registration.showNotification("💊 Medicine Reminder", {
    body: "Time to take: " + med.name,
    tag: "medicine-" + med.id,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: { url: "./MedicineTrackerPro.html", medId: med.id }
  });
}

self.addEventListener("push", event => {
  let data = { title: "💊 Medicine Reminder", body: "Time to take your medicine" };
  try{
    if(event.data) data = event.data.json();
  }catch(e){}

  event.waitUntil(
    self.registration.showNotification(data.title || "💊 Medicine Reminder", {
      body: data.body || "Time to take your medicine",
      tag: data.tag || "medicine-reminder",
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: { url: "./MedicineTrackerPro.html" }
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = new URL((event.notification.data && event.notification.data.url) || "./MedicineTrackerPro.html", self.location.href).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      for(const client of clients){
        if(client.url === targetUrl && "focus" in client) return client.focus();
      }
      if(self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
