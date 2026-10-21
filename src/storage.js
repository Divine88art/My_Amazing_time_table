import { pad } from "./utils.js";

const STORAGE_KEYS = {
  schedule: "edt-data",
  homework: "edt-homework-v1",
  reminders: "edt-homework-reminders-v1",
  sentReminders: "edt-homework-reminders-sent-v1",
  theme: "edt-th"
};

export function loadJson(key, fallbackValue) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallbackValue;
    return JSON.parse(raw);
  } catch (error) {
    return fallbackValue;
  }
}

export function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    return false;
  }
}

export function loadSchedule() {
  const raw = loadJson(STORAGE_KEYS.schedule, null);
  return raw && raw.S && raw.B ? raw : { S: {}, B: [] };
}

export function saveSchedule(subjects, blocks) {
  return saveJson(STORAGE_KEYS.schedule, { S: subjects, B: blocks });
}

export function loadHomework() {
  const parsed = loadJson(STORAGE_KEYS.homework, []);
  return Array.isArray(parsed)
    ? parsed.filter((item) => item && typeof item.id === "string" && typeof item.title === "string")
    : [];
}

export function saveHomework(homework) {
  return saveJson(STORAGE_KEYS.homework, homework);
}

export function readReminderSettings() {
  return loadJson(STORAGE_KEYS.reminders, {});
}

export function saveReminderSettings(value) {
  return saveJson(STORAGE_KEYS.reminders, value);
}

export function readSentReminders() {
  const arr = loadJson(STORAGE_KEYS.sentReminders, []);
  return Array.isArray(arr) ? arr : [];
}

export function saveSentReminders(value) {
  return saveJson(STORAGE_KEYS.sentReminders, value);
}

export function openPhotoDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB indisponible"));
      return;
    }

    const request = indexedDB.open("edt-homework-photos-v1", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("photos")) {
        db.createObjectStore("photos", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function photoDBAction(mode, id, value) {
  return openPhotoDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction("photos", mode === "get" ? "readonly" : "readwrite");
    const store = tx.objectStore("photos");
    const request = mode === "get"
      ? store.get(id)
      : mode === "delete"
        ? store.delete(id)
        : store.put({ id, data: value });

    request.onsuccess = () => resolve(mode === "get" ? (request.result && request.result.data) : null);
    request.onerror = () => reject(request.error);
  }));
}

export function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }

    if (!file.type || file.type.indexOf("image/") !== 0) {
      reject(new Error("Choisis un fichier image."));
      return;
    }

    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const max = 1400;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Compression impossible."));
            return;
          }

          const reader2 = new FileReader();
          reader2.onload = () => resolve(reader2.result);
          reader2.onerror = () => reject(new Error("Impossible de lire la photo."));
          reader2.readAsDataURL(blob);
        }, "image/jpeg", 0.8);
      };
      img.src = reader.result;
    };

    reader.onerror = () => reject(new Error("Impossible de lire le fichier."));
    reader.readAsDataURL(file);
  });
}

export function getStorageTheme() {
  return localStorage.getItem(STORAGE_KEYS.theme) || "";
}

export function saveStorageTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEYS.theme, theme);
  } catch (error) {
    // ignore
  }
}

export function getDateInputValue(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
