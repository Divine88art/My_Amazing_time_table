import { DEF_S, DEF_B, DN, PAL } from "./config.js";
import { state } from "./state.js";
import { clone, escapeHtml, fh, pad, dur, localDateTime, niceDate, renderTimeZones, fgOf, s2t, t2s } from "./utils.js";
import { loadSchedule, saveSchedule, loadHomework, saveHomework, saveStorageTheme, getStorageTheme, readReminderSettings, saveReminderSettings, readSentReminders, saveSentReminders } from "./storage.js";
import { renderSchedule, tick, initCourseEditorHandlers, initSubjectEditorHandlers, renderSubjectEditor, initViewSwitch, openCourseDialog, initHomeworkEvents, renderHomework, updateReminderUI, startReminderChecks, renderHomework as renderHomeworks, reminderSupport, enableHomeworkReminders, testHomeworkReminder } from "./schedule.js";

function getElement(id) { return document.getElementById(id); }

export function initializeApp() {
  const stored = loadSchedule();
  state.subjects = stored.S && Object.keys(stored.S).length ? stored.S : { ...DEF_S };
  state.blocks = stored.B && stored.B.length ? stored.B : [...DEF_B];
  state.homework = loadHomework();

  const theme = getStorageTheme();
  if (theme) document.documentElement.dataset.theme = theme;

  renderSchedule();
  renderHomework();
  initCourseEditorHandlers();
  initSubjectEditorHandlers();
  initViewSwitch();
  initHomeworkEvents();
  setDisplayMode();
  renderTimeZones();

  const thButton = getElement("th");
  if (thButton) {
    thButton.onclick = () => {
      const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = nextTheme;
      saveStorageTheme(nextTheme);
    };
  }

  const printButton = getElement("prt");
  if (printButton) printButton.onclick = () => window.print();

  setInterval(() => {
    tick();
    renderTimeZones();
  }, 1000);

  startReminderChecks();
  updateReminderUI();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
}

export function setDisplayMode() {
  const mobile = window.matchMedia("(max-width: 720px)").matches;
  document.documentElement.classList.toggle("mobile", mobile);
  document.body.dataset.display = mobile ? "mobile" : "desktop";
  const tabs = getElement("tabs");
  if (tabs) tabs.setAttribute("aria-hidden", mobile ? "false" : "true");
}

window.addEventListener("DOMContentLoaded", initializeApp);
