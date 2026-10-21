import { DEF_S, DEF_B, DN, PAL } from "./config.js";
import { state } from "./state.js";
import { getDateInputValue, localDateTime, niceDate, pad, escapeHtml, fh, dur } from "./utils.js";
import {
  readReminderSettings,
  saveReminderSettings,
  readSentReminders,
  saveSentReminders,
  photoDBAction,
  compressPhoto
} from "./storage.js";

function getElement(id) {
  return document.getElementById(id);
}

export function homeworkCounts() {
  const counts = {};
  state.homework.forEach((item) => {
    if (item.status !== "done" && item.subjectId) {
      counts[item.subjectId] = (counts[item.subjectId] || 0) + 1;
    }
  });
  return counts;
}

export function homeworkIsOverdue(item) {
  return item.status !== "done" && localDateTime(item.dueDate, item.dueTime) < new Date();
}

export function subjectLabel(subjectId) {
  return state.subjects[subjectId] ? `${state.subjects[subjectId][1]} ${state.subjects[subjectId][0]}` : "Matière indisponible";
}

export function renderHomework() {
  const stats = getElement("hwStats");
  const list = getElement("hwList");
  if (!stats || !list) return;

  const pending = state.homework.filter((item) => item.status !== "done");
  const overdue = pending.filter((item) => homeworkIsOverdue(item));

  stats.innerHTML = `
    <div class='hwstat'><strong>${pending.length}</strong><span>À terminer</span></div>
    <div class='hwstat'><strong>${overdue.length}</strong><span>En retard</span></div>
    <div class='hwstat'><strong>${state.homework.filter((item) => item.status === "done").length}</strong><span>Terminés</span></div>
  `;

  let filtered = state.homework.filter((item) => {
    if (state.homeworkFilter === "done") return item.status === "done";
    if (state.homeworkFilter === "overdue") return homeworkIsOverdue(item);
    if (state.homeworkFilter === "upcoming") return item.status !== "done" && !homeworkIsOverdue(item);
    return true;
  });

  filtered = filtered.sort((a, b) => (localDateTime(a.dueDate, a.dueTime) || new Date(8640000000000000)) - (localDateTime(b.dueDate, b.dueTime) || new Date(8640000000000000)));

  list.innerHTML = "";

  if (!filtered.length) {
    const message = state.homeworkFilter === "overdue"
      ? "Aucun devoir en retard. Bien joué ! 🎉"
      : state.homeworkFilter === "done"
        ? "Aucun devoir terminé pour le moment."
        : "Tout est au clair pour le moment.";
    list.innerHTML = `<div class='hwempty'>${message}</div>`;
    return;
  }

  filtered.forEach((item) => {
    const done = item.status === "done";
    const overdueFlag = homeworkIsOverdue(item);
    const card = document.createElement("article");
    card.className = "hwcard";

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "hwcheck";
    check.checked = done;
    check.setAttribute("aria-label", done ? "Marquer comme à faire" : "Marquer comme terminé");
    check.onchange = () => {
      item.status = check.checked ? "done" : "todo";
      localStorage.setItem("edt-homework-v1", JSON.stringify(state.homework));
      renderHomework();
    };

    const main = document.createElement("div");
    const title = document.createElement("div");
    title.className = "hwtitle";
    title.textContent = item.title;
    if (done) title.style.textDecoration = "line-through";

    const meta = document.createElement("div");
    meta.className = "hwmeta";

    const subject = document.createElement("span");
    subject.textContent = subjectLabel(item.subjectId);
    meta.appendChild(subject);

    const due = document.createElement("span");
    due.textContent = `📅 ${niceDate(item.dueDate)}${item.dueTime ? ` · ${item.dueTime}` : ""}`;
    meta.appendChild(due);

    const tags = document.createElement("div");
    tags.className = "hwmeta";

    const priority = document.createElement("span");
    priority.className = `hwtag ${(item.priority || "medium")}`;
    priority.textContent = {
      high: "Priorité haute",
      medium: "Priorité normale",
      low: "Priorité basse"
    }[item.priority || "medium"];
    tags.appendChild(priority);

    const stateTag = document.createElement("span");
    stateTag.className = `hwtag ${done ? "done" : overdueFlag ? "overdue" : ""}`;
    stateTag.textContent = done ? "Terminé" : overdueFlag ? "En retard" : "À faire";
    tags.appendChild(stateTag);

    main.appendChild(title);
    main.appendChild(meta);
    main.appendChild(tags);

    if (item.notes) {
      const note = document.createElement("div");
      note.className = "hwdesc";
      note.textContent = item.notes;
      main.appendChild(note);
    }

    const acts = document.createElement("div");
    acts.className = "hwacts";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "✏️";
    editButton.title = "Modifier le devoir";
    editButton.onclick = () => openHomeworkDialog(item.id);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "🗑️";
    deleteButton.title = "Supprimer le devoir";
    deleteButton.onclick = () => {
      if (confirm(`Supprimer le devoir « ${item.title} » ?`)) {
        state.homework = state.homework.filter((entry) => entry.id !== item.id);
        localStorage.setItem("edt-homework-v1", JSON.stringify(state.homework));
        photoDBAction("delete", item.id).catch(() => {});
        renderHomework();
      }
    };

    acts.appendChild(editButton);
    acts.appendChild(deleteButton);

    card.appendChild(check);
    card.appendChild(main);
    card.appendChild(acts);
    list.appendChild(card);
  });
}

export function openHomeworkDialog(id) {
  const dialog = getElement("dH");
  const subject = getElement("hwSubject");
  const title = getElement("hwTitle");
  const date = getElement("hwDate");
  const time = getElement("hwTime");
  const priority = getElement("hwPriority");
  const notes = getElement("hwNotes");
  const deleteBtn = getElement("hwDelete");
  const photoInput = getElement("hwPhoto");
  const photoRemove = getElement("hwPhotoRemove");

  state.homeworkEditId = id || null;
  state.pendingPhotoData = null;
  photoInput.value = "";
  photoRemove.style.display = "none";

  const existing = id ? state.homework.find((entry) => entry.id === id) : null;
  const keys = Object.keys(state.subjects).filter((key) => key !== "free");
  subject.innerHTML = keys.map((key) => `<option value='${key}'>${escapeHtml(`${state.subjects[key][1]} ${state.subjects[key][0]}`)}</option>`).join("");

  if (!keys.length) {
    getElement("hwError").textContent = "Ajoute d'abord une matière dans la gestion des matières.";
    return;
  }

  getElement("hwDialogTitle").textContent = existing ? "✏️ Modifier le devoir" : "＋ Ajouter un devoir";
  subject.value = existing && state.subjects[existing.subjectId] ? existing.subjectId : keys[0];
  title.value = existing ? existing.title : "";
  date.value = existing ? existing.dueDate : getDateInputValue();
  time.value = existing ? (existing.dueTime || "") : "";
  priority.value = existing ? (existing.priority || "medium") : "medium";
  notes.value = existing ? (existing.notes || "") : "";
  getElement("hwError").textContent = "";
  deleteBtn.style.display = existing ? "" : "none";
  dialog.showModal();

  if (existing) {
    photoDBAction("get", existing.id).then((data) => {
      if (data) {
        state.pendingPhotoData = data;
        const preview = getElement("hwPhotoPreview");
        preview.src = data;
        preview.style.display = "block";
        photoRemove.style.display = "inline-block";
      }
    });
  }
}

export function reminderSupport() {
  if (!window.isSecureContext) return "Les notifications nécessitent HTTPS (ou localhost).";
  if (!("Notification" in window)) return "Ce navigateur ne prend pas en charge les notifications.";
  return "";
}

export function reminderStatus(message) {
  const el = getElement("reminderStatus");
  if (el) el.textContent = message;
}

export function updateReminderUI() {
  const unsupported = reminderSupport();
  const settings = readReminderSettings();
  const enabled = settings.enabled === true && "Notification" in window && Notification.permission === "granted";
  const button = getElement("reminderEnable");
  if (button) button.textContent = enabled ? "Notifications activées" : "Activer les rappels";

  if (unsupported) {
    reminderStatus(unsupported);
    return;
  }

  if (Notification.permission === "granted") {
    reminderStatus("Notifications autorisées. Les rappels seront vérifiés automatiquement.");
  } else if (Notification.permission === "denied") {
    reminderStatus("Les notifications ont été refusées. Tu peux les réactiver dans les paramètres du navigateur.");
  } else {
    reminderStatus("Autorise les notifications pour recevoir les rappels de devoirs.");
  }
}

export function showLocalReminder(title, body, tag) {
  return navigator.serviceWorker.ready.then((reg) => {
    if (!reg || !reg.showNotification) throw new Error("Notifications du service worker indisponibles");
    return reg.showNotification(title, { body, tag, icon: "icons/icon-192.png" });
  });
}

export function enableHomeworkReminders() {
  const unsupported = reminderSupport();
  if (unsupported) {
    reminderStatus(unsupported);
    return;
  }

  if (Notification.permission === "denied") {
    updateReminderUI();
    return;
  }

  Notification.requestPermission().then((permission) => {
    const settings = readReminderSettings();
    settings.enabled = permission === "granted";
    saveReminderSettings(settings);
    updateReminderUI();
    if (permission === "granted") {
      showLocalReminder("Rappels de devoirs", "Les rappels sont activés.", "edt-reminder-enabled");
    }
  });
}

export function testHomeworkReminder() {
  const unsupported = reminderSupport();
  if (unsupported) {
    updateReminderUI();
    return;
  }

  if (Notification.permission !== "granted") {
    reminderStatus("Active d’abord les notifications.");
    return;
  }

  showLocalReminder("Test de rappel", "Ceci est un test de notification pour les devoirs.", "edt-reminder-test").catch(() => {
    reminderStatus("Le test a échoué. Vérifie les permissions du navigateur.");
  });
}

export function checkHomeworkReminders() {
  const settings = readReminderSettings();
  if (!settings.enabled || !window.Notification || Notification.permission !== "granted") return;

  const now = new Date();
  const sent = readSentReminders();

  state.homework.filter((item) => item.status !== "done").forEach((item) => {
    const due = localDateTime(item.dueDate, item.dueTime);
    if (!due) return;

    const reminderKey = `${item.id}-${due.toISOString().slice(0, 10)}`;
    const timeToDue = due.getTime() - now.getTime();
    const shouldSend = (timeToDue <= 18 * 60 * 60 * 1000 && timeToDue > 0) || (Math.abs(timeToDue) <= 60 * 60 * 1000 && item.status !== "done");

    if (!shouldSend || sent.includes(reminderKey)) return;

    sent.push(reminderKey);
    saveSentReminders(sent);
    showLocalReminder("À faire demain", `${item.title} · ${subjectLabel(item.subjectId)}`, "edt-homework-reminder").catch(() => {});
  });
}

export function startReminderChecks() {
  if (state.reminderTimer) clearInterval(state.reminderTimer);
  checkHomeworkReminders();
  state.reminderTimer = setInterval(checkHomeworkReminders, 60000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkHomeworkReminders();
  });
}

export function initHomeworkEvents() {
  getElement("hwAdd").onclick = () => openHomeworkDialog(null);
  getElement("hwCancel").onclick = () => getElement("dH").close();
  getElement("hwFilters").onclick = (event) => {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    state.homeworkFilter = button.dataset.filter;
    [...getElement("hwFilters").querySelectorAll("button")].forEach((item) => {
      item.classList.toggle("on", item === button);
    });
    renderHomework();
  };

  getElement("reminderEnable").onclick = enableHomeworkReminders;
  getElement("reminderTest").onclick = testHomeworkReminder;

  getElement("hwPhoto").onchange = () => {
    const file = getElement("hwPhoto").files && getElement("hwPhoto").files[0];
    if (!file) return;

    getElement("hwError").textContent = "Compression de la photo…";
    compressPhoto(file).then((data) => {
      state.pendingPhotoData = data;
      const preview = getElement("hwPhotoPreview");
      preview.src = data || "";
      preview.style.display = data ? "block" : "none";
      getElement("hwPhotoRemove").style.display = data ? "inline-block" : "none";
      getElement("hwError").textContent = "";
    }).catch((error) => {
      getElement("hwError").textContent = error.message || "Impossible de traiter la photo.";
    });
  };

  getElement("hwPhotoRemove").onclick = () => {
    state.pendingPhotoData = "";
    getElement("hwPhoto").value = "";
    const preview = getElement("hwPhotoPreview");
    preview.src = "";
    preview.style.display = "none";
    getElement("hwPhotoRemove").style.display = "none";
  };

  getElement("hwForm").onsubmit = (event) => {
    event.preventDefault();
    const title = getElement("hwTitle").value.trim();
    const date = getElement("hwDate").value;
    const time = getElement("hwTime").value;
    const subjectId = getElement("hwSubject").value;

    if (!title) {
      getElement("hwError").textContent = "Donne un titre au devoir.";
      return;
    }
    if (!date) {
      getElement("hwError").textContent = "Choisis une date limite.";
      return;
    }
    if (!localDateTime(date, time)) {
      getElement("hwError").textContent = "Date invalide.";
      return;
    }

    const old = state.homeworkEditId ? state.homework.find((item) => item.id === state.homeworkEditId) : null;
    const item = {
      id: old ? old.id : `hw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      subjectId,
      title,
      dueDate: date,
      dueTime: time,
      priority: getElement("hwPriority").value,
      status: old ? old.status : "todo",
      notes: getElement("hwNotes").value.trim()
    };

    if (old) {
      state.homework = state.homework.map((entry) => (entry.id === old.id ? { ...entry, ...item } : entry));
    } else {
      state.homework.push(item);
    }

    if (state.pendingPhotoData !== null && state.pendingPhotoData !== "") {
      photoDBAction("put", item.id, state.pendingPhotoData).catch(() => {});
    }

    if (state.pendingPhotoData === "") {
      photoDBAction("delete", item.id).catch(() => {});
    }

    localStorage.setItem("edt-homework-v1", JSON.stringify(state.homework));
    renderHomework();
    getElement("dH").close();
  };

  getElement("hwDelete").onclick = () => {
    const item = state.homework.find((entry) => entry.id === state.homeworkEditId);
    if (!item) return;
    if (confirm(`Supprimer le devoir « ${item.title} » ?`)) {
      state.homework = state.homework.filter((entry) => entry.id !== state.homeworkEditId);
      localStorage.setItem("edt-homework-v1", JSON.stringify(state.homework));
      photoDBAction("delete", item.id).catch(() => {});
      renderHomework();
      getElement("dH").close();
    }
  };
}

export function initAppStateFromStorage() {
  const saved = loadSchedule();
  const defaultSchedule = { S: { ...DEF_S }, B: [...DEF_B] };
  state.subjects = saved.S && Object.keys(saved.S).length ? saved.S : defaultSchedule.S;
  state.blocks = saved.B && saved.B.length ? saved.B : defaultSchedule.B;
  state.homework = loadHomework();
  state.selectedDay = new Date().getDay() === 0 ? 7 : new Date().getDay();
  if (state.selectedDay < 1 || state.selectedDay > 5) state.selectedDay = 1;
}
