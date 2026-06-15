// =====================================================
// Medicine Tracker Pro — app.js
// =====================================================

const MEDS_KEY = "medsList";

// ---------------- DEFAULT MEDICINES (first run only) ----------------
const DEFAULT_MEDS = [
  { id: "clopidogrel", name: "Clopidogrel", time: "08:00" },
  { id: "losartan",    name: "Losartan 100mg", time: "08:00" },
  { id: "amlodipine",  name: "Amlodipine", time: "08:00" }
];

// ---------------- UTIL ----------------
function todayKey(){
  return new Date().toDateString();
}

function uid(){
  return "m" + Date.now() + Math.floor(Math.random()*1000);
}

function showToast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(()=> t.classList.remove("show"), 2200);
}

// ---------------- MED LIST STORAGE ----------------
function getMeds(){
  const raw = localStorage.getItem(MEDS_KEY);
  if(raw) return JSON.parse(raw);
  const defaults = DEFAULT_MEDS.map(m => ({...m}));
  saveMeds(defaults);
  return defaults;
}

function saveMeds(list){
  localStorage.setItem(MEDS_KEY, JSON.stringify(list));
}

// ---------------- PER-MED HISTORY STORAGE ----------------
function getData(id){
  const raw = localStorage.getItem("med_" + id);
  return raw ? JSON.parse(raw) : { history: {} };
}

function saveData(id, data){
  localStorage.setItem("med_" + id, JSON.stringify(data));
}

// ---------------- STREAK CALCULATION ----------------
// Recomputes streak by walking backwards from today (or yesterday if
// today not yet marked) through consecutive "taken" days.
function computeStreak(data){
  let streak = 0;
  let d = new Date();

  // If today isn't marked yet, start counting from yesterday so an
  // unmarked "today" doesn't break an existing streak.
  if(data.history[d.toDateString()] !== true){
    d.setDate(d.getDate() - 1);
  }

  while(data.history[d.toDateString()] === true){
    streak++;
    d.setDate(d.getDate() - 1);
  }

  return streak;
}

// ---------------- RENDER MEDICINE CARDS ----------------
function renderMeds(){
  const list = getMeds();
  const container = document.getElementById("med-list");
  container.innerHTML = "";

  if(list.length === 0){
    container.innerHTML = `<div class="card small" style="text-align:center">No medicines yet. Tap "Add Medicine" below 🌱</div>`;
  }

  list.forEach(med=>{
    const data = getData(med.id);
    const checked = data.history[todayKey()] === true;
    const streak = computeStreak(data);

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>🌱 ${escapeHtml(med.name)}</h3>
      <div class="med-row">
        <label class="taken-toggle">
          <input type="checkbox" data-id="${med.id}" ${checked ? "checked" : ""}>
          Taken today
        </label>
        <span class="streak-badge">🔥 ${streak} day${streak===1?"":"s"}</span>
      </div>
      <div class="dose-time">
        ⏰ Reminder:
        <input type="time" data-time-id="${med.id}" value="${med.time || "08:00"}">
      </div>
      <div class="med-actions">
        <button class="danger" data-remove="${med.id}">🗑️ Remove</button>
      </div>
    `;
    container.appendChild(card);
  });

  attachMedListeners();
}

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------------- EVENT LISTENERS ----------------
function attachMedListeners(){
  document.querySelectorAll('input[type=checkbox][data-id]').forEach(cb=>{
    cb.addEventListener("change", ()=>{
      const id = cb.dataset.id;
      const data = getData(id);
      const t = todayKey();

      data.history[t] = cb.checked;
      saveData(id, data);

      const med = getMeds().find(m=>m.id===id);
      const medName = med ? med.name : id;

      if(cb.checked){
        showToast("✅ " + medName + " marked as taken");
        notify(medName + " taken ✔️");
      } else {
        showToast("↩️ " + medName + " unmarked");
      }

      renderMeds();
      renderCalendar();
    });
  });

  document.querySelectorAll('input[type=time][data-time-id]').forEach(inp=>{
    inp.addEventListener("change", ()=>{
      const id = inp.dataset.timeId;
      const list = getMeds();
      const med = list.find(m=>m.id===id);
      if(med){
        med.time = inp.value;
        saveMeds(list);
        showToast("⏰ Reminder time updated");
        syncReminders();
      }
    });
  });

  document.querySelectorAll('[data-remove]').forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.remove;
      const list = getMeds();
      const med = list.find(m=>m.id===id);
      if(!med) return;

      if(confirm(`Remove "${med.name}" and its history?`)){
        const filtered = list.filter(m=>m.id!==id);
        saveMeds(filtered);
        localStorage.removeItem("med_" + id);
        showToast("🗑️ " + med.name + " removed");
        renderMeds();
        renderCalendar();
      }
    });
  });
}

// ---------------- ADD MEDICINE DIALOG ----------------
function openAddDialog(){
  document.getElementById("new-med-name").value = "";
  document.getElementById("new-med-time").value = "08:00";
  const dialog = document.getElementById("add-dialog");
  if(typeof dialog.showModal === "function"){
    dialog.showModal();
  } else {
    dialog.setAttribute("open","");
  }
}

function closeAddDialog(){
  const dialog = document.getElementById("add-dialog");
  if(typeof dialog.close === "function"){
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
}

function addMedicine(){
  const nameInput = document.getElementById("new-med-name");
  const timeInput = document.getElementById("new-med-time");
  const name = nameInput.value.trim();

  if(!name){
    nameInput.focus();
    return;
  }

  const list = getMeds();
  list.push({ id: uid(), name: name, time: timeInput.value || "08:00" });
  saveMeds(list);

  closeAddDialog();
  showToast("🌱 " + name + " added");
  renderMeds();
  renderCalendar();
}

// ---------------- CALENDAR VIEW ----------------
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function renderCalendar(){
  const cal = document.getElementById("calendar");
  cal.innerHTML = "";

  const meds = getMeds();
  const todayStr = todayKey();
  let takenDaysCount = 0;
  let trackedDaysCount = 0;

  for(let i=6; i>=0; i--){
    let d = new Date();
    d.setDate(d.getDate() - i);
    let key = d.toDateString();
    let isToday = key === todayStr;

    let status;

    if(meds.length === 0){
      status = "future";
    } else {
      let takenCount = 0;
      meds.forEach(m=>{
        const data = getData(m.id);
        if(data.history[key] === true) takenCount++;
      });

      if(takenCount === 0){
        status = "missed";
      } else if(takenCount === meds.length){
        status = "taken";
        takenDaysCount++;
      } else {
        status = "partial";
      }
      trackedDaysCount++;
    }

    let div = document.createElement("div");
    div.className = "day " + status + (isToday ? " today" : "");
    div.innerHTML = `
      <span class="dow">${DOW[d.getDay()]}</span>
      <span class="icon">${d.getDate()}</span>
    `;
    cal.appendChild(div);
  }

  const summary = document.getElementById("overall-summary");
  if(meds.length === 0){
    summary.textContent = "Add a medicine to start tracking your week 🌿";
  } else {
    summary.textContent = `Fully on track ${takenDaysCount} of ${trackedDaysCount} day${trackedDaysCount===1?"":"s"} this week`;
  }
}

// ---------------- MISS DOSE CHECK ----------------
function checkMissed(){
  const t = todayKey();
  const meds = getMeds();

  meds.forEach(m=>{
    const data = getData(m.id);
    if(data.history[t] !== true){
      notify("⏰ Don't forget: " + m.name);
    }
  });
}

// ---------------- NOTIFICATIONS ----------------
function notify(msg){
  if("Notification" in window && Notification.permission === "granted"){
    new Notification("🌿 Medicine Tracker", { body: msg });
  }
}

// ---------------- PUSH / SERVICE WORKER ----------------
async function enablePush(){
  if(!("Notification" in window)){
    showToast("Notifications not supported on this browser");
    return;
  }

  const perm = await Notification.requestPermission();

  if(perm !== "granted"){
    showToast("Notification permission denied");
    return;
  }

  if("serviceWorker" in navigator){
    try {
      const reg = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
      await navigator.serviceWorker.ready;
      reg.active?.postMessage({ type: "SCHEDULE_REMINDERS", payload: { meds: getMeds().filter(m => m.time) } });
      localStorage.setItem("medTrackerPro_pushEnabled", "1");
      console.log("Service Worker ready:", reg);
      showToast("🔔 Background alerts enabled");
    } catch(err){
      console.error(err);
      showToast("Could not enable background alerts");
    }
  } else {
    showToast("🔔 Notifications enabled");
  }
}

// ---------------- INIT ----------------
function init(){
  renderMeds();
  renderCalendar();
  checkMissed();
}

init();
setInterval(checkMissed, 60 * 60 * 1000); // hourly check instead of every minute


function syncReminders(){
  if(localStorage.getItem("medTrackerPro_pushEnabled") !== "1") return;
  if(!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready.then(reg => {
    const worker = reg.active || reg.waiting || reg.installing;
    worker?.postMessage({ type: "SCHEDULE_REMINDERS", payload: { meds: getMeds().filter(m => m.time) } });
  }).catch(console.warn);
}
