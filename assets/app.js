/* Сайт направления «Агентства» — общий JS (итерации 0–1).
   Хедер + бэклог как инструмент: фильтры, сортировка, поиск, бейджи; срез Must. */

const NAV = [
  { href: "index.html",    label: "Направление" },
  { href: "vision.html",   label: "Видение" },
  { href: "backlog.html",  label: "Бэклог" },
  { href: "must.html",     label: "Must" },
  { href: "tree.html",     label: "Дерево", disabled: true },
  { href: "agencies.html", label: "Агентства", disabled: true },
  { href: "metrics.html",  label: "Метрики", disabled: true },
  { href: "legend.html",   label: "Легенды", disabled: true },
];

function currentPage() {
  return location.pathname.split("/").pop() || "index.html";
}

function mountHeader() {
  const host = document.querySelector("[data-header]");
  if (!host) return;
  const cur = currentPage();
  const links = NAV.map((n) => {
    if (n.disabled) {
      return `<span class="nav__soon" aria-disabled="true" title="будет в следующих итерациях"
                 style="opacity:.4;cursor:not-allowed">${n.label}</span>`;
    }
    const active = n.href === cur ? " is-active" : "";
    return `<a class="${active.trim()}" href="${n.href}">${n.label}</a>`;
  }).join("");
  host.innerHTML = `
    <header class="site-header">
      <div class="site-header__inner">
        <a class="brand" href="index.html">Направление <b>«Агентства»</b></a>
        <nav class="nav">${links}</nav>
      </div>
    </header>`;
}

async function loadJSON(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } catch (e) {
    throw new Error(
      `Не удалось загрузить ${path}: ${e.message}. ` +
      `Запусти локальный сервер:  python3 -m http.server  и открой http://localhost:8000`
    );
  }
}

function moscowClass(m) {
  const map = { Must: "must", Should: "should", Could: "could", "Won't": "wont", "Wont": "wont" };
  return map[m] || "could";
}
const MOSCOW_ORDER = { Must: 0, Should: 1, Could: 2, "Won't": 3, "Wont": 3 };

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// --- столбцы таблицы: [ключ, заголовок, тип, сортируемый] ---
const COLS = [
  ["num", "#", "num", true],
  ["moscow", "MoSCoW", "badge", true],
  ["theme", "Тема", "muted", true],
  ["level2", "Уровень 2", "muted", true],
  ["iteration", "Итерация", "num", true],
  ["title", "Название", "title", true],
  ["stage", "Этап", "muted", true],
  ["mechanism", "Механизм", "muted", true],
  ["subgoal", "Подцель", "muted", true],
  ["finalScore", "Final", "score", true],
  ["gate", "Gate", "badge-plain", true],
];

// поля, по которым строятся выпадающие фильтры
const FILTER_FIELDS = [
  ["theme", "Тема"],
  ["stage", "Этап"],
  ["mechanism", "Механизм"],
  ["subgoal", "Подцель"],
  ["moscow", "MoSCoW"],
  ["gate", "Gate"],
];

// поля, по которым ищет строка поиска
const SEARCH_FIELDS = ["title", "jobStory", "iteration", "id", "gitlabId", "quote", "rationale", "agencies"];

function compare(a, b, key, dir) {
  let va = a[key], vb = b[key];
  if (key === "moscow") { va = MOSCOW_ORDER[va] ?? 9; vb = MOSCOW_ORDER[vb] ?? 9; }
  // Пустые значения всегда внизу — независимо от направления сортировки.
  const ea = va == null || va === "", eb = vb == null || vb === "";
  if (ea && eb) return 0;
  if (ea) return 1;
  if (eb) return -1;
  let r;
  if (typeof va === "number" && typeof vb === "number") r = va - vb;
  else r = String(va).localeCompare(String(vb), "ru");
  return dir === "desc" ? -r : r;
}

/** Универсальный рендер бэклога. opts.mustOnly — страница Must. */
async function mountBacklog() {
  const host = document.querySelector("[data-backlog]");
  if (!host) return;
  const mustOnly = host.hasAttribute("data-must");
  host.innerHTML = `<div class="loading">Загрузка бэклога…</div>`;

  let data;
  try { data = await loadJSON("data/backlog.json"); }
  catch (e) { host.innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }

  let all = data.items || [];
  if (mustOnly) all = all.filter((x) => x.moscow === "Must");

  const state = {
    q: "",
    filters: {},                                   // field -> выбранное значение ("" = все)
    sort: mustOnly ? { key: "finalScore", dir: "desc" } : { key: "num", dir: "asc" },
  };

  // --- опции фильтров: только реальные значения данных, по убыванию частоты ---
  const filterDefs = FILTER_FIELDS
    .filter(([f]) => !(mustOnly && f === "moscow"))   // на Must фильтр MoSCoW не нужен
    .map(([field, label]) => {
      const counts = new Map();
      all.forEach((x) => {
        const v = x[field] == null || x[field] === "" ? "—" : x[field];
        counts.set(v, (counts.get(v) || 0) + 1);
      });
      const options = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      return { field, label, options };
    });

  function controlsHTML() {
    const selects = filterDefs.map(({ field, label, options }) => {
      const opts = [`<option value="">${label}: все</option>`]
        .concat(options.map(([v, c]) =>
          `<option value="${esc(v)}">${esc(v)} (${c})</option>`));
      return `<select data-filter="${field}" class="ctl" aria-label="Фильтр: ${esc(label)}">${opts.join("")}</select>`;
    }).join("");
    return `
      <div class="toolbar" role="search">
        <input type="search" class="ctl ctl--search" data-search
               aria-label="Поиск по бэклогу" autocomplete="off" spellcheck="false"
               placeholder="Поиск по названию, job story, агентствам, цитатам, ID…" />
        ${selects}
        <button type="button" class="ctl ctl--reset" data-reset>Сбросить</button>
      </div>
      <div class="result-meta" data-meta aria-live="polite"></div>`;
  }

  function rowsHTML(items) {
    if (!items.length) return `<tr><td colspan="${COLS.length}" class="muted" style="padding:24px">Ничего не найдено — измени фильтры или поиск.</td></tr>`;
    return items.map((it) => COLS.map(([key, , kind]) => {
      if (kind === "badge") {
        const m = it[key];
        return `<td><span class="badge badge--${moscowClass(m)}">${esc(m ?? "—")}</span></td>`;
      }
      if (kind === "badge-plain") {
        const g = it[key] ?? "—";
        const gc = g === "OK" ? " badge--ok" : g === "Review" ? " badge--review" : "";
        return `<td><span class="badge${gc}">${esc(g)}</span></td>`;
      }
      const cls = kind === "title" ? "title" : (kind === "num" || kind === "score") ? kind : "muted";
      const v = it[key];
      return `<td class="${cls}">${esc(v == null || v === "" ? "—" : v)}</td>`;
    }).join("")).map((tds) => `<tr>${tds}</tr>`).join("");
  }

  function theadHTML() {
    return COLS.map(([key, label, , sortable]) => {
      if (!sortable) return `<th>${label}</th>`;
      const act = state.sort.key === key;
      const arrow = act ? (state.sort.dir === "asc" ? " ▲" : " ▼") : "";
      const ariaSort = act ? ` aria-sort="${state.sort.dir === "asc" ? "ascending" : "descending"}"` : "";
      return `<th${ariaSort}><button type="button" class="th-sort" data-sort="${key}">${label}${arrow}</button></th>`;
    }).join("");
  }

  function apply() {
    const q = state.q.trim().toLowerCase();
    let items = all.filter((it) => {
      for (const [field, val] of Object.entries(state.filters)) {
        if (!val) continue;
        const cur = it[field] == null || it[field] === "" ? "—" : it[field];
        if (String(cur) !== val) return false;
      }
      if (q) {
        const hay = SEARCH_FIELDS.map((f) => it[f] || "").join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    items = items.slice().sort((a, b) => compare(a, b, state.sort.key, state.sort.dir));

    host.querySelector("tbody").innerHTML = rowsHTML(items);
    host.querySelector("thead tr").innerHTML = theadHTML();
    bindSort();
    const meta = host.querySelector("[data-meta]");
    const activeF = Object.values(state.filters).filter(Boolean).length;
    meta.textContent = `Показано ${items.length} из ${all.length}`
      + (activeF || q ? ` · фильтров: ${activeF}${q ? " + поиск" : ""}` : "");
  }

  function bindSort() {
    host.querySelectorAll("button[data-sort]").forEach((btn) => {
      btn.onclick = () => {
        const key = btn.dataset.sort;
        if (state.sort.key === key) state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
        else state.sort = { key, dir: key === "finalScore" || key === "num" ? "desc" : "asc" };
        apply();
      };
    });
  }

  const mustCount = mustOnly ? all.length : all.filter((x) => x.moscow === "Must").length;
  const themes = new Set(all.map((x) => x.theme).filter(Boolean));

  host.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="v">${all.length}</div><div class="l">${mustOnly ? "Must-итераций" : "итераций"}</div></div>
      ${mustOnly ? "" : `<div class="stat"><div class="v">${mustCount}</div><div class="l">Must</div></div>`}
      <div class="stat"><div class="v">${themes.size}</div><div class="l">тем</div></div>
    </div>
    ${controlsHTML()}
    <div class="table-wrap">
      <table class="backlog">
        <thead><tr>${theadHTML()}</tr></thead>
        <tbody></tbody>
      </table>
    </div>`;

  host.querySelector("[data-search]").addEventListener("input", (e) => { state.q = e.target.value; apply(); });
  host.querySelectorAll("[data-filter]").forEach((sel) => {
    sel.addEventListener("change", (e) => { state.filters[e.target.dataset.filter] = e.target.value; apply(); });
  });
  host.querySelector("[data-reset]").addEventListener("click", () => {
    state.q = ""; state.filters = {};
    host.querySelector("[data-search]").value = "";
    host.querySelectorAll("[data-filter]").forEach((s) => (s.value = ""));
    apply();
  });

  apply();
}

// ===================== Must — аккордеон карточек ProductV =====================
function verdictClass(v) { return v === "Proceed" ? "is-proceed" : "is-rework"; }
function deltaClass(d) {
  const s = String(d).trim();
  if (s.startsWith("+")) return "pos";
  if (s.startsWith("−") || s.startsWith("-")) return "neg";
  return "zero";
}
function riceStr(r) {
  if (!r) return "—";
  const e = r.e == null ? "—" : r.e;
  return `${r.r}·${r.i}·${r.c}·${e}`;
}
function mList(arr, ordered) {
  if (!arr || !arr.length) return "";
  const tag = ordered ? "ol" : "ul";
  return `<${tag} class="m-list">${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</${tag}>`;
}
function mBlock(label, inner) {
  if (!inner) return "";
  return `<div class="m-sect"><div class="m-sect__h">${esc(label)}</div>${inner}</div>`;
}

function renderMustCard(c) {
  const bodyId = `mc-${c.num}-body`;
  const meta = [
    ["Этап / Блок", c.stageBlock],
    ["Механизм", c.mechanism],
    ["Подцель", c.subgoal],
    ["Уровень 2", c.level2],
    ["GitLab", c.gitlab],
    ["Статус", c.status],
  ].filter(([, v]) => v)
   .map(([k, v]) => `<div class="m-meta__row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");

  const pvRows = (c.productv || []).map((p) =>
    `<tr>
       <td class="pv-th">${esc(p.thinker)}</td>
       <td class="pv-mod">${esc(p.modifier)}</td>
       <td class="pv-delta ${deltaClass(p.delta)}">${esc(p.delta)}</td>
       <td class="pv-basis">${esc(p.basis)}</td>
     </tr>`).join("");

  const scenario = c.scenario
    ? `<div class="m-scn">
         <div class="m-scn__col m-scn__as"><span class="t">As is</span><p>${esc(c.scenario.asIs)}</p></div>
         <div class="m-scn__col m-scn__to"><span class="t">To be</span><p>${esc(c.scenario.toBe)}</p></div>
       </div>` : "";

  const finalStr = c.finalXlsx == null ? "—" : c.finalXlsx;

  return `
    <article class="mcard" data-verdict="${verdictClass(c.verdict)}">
      <button type="button" class="mcard__head" aria-expanded="false" aria-controls="${bodyId}">
        <span class="mcard__num">${c.num}</span>
        <span class="mcard__title">${esc(c.title)}</span>
        <span class="mcard__theme">${esc(c.theme)}</span>
        <span class="vbadge ${verdictClass(c.verdict)}">${esc(c.verdict)}</span>
        <span class="mcard__metrics">
          <span title="Reach·Impact·Confidence·Effort">${riceStr(c.rice)}</span>
          <span>Final ${finalStr}</span>
          <span>PV ${Number(c.pvProductV).toFixed(2)}</span>
        </span>
        <span class="mcard__chev" aria-hidden="true">▸</span>
      </button>
      <div class="mcard__body" id="${bodyId}" hidden>
        <dl class="m-meta">${meta}</dl>
        ${mBlock("Гипотеза", `<p class="m-hyp">${esc(c.hypothesis)}</p>`)}
        ${c.composition ? mBlock("Состав эпика", `<p>${esc(c.composition)}</p>`) : ""}
        ${c.flag ? `<p class="m-flag">⚠ ${esc(c.flag)}</p>` : ""}
        ${mBlock("Поток ролей", mList(c.roleFlow))}
        ${mBlock("Проблема", mList(c.problem, true))}
        ${mBlock("Результат", mList(c.result, true))}
        ${mBlock("Влияние на цель", mList(c.impact))}
        ${mBlock("Пользовательский сценарий", scenario)}
        ${mBlock("Образ результата (энтелехия)", `<p class="m-ent">${esc(c.entelechy)}</p>`)}
        ${c.tasks && c.tasks.length ? mBlock("Задачи", mList(c.tasks, true)) : ""}
        ${mBlock("ProductV · пятикнижный фильтр", `
          <div class="table-wrap">
            <table class="productv">
              <thead><tr><th>Мыслитель</th><th>Модиф.</th><th>Δ</th><th>Основание</th></tr></thead>
              <tbody>${pvRows}</tbody>
            </table>
          </div>
          <p class="m-pvsum">${esc(c.pvSum)}</p>`)}
        ${mBlock("RICE — обоснование", `<p class="m-rice">${esc(c.riceRationale)}</p>`)}
        <div class="m-verdict ${verdictClass(c.verdict)}">
          <span class="vbadge ${verdictClass(c.verdict)}">${esc(c.verdict)}</span>
          <p>${esc(c.verdictText)}</p>
        </div>
        <p class="m-src">Источники: ${esc(c.sources)}</p>
      </div>
    </article>`;
}

function setMustCard(btn, open) {
  const body = document.getElementById(btn.getAttribute("aria-controls"));
  btn.setAttribute("aria-expanded", open ? "true" : "false");
  if (body) body.hidden = !open;
  const card = btn.closest(".mcard");
  if (card) card.classList.toggle("is-open", open);
}

async function mountMust() {
  const host = document.querySelector("[data-must-cards]");
  if (!host) return;
  host.innerHTML = `<div class="loading">Загрузка Must-карточек…</div>`;
  let data;
  try { data = await loadJSON("data/must.json"); }
  catch (e) { host.innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }

  const cards = (data.cards || []).slice()
    .sort((a, b) => (b.finalXlsx ?? -1) - (a.finalXlsx ?? -1));

  host.innerHTML = `
    <p class="must-note">${esc(data.note || "")}</p>
    <div class="must-controls">
      <button type="button" class="btn" data-expand-all>Развернуть все</button>
      <button type="button" class="btn" data-collapse-all>Свернуть все</button>
      <span class="result-meta">Источник: ${esc(data.source || "")}</span>
    </div>
    <div class="mcards">${cards.map(renderMustCard).join("")}</div>`;

  host.querySelectorAll(".mcard__head").forEach((btn) => {
    btn.addEventListener("click", () => setMustCard(btn, btn.getAttribute("aria-expanded") !== "true"));
  });
  host.querySelector("[data-expand-all]").addEventListener("click",
    () => host.querySelectorAll(".mcard__head").forEach((b) => setMustCard(b, true)));
  host.querySelector("[data-collapse-all]").addEventListener("click",
    () => host.querySelectorAll(".mcard__head").forEach((b) => setMustCard(b, false)));
}

document.addEventListener("DOMContentLoaded", () => {
  mountHeader();
  mountBacklog();
  mountMust();
});
