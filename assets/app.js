/* Сайт направления «Агентства» — общий JS (итерации 0–1).
   Хедер + бэклог как инструмент: фильтры, сортировка, поиск, бейджи; срез Must. */

const NAV = [
  { href: "index.html",    label: "Направление" },
  { href: "vision.html",   label: "Видение" },
  { href: "backlog.html",  label: "Бэклог" },
  { href: "must.html",     label: "Must" },
  { href: "tree.html",     label: "Дерево" },
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

// --- полный набор колонок бэклога: [ключ, заголовок, тип, видна по умолчанию] ---
// тип: num | mono | text | badge | badge-plain | title | long
const COLS_FULL = [
  ["num", "#", "num", true],
  ["status", "Статус", "text", false],
  ["moscow", "MoSCoW", "badge", true],
  ["theme", "Тема", "text", true],
  ["level2", "Уровень 2", "text", true],
  ["iteration", "Итерация", "mono", true],
  ["gitlabId", "ID гитлаб", "mono", false],
  ["title", "Название", "title", true],
  ["jobStory", "Проблема (Job Story)", "long", true],
  ["problemSource", "Проблема: источник", "text", false],
  ["stage", "Этап", "text", true],
  ["block", "Блок", "text", true],
  ["mechanism", "Механизм", "text", true],
  ["subgoal", "Подцель", "text", true],
  ["hypothesis", "Гипотеза", "long", true],
  ["reach", "Reach", "num", true],
  ["impact", "Impact", "num", true],
  ["confidence", "Confidence", "num", true],
  ["effort", "Effort", "num", true],
  ["rice", "RICE", "num", true],
  ["pvMult", "PV Mult", "num", true],
  ["finalScore", "Final", "num", true],
  ["gate", "Gate", "badge-plain", true],
  ["concentration", "Концентрация", "text", true],
  ["quote", "Цитата / данные", "long", true],
  ["agencies", "Агентства (исслед.)", "long", true],
  ["rationale", "Обоснование", "long", false],
  ["pvNotes", "PV Notes", "text", false],
  ["activeMetrics", "Активные метрики", "text", true],
  ["targetMetrics", "Целевые метрики", "text", true],
];
const NUMERIC_TYPES = new Set(["num"]);

// выпадающие фильтры (поле → подпись)
const FILTER_FIELDS = [
  ["theme", "Тема"],
  ["moscow", "MoSCoW"],
  ["stage", "Этап"],
  ["mechanism", "Механизм"],
  ["subgoal", "Подцель"],
  ["gate", "Gate"],
  ["hCode", "Гипотеза"],
  ["concentration", "Концентрация"],
];

const SEARCH_FIELDS = ["title", "jobStory", "iteration", "id", "gitlabId", "quote", "rationale", "agencies", "hypothesis"];
const COLS_STORAGE = "agency-backlog-cols-v1";

function hCodeOf(s) {
  const m = /^\s*(H\d+(?:\.\d+)*)/.exec(String(s || ""));
  return m ? m[1] : "";
}
function compare(a, b, key, dir) {
  let va = a[key], vb = b[key];
  if (key === "moscow") { va = MOSCOW_ORDER[va] ?? 9; vb = MOSCOW_ORDER[vb] ?? 9; }
  const ea = va == null || va === "", eb = vb == null || vb === "";
  if (ea && eb) return 0;
  if (ea) return 1;            // пустые всегда вниз, независимо от направления
  if (eb) return -1;
  let r;
  if (typeof va === "number" && typeof vb === "number") r = va - vb;
  else r = String(va).localeCompare(String(vb), "ru");
  return dir === "desc" ? -r : r;
}

async function mountBacklog() {
  const host = document.querySelector("[data-backlog]");
  if (!host) return;
  host.innerHTML = `<div class="loading">Загрузка бэклога…</div>`;

  let data;
  try { data = await loadJSON("data/backlog.json"); }
  catch (e) { host.innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }

  const all = data.items || [];
  all.forEach((it) => { it.hCode = hCodeOf(it.hypothesis); });

  const defaultsOn = COLS_FULL.filter((c) => c[3]).map((c) => c[0]);
  let savedCols = null;
  try { const raw = localStorage.getItem(COLS_STORAGE); if (raw) savedCols = JSON.parse(raw); } catch (e) { /* ignore */ }
  const visInit = Array.isArray(savedCols) && savedCols.length
    ? new Set(savedCols.filter((k) => COLS_FULL.some((c) => c[0] === k)))
    : new Set(defaultsOn);

  const state = {
    q: "",
    filters: {},
    sort: { key: "moscow", dir: "asc" },      // дефолт: MoSCoW → Final (тай-брейк)
    expanded: new Set(),
    vis: visInit,
  };
  const visCols = () => COLS_FULL.filter((c) => state.vis.has(c[0]));
  const colType = (key) => (COLS_FULL.find((c) => c[0] === key) || [])[2];

  // опции фильтров — из реальных значений, по убыванию частоты
  const filterDefs = FILTER_FIELDS.map(([field, label]) => {
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
      const opts = [`<option value="">${esc(label)}: все</option>`]
        .concat(options.map(([v, c]) => `<option value="${esc(v)}">${esc(v)} (${c})</option>`));
      return `<select data-filter="${field}" class="ctl" aria-label="Фильтр: ${esc(label)}">${opts.join("")}</select>`;
    }).join("");
    const boxes = COLS_FULL.map(([key, label]) =>
      `<label class="colbox"><input type="checkbox" data-col="${key}" ${state.vis.has(key) ? "checked" : ""}/> ${esc(label)}</label>`).join("");
    return `
      <div class="toolbar" role="search">
        <input type="search" class="ctl ctl--search" data-search
               aria-label="Поиск по бэклогу" autocomplete="off" spellcheck="false"
               placeholder="Поиск по названию, job story, гипотезе, агентствам, цитатам, ID…" />
        ${selects}
        <button type="button" class="ctl ctl--reset" data-reset>Сбросить</button>
      </div>
      <details class="cols-panel">
        <summary>Колонки <span data-cols-count>(${state.vis.size}/${COLS_FULL.length})</span></summary>
        <div class="cols-grid">${boxes}</div>
      </details>
      <div class="result-meta" data-meta aria-live="polite"></div>`;
  }

  function cellHTML(it, col) {
    const [key, , type] = col;
    const raw = it[key];
    const empty = raw == null || raw === "";
    if (type === "badge") {
      return `<td><span class="badge badge--${moscowClass(raw)}">${esc(empty ? "—" : raw)}</span></td>`;
    }
    if (type === "badge-plain") {
      const g = empty ? "—" : raw;
      const gc = g === "OK" ? " badge--ok" : g === "Review" ? " badge--review" : "";
      return `<td><span class="badge${gc}">${esc(g)}</span></td>`;
    }
    if (type === "num") return `<td class="num">${esc(empty ? "—" : raw)}</td>`;
    if (type === "mono") return `<td class="mono">${esc(empty ? "—" : raw)}</td>`;
    if (type === "title" || type === "long") {
      const cls = type === "title" ? "b-title" : "b-long";
      return `<td class="${cls}" title="${empty ? "" : esc(raw)}"><div class="clamp2">${esc(empty ? "—" : raw)}</div></td>`;
    }
    return `<td>${esc(empty ? "—" : raw)}</td>`;
  }

  function detailHTML(it, span) {
    const cols = COLS_FULL;
    const get = (k) => { const v = it[k]; return v == null || v === "" ? null : v; };
    const row = (label, val) => val ? `<div class="bd-row"><dt>${esc(label)}</dt><dd>${esc(val)}</dd></div>` : "";
    const score = `R ${get("reach") ?? "—"} · I ${get("impact") ?? "—"} · C ${get("confidence") ?? "—"} · E ${get("effort") ?? "—"} → RICE ${get("rice") ?? "—"} → PV ${get("pvMult") ?? "—"} → Final ${get("finalScore") ?? "—"}`;
    return `
      <tr class="b-detailrow" data-detail="${esc(it.id)}" hidden>
        <td colspan="${span}">
          <div class="b-card">
            <div class="bd-head">
              <span class="bd-title">${esc(it.title || "—")}</span>
              <span class="bd-path">${esc(it.theme || "—")} › ${esc(it.level2 || "—")} › ${esc(it.iteration || "—")}</span>
              ${get("gitlabId") ? `<span class="bd-git">${esc(it.gitlabId)}</span>` : ""}
            </div>
            <div class="bd-sect"><div class="bd-h">Логика ценности</div><dl>
              ${row("Этап", get("stage"))}${row("Блок", get("block"))}${row("Механизм", get("mechanism"))}${row("Подцель", get("subgoal"))}${row("Гипотеза", get("hypothesis"))}
            </dl></div>
            <div class="bd-sect"><div class="bd-h">Проблема</div><dl>
              ${row("Job Story", get("jobStory"))}${row("Источник", get("problemSource"))}${row("Цитата / данные", get("quote"))}
            </dl></div>
            <div class="bd-sect"><div class="bd-h">Скоринг</div><dl>
              <div class="bd-row"><dt>RICE</dt><dd class="mono">${esc(score)}</dd></div>
              ${row("Gate", get("gate"))}${row("Концентрация", get("concentration"))}
            </dl></div>
            <div class="bd-sect"><div class="bd-h">Метрики</div><dl>
              ${row("Активные", get("activeMetrics"))}${row("Целевые", get("targetMetrics"))}
            </dl></div>
            <div class="bd-sect"><div class="bd-h">ProductV</div><dl>
              ${row("PV Notes", get("pvNotes"))}${row("Обоснование", get("rationale"))}
            </dl></div>
            ${get("agencies") ? `<div class="bd-sect"><div class="bd-h">Агентства (исследования)</div><dl>${row("Агентства", get("agencies"))}</dl></div>` : ""}
          </div>
        </td>
      </tr>`;
  }

  function rowsHTML(items) {
    const cols = visCols();
    const span = cols.length + 1;
    if (!items.length) return `<tr><td colspan="${span}" class="muted" style="padding:24px">Ничего не найдено — измени фильтры или поиск.</td></tr>`;
    return items.map((it) => {
      const open = state.expanded.has(it.id);
      const exp = `<td class="b-exp-cell"><button type="button" class="b-exp" data-exp="${esc(it.id)}" aria-expanded="${open}" aria-label="Раскрыть карточку">${open ? "▾" : "▸"}</button></td>`;
      const cells = cols.map((c) => cellHTML(it, c)).join("");
      const main = `<tr class="b-row" data-row="${esc(it.id)}">${exp}${cells}</tr>`;
      const detail = detailHTML(it, span).replace("hidden>", open ? ">" : "hidden>");
      return main + detail;
    }).join("");
  }

  function theadHTML() {
    const ths = visCols().map(([key, label]) => {
      const act = state.sort.key === key;
      const arrow = act ? (state.sort.dir === "asc" ? " ▲" : " ▼") : "";
      const ariaSort = act ? ` aria-sort="${state.sort.dir === "asc" ? "ascending" : "descending"}"` : "";
      return `<th${ariaSort}><button type="button" class="th-sort" data-sort="${key}">${esc(label)}${arrow}</button></th>`;
    }).join("");
    return `<th class="b-exp-cell" aria-hidden="true"></th>${ths}`;
  }

  function sortItems(items) {
    return items.slice().sort((a, b) => {
      let r = compare(a, b, state.sort.key, state.sort.dir);
      if (r === 0 && state.sort.key !== "finalScore") r = compare(a, b, "finalScore", "desc");
      if (r === 0 && state.sort.key !== "num") r = compare(a, b, "num", "asc");
      return r;
    });
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
    items = sortItems(items);

    host.querySelector("thead tr").innerHTML = theadHTML();
    host.querySelector("tbody").innerHTML = rowsHTML(items);
    bindSort(); bindExpanders();
    const activeF = Object.values(state.filters).filter(Boolean).length;
    host.querySelector("[data-meta]").textContent = `Показано ${items.length} из ${all.length}`
      + (activeF || q ? ` · фильтров: ${activeF}${q ? " + поиск" : ""}` : "");
  }

  function bindSort() {
    host.querySelectorAll("button[data-sort]").forEach((btn) => {
      btn.onclick = () => {
        const key = btn.dataset.sort;
        if (state.sort.key === key) state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
        else state.sort = { key, dir: NUMERIC_TYPES.has(colType(key)) ? "desc" : "asc" };
        apply();
      };
    });
  }
  function bindExpanders() {
    host.querySelectorAll("button[data-exp]").forEach((btn) => {
      btn.onclick = () => {
        const id = btn.dataset.exp;
        const open = !state.expanded.has(id);
        if (open) state.expanded.add(id); else state.expanded.delete(id);
        btn.setAttribute("aria-expanded", String(open));
        btn.textContent = open ? "▾" : "▸";
        const detail = host.querySelector(`tr[data-detail="${CSS.escape(id)}"]`);
        if (detail) detail.hidden = !open;
      };
    });
  }

  const mustCount = all.filter((x) => x.moscow === "Must").length;
  const themes = new Set(all.map((x) => x.theme).filter(Boolean));

  host.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="v">${all.length}</div><div class="l">итераций</div></div>
      <div class="stat"><div class="v">${mustCount}</div><div class="l">Must</div></div>
      <div class="stat"><div class="v">${themes.size}</div><div class="l">тем</div></div>
    </div>
    ${controlsHTML()}
    <div class="table-wrap table-wrap--full">
      <table class="backlog backlog--full">
        <thead><tr></tr></thead>
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
    history.replaceState(null, "", location.pathname);
    apply();
  });
  host.querySelectorAll("[data-col]").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const key = e.target.dataset.col;
      if (e.target.checked) state.vis.add(key); else state.vis.delete(key);
      try { localStorage.setItem(COLS_STORAGE, JSON.stringify([...state.vis])); } catch (err) { /* ignore */ }
      const c = host.querySelector("[data-cols-count]");
      if (c) c.textContent = `(${state.vis.size}/${COLS_FULL.length})`;
      apply();
    });
  });

  // deep-link: ?q=… и/или фильтры (?theme=&stage=&moscow=&gate=&hCode=&concentration=&…)
  const params = new URLSearchParams(location.search);
  const qp = params.get("q");
  if (qp) { state.q = qp; host.querySelector("[data-search]").value = qp; }
  filterDefs.forEach(({ field }) => {
    const v = params.get(field);
    if (v == null) return;
    const sel = host.querySelector(`[data-filter="${field}"]`);
    if (sel && [...sel.options].some((o) => o.value === v)) { sel.value = v; state.filters[field] = v; }
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

// ===================== Дерево работ (tree.html) =====================
function renderTitem(it) {
  const fin = it.finalScore == null ? "—" : it.finalScore;
  const detail = [it.stage, it.mechanism].filter(Boolean).join(" · ");
  return `
    <li class="titem">
      <a class="titem__link" href="backlog.html?q=${encodeURIComponent(it.id)}">
        <span class="titem__it">${esc(it.iteration || "—")}</span>
        <span class="titem__title">${esc(it.title || "—")}</span>
      </a>
      <span class="badge badge--${moscowClass(it.moscow)}">${esc(it.moscow || "—")}</span>
      <span class="titem__detail">${detail ? esc(detail) + " · " : ""}Final ${fin}</span>
    </li>`;
}
function renderTitems(items) {
  return `<ul class="titems">${items.map(renderTitem).join("")}</ul>`;
}
function renderL2(l) {
  return `
    <details class="tnode tnode--l2">
      <summary class="tsum">
        <span class="tchev" aria-hidden="true">▸</span>
        <span class="tname">${esc(l.name)}</span>
        <span class="tcount">${l.count}</span>
      </summary>
      <div class="tnode__children">${renderTitems(l.items)}</div>
    </details>`;
}
function renderTheme(t) {
  const single = t.level2.length === 1 && t.level2[0].name === t.theme;
  const children = single
    ? `<div class="tnode__children">${renderTitems(t.level2[0].items)}</div>`
    : `<div class="tnode__children">${t.level2.map(renderL2).join("")}</div>`;
  const mustB = t.mustCount ? `<span class="badge badge--must">${t.mustCount} Must</span>` : "";
  return `
    <details class="tnode tnode--theme" open>
      <summary class="tsum">
        <span class="tchev" aria-hidden="true">▸</span>
        <span class="tname tname--theme">${esc(t.theme)}</span>
        <span class="tcount">${t.count}</span>
        ${mustB}
        <a class="tlink" href="backlog.html?theme=${encodeURIComponent(t.theme)}">в бэклоге →</a>
      </summary>
      ${children}
    </details>`;
}

async function mountTree() {
  const host = document.querySelector("[data-tree]");
  if (!host) return;
  host.innerHTML = `<div class="loading">Загрузка дерева…</div>`;
  let data;
  try { data = await loadJSON("data/tree.json"); }
  catch (e) { host.innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }

  const tree = data.tree || [];
  host.innerHTML = `
    <div class="tree-controls">
      <div class="seg" role="group" aria-label="Режим отображения дерева">
        <button type="button" class="seg__btn is-active" data-mode="brief" aria-pressed="true">Кратко</button>
        <button type="button" class="seg__btn" data-mode="detail" aria-pressed="false">Подробно</button>
      </div>
      <button type="button" class="btn" data-expand>Развернуть всё</button>
      <button type="button" class="btn" data-collapse>Свернуть всё</button>
      <span class="result-meta">${data.themes} тем · ${data.count} итераций</span>
    </div>
    <div class="tree-body" data-tree-body>${tree.map(renderTheme).join("")}</div>`;

  const bodyEl = host.querySelector("[data-tree-body]");
  host.querySelectorAll("[data-mode]").forEach((b) => {
    b.addEventListener("click", () => {
      host.querySelectorAll("[data-mode]").forEach((x) => {
        const on = x === b;
        x.classList.toggle("is-active", on);
        x.setAttribute("aria-pressed", on ? "true" : "false");
      });
      const detail = b.dataset.mode === "detail";
      bodyEl.classList.toggle("is-detailed", detail);
      bodyEl.querySelectorAll("details.tnode--l2").forEach((d) => (d.open = detail));
    });
  });
  host.querySelector("[data-expand]").addEventListener("click",
    () => bodyEl.querySelectorAll("details").forEach((d) => (d.open = true)));
  host.querySelector("[data-collapse]").addEventListener("click",
    () => bodyEl.querySelectorAll("details.tnode--l2").forEach((d) => (d.open = false)));
}

document.addEventListener("DOMContentLoaded", () => {
  mountHeader();
  mountBacklog();
  mountMust();
  mountTree();
});
