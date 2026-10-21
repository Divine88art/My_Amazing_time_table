import { DEF_B, DEF_S, DN, PAL } from "./config.js";
import { state } from "./state.js";
import { escapeHtml, fh, dur, pad, fgOf, localDateTime, t2s } from "./utils.js";
import {
  loadSchedule,
  saveSchedule,
  loadHomework,
  saveHomework,
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

export function setDisplayMode() {
  const mobile = window.matchMedia("(max-width: 720px)").matches;
  document.documentElement.classList.toggle("mobile", mobile);
  document.body.dataset.display = mobile ? "mobile" : "desktop";
  const tabs = getElement("tabs");
  if (tabs) {
    tabs.setAttribute("aria-hidden", mobile ? "false" : "true");
  }
}

function nextClassInfo(subjectId) {
  const now = new Date();
  const today = new Date().getDay() === 0 ? 7 : new Date().getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  let best = null;

  state.blocks.forEach((block) => {
    if (block[1] !== subjectId) return;
    const startMinutes = block[2] * 60;
    const endMinutes = block[3] * 60;
    const delta = (block[0] - today + 7) % 7;
    const upcoming = delta * 24 * 60 + startMinutes - minutes;
    if (upcoming >= 0 && (!best || upcoming < best)) best = upcoming;
  });

  if (!best) return null;

  const nextBlock = state.blocks.find((block) => block[1] === subjectId && ((block[0] - today + 7) % 7) * 24 * 60 + block[2] * 60 - minutes >= 0);
  if (!nextBlock) return null;

  const start = nextBlock[2];
  const end = nextBlock[3];
  const ongoing = now.getDay() === nextBlock[0] && start <= (now.getHours() + now.getMinutes() / 60) && (now.getHours() + now.getMinutes() / 60) < end;

  return {
    b: nextBlock,
    delta: best,
    ongoing
  };
}

export function renderLegend() {
  const legend = getElement("l");
  if (!legend) return;
  legend.innerHTML = "";
  Object.keys(state.subjects).forEach((key) => {
    if (key === "free") return;
    const subject = state.subjects[key];
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.style.cssText = `background:${subject[2]};color:${subject[3]};`;
    chip.textContent = `${subject[1]} ${subject[0]}`;
    legend.appendChild(chip);
  });
}

export function renderSchedule() {
  state.T0 = 7;
  state.T1 = 19;
  state.blocks.forEach((block) => {
    state.T0 = Math.min(state.T0, Math.floor(block[2]));
    state.T1 = Math.max(state.T1, Math.ceil(block[3]));
  });

  const timeline = getElement("tl");
  const tabs = getElement("tabs");
  if (!timeline) return;

  timeline.style.setProperty("--rows", state.T1 - state.T0);
  let h = "<div class='dh'></div>";
  DN.forEach((name, index) => {
    h += `<div class='dh${new Date().getDay() === index + 1 ? " today" : ""}${state.selectedDay === index + 1 ? " on" : ""}' data-d='${index + 1}'>${name}</div>`;
  });

  h += `<div class='gut'>`;
  for (let i = state.T0; i < state.T1; i++) h += `<div class='hl'>${i}h</div>`;
  h += `</div>`;

  for (let d = 1; d <= 5; d++) {
    h += `<div class='col${new Date().getDay() === d ? " today" : ""}${state.selectedDay === d ? " on" : ""}' data-d='${d}'></div>`;
  }

  timeline.innerHTML = h;

  let k = 0;
  state.blocks.forEach((block, index) => {
    const subject = state.subjects[block[1]];
    if (!subject) return;

    const course = document.createElement("div");
    course.className = `b${block[1] === "free" ? " free" : ""}`;
    course.style.cssText = `--c:${subject[2]};--f:${subject[3]};top:calc(${block[2] - state.T0}*var(--h) + 2px);height:calc(${block[3] - block[2]}*var(--h) - 4px);animation-delay:${k++ * 0.07}s`;
    course.innerHTML = `<span class='ic ${subject[4]}'>${escapeHtml(subject[1])}</span><div class='t'><b>${escapeHtml(subject[0])}</b><span>${fh(block[2])} – ${fh(block[3])}</span></div>`;

    const subjectCount = state.homework.filter((item) => item.subjectId === block[1] && item.status !== "done").length;
    if (subjectCount > 0) {
      const badge = document.createElement("span");
      badge.className = "subbadge";
      badge.textContent = `${subjectCount} devoir${subjectCount > 1 ? "s" : ""}`;
      course.querySelector(".t").appendChild(badge);
    }

    course.querySelector(".ic").onclick = (ev) => {
      ev.stopPropagation();
      burst(ev.clientX, ev.clientY, subject[1]);
    };
    course.onclick = () => openCourseDialog(index);
    const dayColumn = timeline.querySelector(`.col[data-d='${block[0]}']`);
    if (dayColumn) dayColumn.appendChild(course);
  });

  if (tabs) {
    tabs.innerHTML = "";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Choisir le jour à afficher");
    DN.forEach((name, index) => {
      const button = document.createElement("button");
      button.textContent = name.slice(0, 3);
      button.className = state.selectedDay === index + 1 ? "on" : "";
      button.setAttribute("role", "tab");
      button.setAttribute("aria-label", name);
      button.setAttribute("aria-selected", state.selectedDay === index + 1 ? "true" : "false");
      button.onclick = () => {
        state.selectedDay = index + 1;
        [...tabs.children].forEach((child, childIndex) => {
          const active = childIndex === index;
          child.className = active ? "on" : "";
          child.setAttribute("aria-selected", active ? "true" : "false");
        });
        [...timeline.querySelectorAll(".dh[data-d],.col")].forEach((cell) => {
          cell.classList[cell.dataset.d == state.selectedDay ? "add" : "remove"]("on");
        });
        if (window.matchMedia("(max-width: 720px)").matches) {
          button.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
      };
      tabs.appendChild(button);
    });
  }

  renderLegend();
}

export function burst(x, y, emoji) {
  for (let i = 0; i < 9; i++) {
    const s = document.createElement("span");
    const a = Math.random() * 6.28;
    const r = 50 + Math.random() * 70;
    s.className = "burst";
    s.textContent = emoji;
    s.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r - 30}px;--r:${(Math.random() * 360 - 180)}deg`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 950);
  }
}

export function tick() {
  const hero = getElement("hero");
  if (!hero) return;
  const blocks = state.blocks.filter((block) => state.subjects[block[1]]);
  if (!blocks.length) {
    hero.innerHTML = "";
    state.lastHeroKey = "";
    return;
  }

  const now = new Date();
  const day = now.getDay();
  const time = now.getHours() + now.getMinutes() / 60;
  let current = null;
  let next = null;
  let best = 1e9;

  blocks.forEach((block) => {
    if (block[0] === day && block[2] <= time && time < block[3]) current = block;
  });

  if (!current) {
    blocks.forEach((block) => {
      let diff = ((block[0] - day + 7) % 7) * 24 + block[2] - time;
      if (diff < 0) diff += 168;
      if (diff < best) {
        best = diff;
        next = block;
      }
    });
  }

  const block = current || next;
  const subject = state.subjects[block[1]];
  const key = `${current ? "c" : "n"}${block.join("-")}`;

  if (key !== state.lastHeroKey) {
    state.lastHeroKey = key;
    hero.innerHTML = `
      <div class='hero' style='background:linear-gradient(135deg,${subject[2]},${subject[2]}cc);color:${subject[3]}'>
        <div class='big'>${escapeHtml(subject[1])}</div>
        <div class='grow'>
          <div class='lab'><span class='dot'></span>${current ? "Cours en cours" : "Prochain cours"}</div>
          <h2>${escapeHtml(subject[0])}</h2>
          <p>${current ? `Encore ${dur(block[3] - time)} · fin à ${fh(block[3])}` : `Dans ${dur(best)} · ${best >= 24 || block[0] !== day ? `${DN[block[0] - 1]} ` : ""}${fh(block[2])} – ${fh(block[3])}`}</p>
          <div class='pb'><div style='width:${current ? ((time - block[2]) / (block[3] - block[2])) * 100 : 0}%'></div></div>
        </div>
      </div>
    `;
  }

  const nowEl = document.querySelector(".now");
  if (nowEl) nowEl.remove();
  const column = timelineColumnForToday();
  if (column && time >= state.T0 && time < state.T1) {
    const marker = document.createElement("div");
    marker.className = "now";
    marker.style.top = `calc(${time - state.T0}*var(--h))`;
    column.appendChild(marker);
  }
}

function timelineColumnForToday() {
  const tl = getElement("tl");
  if (!tl) return null;
  return tl.querySelector(".col.today");
}

export function openCourseDialog(index) {
  const subjectSelect = getElement("bs");
  const daySelect = getElement("bd");
  const title = getElement("bt");
  const deleteBtn = getElement("bdl");

  if (!subjectSelect || !daySelect || !title || !deleteBtn) return;

  subjectSelect.innerHTML = Object.keys(state.subjects).map((key) => `<option value='${key}'>${escapeHtml(state.subjects[key][1])} ${escapeHtml(state.subjects[key][0])}</option>`).join("");
  daySelect.innerHTML = DN.map((name, j) => `<option value='${j + 1}'>${name}</option>`).join("");

  state.ed = index;
  const block = index >= 0 ? state.blocks[index] : [state.selectedDay, Object.keys(state.subjects)[0], 8, 10];
  title.textContent = index >= 0 ? "✏️ Modifier le cours" : "➕ Ajouter un cours";
  subjectSelect.value = block[1];
  daySelect.value = block[0];
  getElement("b1").value = t2s(block[2]);
  getElement("b2").value = t2s(block[3]);
  getElement("be").textContent = "";
  deleteBtn.style.display = index >= 0 ? "" : "none";
  getElement("dB").showModal();
}

export function initCourseEditorHandlers() {
  const addBtn = getElement("add");
  const cancelBtn = getElement("bcx");
  const saveBtn = getElement("bsv");
  const deleteBtn = getElement("bdl");

  if (addBtn) addBtn.onclick = () => openCourseDialog(-1);
  if (cancelBtn) cancelBtn.onclick = () => getElement("dB").close();
  if (deleteBtn) deleteBtn.onclick = () => {
    state.blocks.splice(state.ed, 1);
    saveSchedule(state.subjects, state.blocks);
    getElement("dB").close();
    renderSchedule();
  };
  if (saveBtn) saveBtn.onclick = () => {
    const d = Number(getElement("bd").value);
    const s = Number(getElement("b1").value.split(":")[0]) + Number(getElement("b1").value.split(":")[1]) / 60;
    const e = Number(getElement("b2").value.split(":")[0]) + Number(getElement("b2").value.split(":")[1]) / 60;
    const k = getElement("bs").value;

    if (Number.isNaN(s) || Number.isNaN(e)) {
      getElement("be").textContent = "Choisis une heure de début et de fin.";
      return;
    }
    if (e <= s) {
      getElement("be").textContent = "La fin doit être après le début.";
      return;
    }

    const overlap = state.blocks.find((block, j) => j !== state.ed && block[0] === d && s < block[3] && e > block[2]);
    if (overlap) {
      getElement("be").textContent = `Ce créneau chevauche : ${state.subjects[overlap[1]][0]} (${fh(overlap[2])} – ${fh(overlap[3])})`;
      return;
    }

    const nextBlock = [d, k, s, e];
    if (state.ed >= 0) state.blocks[state.ed] = nextBlock;
    else state.blocks.push(nextBlock);

    saveSchedule(state.subjects, state.blocks);
    state.selectedDay = d;
    getElement("dB").close();
    renderSchedule();
  };
}

export function renderSubjectEditor() {
  const subjectEditor = getElement("ml");
  if (!subjectEditor) return;
  subjectEditor.innerHTML = Object.keys(state.subjects)
    .filter((key) => key !== "free")
    .map((key) => rowSubject(key, state.subjects[key]))
    .join("");
}

function rowSubject(key, subject) {
  return `<div class='mr' data-k='${key}'><input class='me' maxlength='4' value="${escapeHtml(subject[1])}"><input class='mn' placeholder='Nom' value="${escapeHtml(subject[0])}"><input class='mc' type='color' value='${escapeHtml(subject[2])}'><button class='mx' type='button'>✖</button></div>`;
}

export function initSubjectEditorHandlers() {
  const matBtn = getElement("mat");
  const addBtn = getElement("madd");
  const subjectList = getElement("ml");
  const doneBtn = getElement("mok");
  const resetBtn = getElement("mrs");

  if (matBtn) {
    matBtn.onclick = () => {
      renderSubjectEditor();
      getElement("dM").showModal();
    };
  }

  if (addBtn) {
    addBtn.onclick = () => {
      const container = document.createElement("div");
      container.innerHTML = rowSubject("", ["", "📚", PAL[Math.floor(Math.random() * PAL.length)]]);
      subjectList.appendChild(container.firstChild);
      subjectList.scrollTop = 9999;
    };
  }

  if (subjectList) {
    subjectList.onclick = (event) => {
      if (!event.target.classList.contains("mx")) return;
      const row = event.target.parentNode;
      const key = row.dataset.k;
      if (key) {
        const courses = state.blocks.filter((block) => block[1] === key).length;
        if (courses && !confirm(`Cette matière a ${courses} cours dans ta semaine. La supprimer supprimera aussi ces cours. Continuer ?`)) return;
        delete state.subjects[key];
        state.blocks = state.blocks.filter((block) => block[1] !== key);
      }
      row.remove();
    };
  }

  if (doneBtn) {
    doneBtn.onclick = () => {
      [...subjectList.children].forEach((row) => {
        const key = row.dataset.k;
        const name = row.querySelector(".mn").value.trim();
        const icon = row.querySelector(".me").value.trim() || "📚";
        const color = row.querySelector(".mc").value;
        if (!name) return;
        if (key) {
          const subject = state.subjects[key];
          if (!subject) return;
          if (subject[2] !== color) {
            subject[2] = color;
            subject[3] = fgOf(color);
          }
          subject[0] = name;
          subject[1] = icon;
        } else {
          state.subjects[`s${Date.now()}${Math.floor(Math.random() * 999)}`] = [name, icon, color, fgOf(color), "bob"];
        }
      });
      saveSchedule(state.subjects, state.blocks);
      getElement("dM").close();
      renderSchedule();
    };
  }

  if (resetBtn) {
    resetBtn.onclick = () => {
      if (confirm("Remettre l'emploi du temps d'origine ? Tes modifications seront perdues.")) {
        try { localStorage.removeItem("edt-data"); } catch (error) {}
        state.subjects = { ...DEF_S };
        state.blocks = [...DEF_B];
        getElement("dM").close();
        renderSchedule();
      }
    };
  }
}

export function initViewSwitch() {
  const navSchedule = getElement("navSchedule");
  const navHomework = getElement("navHomework");
  const scheduleView = getElement("scheduleView");
  const homeworkView = getElement("homeworkView");

  if (navSchedule) {
    navSchedule.onclick = () => {
      state.currentView = "schedule";
      if (scheduleView) scheduleView.hidden = false;
      if (homeworkView) homeworkView.hidden = true;
      navSchedule.setAttribute("aria-pressed", "true");
      navHomework.setAttribute("aria-pressed", "false");
    };
  }

  if (navHomework) {
    navHomework.onclick = () => {
      state.currentView = "homework";
      if (scheduleView) scheduleView.hidden = true;
      if (homeworkView) homeworkView.hidden = false;
      navSchedule.setAttribute("aria-pressed", "false");
      navHomework.setAttribute("aria-pressed", "true");
    };
  }
}
