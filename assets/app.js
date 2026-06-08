/* Сайт направления «Агентства» — общий JS (итерации 0–1).
   Хедер + бэклог как инструмент: фильтры, сортировка, поиск, бейджи; срез Must. */

const NAV = [
  { href: "index.html",    label: "Направление", group: "Обзор" },
  { href: "now.html",      label: "Сейчас в работе", group: "Обзор" },
  { href: "q3.html",       label: "Планы Q3", group: "Обзор" },
  { href: "vision.html",   label: "Видение", group: "Обзор" },
  { href: "lestnica.html", label: "Путь", group: "Проекции" },
  { href: "concepts.html", label: "Концепции", group: "Проекции" },
  { href: "tree.html",     label: "Дерево (JTBD)", group: "Проекции" },
  { href: "levels.html",   label: "Каталог задач", group: "Работа" },
  { href: "backlog.html",  label: "Бэклог", group: "Работа" },
  { href: "must.html",     label: "Must", group: "Работа" },
  { href: "research.html", label: "Исследования", group: "Данные" },
  { href: "agencies.html", label: "Агентства", group: "Данные" },
  { href: "rynok.html",    label: "Рынок", group: "Данные" },
  { href: "metrics.html",  label: "Метрики", group: "Данные" },
  { href: "legend.html",   label: "Легенды", group: "Справка" },
];

// Единственный источник правды по актуальности данных сайта.
const SITE_UPDATED = "июнь 2026";

function currentPage() {
  return location.pathname.split("/").pop() || "index.html";
}

function mountFooter() {
  const host = document.querySelector("[data-footer]");
  if (!host) return;
  host.innerHTML = `
    <footer class="site-footer">
      Направление «Агентства» · внутренние данные направления · обновлено: ${SITE_UPDATED}.
    </footer>`;
}

function mountHeader() {
  const host = document.querySelector("[data-header]");
  if (!host) return;
  const cur = currentPage();
  let prevGroup = null;
  const links = NAV.map((n) => {
    let sep = "";
    if (n.group && n.group !== prevGroup) {
      sep = `<span class="nav__glabel" aria-hidden="true">${esc(n.group)}</span>`;
      prevGroup = n.group;
    }
    if (n.disabled) {
      return sep + `<span class="nav__soon" aria-disabled="true" title="будет в следующих итерациях"
                 style="opacity:.4;cursor:not-allowed">${n.label}</span>`;
    }
    const active = n.href === cur ? " is-active" : "";
    return sep + `<a class="${active.trim()}" href="${n.href}">${n.label}</a>`;
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

// Пометка «редакторское допущение» — вместо сырого [*] (тултип вместо непонятного знака).
const ASSUME = `<abbr class="assume-mark" title="редакторское допущение по сборке — не подтверждено данными">*</abbr>`;

// Канон цвета этапа: 1=pink, 2A/2B=emerald (фокус Q2), 3/4/5=muted.
// Принимает строку вида "этап 2A", "2A (+2B)", "этап 4 «Увеличить маржу»", "1" — извлекает первый код.
function stageCode(s) {
  const m = String(s || "").match(/(?:^|[^\dA-Za-zА-Яа-я])(1|2A|2B|3|4|5)\b/i);
  return m ? m[1].toUpperCase() : "";
}
function stageTag(s, label) {
  const code = stageCode(s);
  if (!code) return label || s ? `<span class="stage-tag s-x">${esc(label || s)}</span>` : "";
  const txt = label != null ? label : String(s).trim();
  return `<span class="stage-tag s-${code.toLowerCase()}" data-stage="${code}">${esc(txt)}</span>`;
}

// ---- Инлайн-расшифровка жаргона (Р6): оборачивает термины в <abbr> с пояснением. ----
// На вход — УЖЕ экранированный текст (без своих тегов). Один проход, без вложенности.
const GLOSS_TERMS = [
  ["TTFO", "время до первой закрытой услуги новым агентством"],
  ["T-op", "трудозатраты на операцию (время консультанта)"],
  ["T-wait", "время ожидания: очередь, поддержка, согласования"],
  ["OPEX", "операционные расходы агентства"],
  ["NSM", "главная метрика направления (North Star)"],
  ["Q2", "2-й квартал 2026 — текущий фокус направления"],
  // Английские метрики из этапов пути — раскрываем простым языком (раньше шли без тултипа).
  ["Adoption-in-AA", "доля новых агентств, реально перешедших работать в Агентскую админку"],
  ["Parity gap", "разрыв в функциях: чего в Ракете ещё нет против привычных инструментов"],
  ["Self-service share", "доля операций, которые делают сами, без обращения в поддержку"],
  ["Support-ratio", "сколько обращений в поддержку Ракеты приходится на объём операций"],
  ["Rework rate", "доля переделок — операций, которые пришлось делать заново"],
  ["Incidents-per-services", "число сбоев на объём оказанных услуг"],
  ["Blocker-time", "время, когда работа стоит из-за блокера"],
  ["SLA hit rate", "доля обращений, закрытых в обещанный срок"],
  ["Time-to-cash", "время от оказанной услуги до денег на счёте агентства"],
  ["Hidden-work", "скрытая ручная работа, не видимая в системе"],
  ["Steps-per-task", "сколько шагов уходит на одну задачу"],
  ["Operations per consultant", "сколько операций обслуживает один консультант"],
  ["adoption", "приживаемость: реально ли команда начала пользоваться продуктом"],
  ["паритет", "паритет функций: в Ракете есть всё, к чему команда привыкла"],
  ["GDS", "глобальная система бронирования (Amadeus, Sabre и т.п.)"],
];
function gloss(s) {
  if (!s) return s;
  let out = String(s)
    .replace(/\b(H\d+(?:\.\d+){1,2})\b/g,
      `<abbr class="gloss" title="проверяемая гипотеза ценности — раскрыта в «Пути агентства» и Легендах">$1</abbr>`)
    .replace(/\b(E\.\d)\b/g,
      `<abbr class="gloss" title="находка анализа дерева работ — см. Дерево (JTBD)">$1</abbr>`);
  for (const [t, def] of GLOSS_TERMS) {
    const esc_t = t.replace(/[-]/g, "\\-");
    out = out.replace(new RegExp(`(?<![\\wА-Яа-я-])(${esc_t})(?![\\wА-Яа-я-])`, "g"),
      `<abbr class="gloss" title="${def}">$1</abbr>`);
  }
  return out;
}
const GLOSS_TEST = /\b(?:H\d+\.\d|E\.\d|TTFO|T-op|T-wait|OPEX|NSM|Q2)\b/;
// Расшифровать жаргон в готовом DOM (для статических страниц вроде tree.html).
function glossifyDOM(root) {
  if (!root) return;
  const skip = new Set(["A", "ABBR", "BUTTON", "CODE", "SCRIPT", "STYLE", "INPUT", "TEXTAREA"]);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue || !GLOSS_TEST.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
      for (let p = n.parentNode; p && p !== root.parentNode; p = p.parentNode) {
        if (skip.has(p.nodeName)) return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const targets = [];
  while (walker.nextNode()) targets.push(walker.currentNode);
  targets.forEach((node) => {
    const span = document.createElement("span");
    span.innerHTML = gloss(esc(node.nodeValue));
    node.replaceWith(...span.childNodes);
  });
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

const SEARCH_FIELDS = ["title", "jobStory", "iteration", "id", "gitlabId", "quote", "rationale", "agencies", "hypothesis", "activeMetrics", "targetMetrics"];
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

// L1-карточка темы: список L2 с живыми числами из tree.json (по bucket-именам).
function renderLevelBucket(bucketName, treeByTheme) {
  const tb = treeByTheme[bucketName];
  if (!tb) return "";
  const single = tb.level2.length === 1 && tb.level2[0].name === bucketName;
  const head = `<div class="l2group__h">${esc(bucketName)}<span class="c">${tb.count}</span></div>`;
  const l2 = single
    ? `<ul class="l2"><li><span class="dot"></span><span class="nm muted">единый L2 — разнести при разборе ${ASSUME}</span><span class="c">${tb.count}</span></li></ul>`
    : `<ul class="l2">${tb.level2.slice().sort((a, b) => b.count - a.count).map((l) =>
        `<li><span class="dot"></span><span class="nm">${esc(l.name)}</span><span class="c">${l.count}</span></li>`).join("")}</ul>`;
  return `<div class="l2group">${head}${l2}</div>`;
}
// Общий шаблон полного описания карточки (L1 и L2 одинаковый каркас).
function renderFull(f) {
  if (!f) return "";
  const li = (arr) => `<ol class="fl-list">${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>`;
  const meta = [];
  if (f.block) meta.push(["Блок", f.block]);
  if (f.subgoalFull) meta.push(["Подцель", f.subgoalFull]);
  if (f.bigjobFull) meta.push(["Big job", f.bigjobFull]);
  if (f.hypFull) meta.push(["Гипотеза", f.hypFull]);
  const metaHtml = meta.length
    ? `<dl class="fl-meta">${meta.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : "";
  const roles = f.roles ? `
    <div class="fl-sect"><h4>Поток ролей</h4>
      <ul class="fl-roles">
        <li><b>Инициатор:</b> ${esc(f.roles.initiator)}</li>
        <li><b>Промежуточный:</b> ${esc(f.roles.intermediate)}</li>
        <li><b>Завершающий:</b> ${esc(f.roles.finisher)}</li>
        <li class="fl-gone"><b>Исчез из потока:</b> ${esc(f.roles.gone)}</li>
      </ul></div>` : "";
  const impact = f.impact ? `
    <div class="fl-sect"><h4>Влияние на цель</h4>
      <p class="fl-direct">${esc(f.impact.direct)}</p>
      <div class="fl-metrics">
        <div><span class="fl-mk">Активные</span><ul>${(f.impact.active || []).map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>
        <div><span class="fl-mk">Целевые</span><ul>${(f.impact.target || []).map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>
      </div></div>` : "";
  const scen = f.scenario ? `
    <div class="fl-sect"><h4>Сценарий</h4>
      <p class="fl-scen"><span class="fl-tag fl-tag--is">As-is</span> ${esc(f.scenario.asis)}</p>
      <p class="fl-scen"><span class="fl-tag fl-tag--will">To be</span> ${esc(f.scenario.aswill)}</p></div>` : "";
  return `
    <div class="fl">
      ${metaHtml}
      ${roles}
      ${f.problem ? `<div class="fl-sect"><h4>Проблема</h4>${li(f.problem)}</div>` : ""}
      ${f.result ? `<div class="fl-sect"><h4>Результат</h4>${li(f.result)}</div>` : ""}
      ${impact}
      ${scen}
      ${f.entelechy ? `<div class="fl-sect"><h4>Образ результата</h4><p class="fl-ent">${esc(f.entelechy)}</p></div>` : ""}
    </div>`;
}
// L2-подтема с раскрытием в полную карточку + ссылки на задачи в едином бэклоге.
function levelsRoleCls(role) { return role === "r" ? "is-r" : role === "c" ? "is-c" : ""; }
function themeCount(t, byTheme) {
  return (t.buckets || []).reduce((s, b) => s + ((byTheme[b] && byTheme[b].count) || 0), 0);
}
// Индекс L2-узлов бэклога по имени (заполняется в mountLevels) — для живого счётчика подтем.
let LEVELS_L2IDX = {};
// Карта «код гипотезы → текст» (заполняется в mountLevels из ladder.json) — чтобы в карточке
// справа показывать формулировку гипотезы, а не голый код (H2.4 → её текст).
let HYP_TEXT = {};
// Разворачивает строку кодов («H2.2 + H2.3», «H2.2–H2.5», «H5.x») в список {code, text}.
function hypList(codeStr) {
  if (!codeStr) return [];
  const out = [], seen = new Set();
  const add = (c) => {
    c = c.trim(); if (!c || seen.has(c)) return; seen.add(c);
    out.push({ code: c, text: HYP_TEXT[c] || null });
  };
  String(codeStr).split(/[+,]/).forEach((part) => {
    part = part.trim();
    const r = part.match(/^H(\d+)\.(\d+)\s*[–-]\s*(?:H\d+\.)?(\d+)$/);
    if (r && +r[2] <= +r[3]) { for (let n = +r[2]; n <= +r[3]; n++) add(`H${r[1]}.${n}`); }
    else add(part);
  });
  return out;
}
// Блок «Гипотеза» для правого сайдбара: код + формулировка (или «уточняется», если текста нет).
function hypBlock(codeStr) {
  const items = hypList(codeStr);
  if (!items.length) return "";
  return `<div class="pn-aside__hyp"><div class="pn-aside__hk">Гипотеза</div>
    ${items.map((it) => `<p class="hyp-line"><b>${esc(it.code)}</b>${it.text
      ? " — " + esc(it.text) : `<span class="muted"> — формулировка уточняется</span>`}</p>`).join("")}</div>`;
}
// Счётчик подтемы: живой из бакета-темы или из L2-узла (countFrom) либо предварительный [*] либо «—».
function l2count(l, byTheme) {
  if (l.countFrom && byTheme[l.countFrom]) return { n: byTheme[l.countFrom].count, star: false };
  if (l.countFrom && LEVELS_L2IDX[l.countFrom] != null) return { n: LEVELS_L2IDX[l.countFrom], star: false };
  if (l.count != null) return { n: l.count, star: true };
  return { n: null, star: false };
}
function l2countStr(l, byTheme, withStar) {
  const c = l2count(l, byTheme);
  if (c.n == null) return "—";
  return c.n + (withStar && c.star ? " " + ASSUME : "");
}
function renderTasksBlock(l, bucketTheme) {
  if (!(l.tasks && l.tasks.length)) return "";
  return `
    <div class="fl-sect"><h4>База задач → единый бэклог</h4>
      <ul class="fl-tasks">${l.tasks.map((tk) => {
        const st = tk.status && tk.status !== "—" ? `<span class="fl-st">${esc(tk.status)}</span>` : "";
        return tk.iid
          ? `<li><a class="fl-task" href="backlog.html?q=${encodeURIComponent(tk.iid)}">${esc(tk.title)} <span class="fl-iid">IID ${esc(tk.iid)} →</span></a>${st}</li>`
          : `<li><span class="fl-task fl-task--noid">${esc(tk.title)}</span>${st}</li>`;
      }).join("")}</ul>
      ${bucketTheme ? `<a class="foot-link" href="backlog.html?theme=${encodeURIComponent(bucketTheme)}">все итерации темы в бэклоге →</a>` : ""}
    </div>`;
}
// Правая панель — стартовый обзор: все ветки и темы карточками (без падения внутрь темы).
function panelOverview(branches, byTheme, orphanBranch) {
  return `<div class="pn-over">
    <h2 class="pn-over__h">Все темы направления</h2>
    <p class="pn-over__lede">Три ветки, семь тем. Выберите тему — справа откроется её описание и задачи.</p>
    ${branches.map((b, i) => `
      <section class="ov-branch">
        <div class="ov-branch__h">
          <span class="rail-bnum">Ветка ${b === orphanBranch ? "—" : i + 1}</span>
          ${esc(b.name)}${b.stage ? `<span class="ov-branch__s">${esc(b.stage)}</span>` : ""}
        </div>
        <div class="ov-grid">${b.themes.map((t) => {
          const cnt = (t.buckets && t.buckets.length) ? themeCount(t, byTheme) : "—";
          const nL2 = (t.editorialL2 && t.editorialL2.length) || 0;
          return `<a class="ov-card ${levelsRoleCls(t.role)}" href="${selHref("t:" + t.name)}" data-sel="t:${esc(t.name)}">
            <div class="ov-card__top"><span class="ov-card__n">${esc(t.name)}</span>
              <span class="ov-card__c" title="задач в бэклоге">${cnt}</span></div>
            <p class="ov-card__a">${esc(t.about || "")}</p>
            ${nL2 ? `<span class="ov-card__sub">${nL2}&nbsp;подтем →</span>` : ""}
          </a>`;
        }).join("")}</div>
      </section>`).join("")}
  </div>`;
}
// Правая панель — тема L1 (полное описание + список подтем).
function panelTheme(t, byTheme) {
  const cntBig = (t.buckets && t.buckets.length) ? String(themeCount(t, byTheme)) : "—";
  const tags = [
    `<span class="ltag">Механизм · ${esc(t.mechanism)}</span>`,
    `<span class="ltag">${esc(t.subgoal)}</span>`,
    `<span class="ltag big">${esc(t.bigjob)}</span>`,
  ].join("");
  let sub;
  if (t.editorialL2 && t.editorialL2.length) {
    sub = `<div class="fl-sect"><h4>Подтемы L2 — выберите для полного описания</h4>
      ${t.editorialL2Note ? `<p class="l2src">${esc(t.editorialL2Note)}</p>` : ""}
      <ul class="pn-sublist">${t.editorialL2.map((l, i) => {
        const off = l.q2 === false ? `<span class="pn-sub__off">Won't Q2</span>` : "";
        const st = l.stage ? stageTag(l.stage) : "";
        const hyp = l.hyp ? `<span class="pn-sub__hyp">${esc(l.hyp)}</span>` : "";
        const lid = "l:" + t.name + ":" + i;
        return `<li><a class="pn-sub" href="${selHref(lid)}" data-sel="${esc(lid)}">
          <span class="pn-sub__n">${esc(l.name)}${off}</span>
          <span class="pn-sub__m">${st}${hyp}</span>
          <span class="pn-sub__c">${l2countStr(l, byTheme, true)} ›</span></a></li>`;
      }).join("")}</ul></div>`;
  } else if (t.buckets && t.buckets.length) {
    sub = `<div class="fl-sect"><h4>Подтемы L2 <span class="muted">(группы бэклога)</span></h4>
      <div class="l2grid">${t.buckets.map((b) => renderLevelBucket(b, byTheme)).join("")}</div>
      <a class="foot-link" href="backlog.html?theme=${encodeURIComponent(t.buckets[0])}">все итерации темы в бэклоге →</a></div>`;
  } else {
    sub = `<p class="muted pn__todo">${t.note ? esc(t.note) : "Нет итераций в бэклоге " + ASSUME}</p>`;
  }
  const backlogLink = (t.buckets && t.buckets.length)
    ? `<a href="backlog.html?theme=${encodeURIComponent(t.buckets[0])}">Все задачи в Бэклоге →</a>` : "";
  const aside = `<aside class="pn-aside"><div class="pn-aside__card">
      <div class="pn-aside__cnt"><span class="n">${cntBig}</span><span class="l">задач в бэклоге</span></div>
      <div class="ltags ltags--col">${tags}</div>
      ${hypBlock(t.hyp)}
      <div class="pn-aside__links">${backlogLink}
        <a href="tree.html">Кто и зачем — Дерево (JTBD) →</a></div>
    </div></aside>`;
  return `<div class="pn-layout"><div class="pn">
    <div class="pn__head">
      <span class="pn__kind">Тема L1</span>
      <h2 class="pn__title">${esc(t.name)}</h2>
    </div>
    <p class="pn__about">${esc(t.about)}</p>
    ${t.full ? renderFull(t.full) : `<p class="muted pn__todo">Полное описание этой темы ещё не перенесено из источника ${ASSUME}.</p>`}
    ${sub}
  </div>${aside}</div>`;
}
// Правая панель — подтема L2 (полная карточка + задачи / ссылка в бэклог).
function panelL2(t, l, byTheme) {
  const off = l.q2 === false ? `<span class="ltag">Won't Q2</span>` : "";
  const linkTheme = l.countFrom || l.backlogTheme;
  const bodyFooter = (l.tasks && l.tasks.length) ? renderTasksBlock(l, t.buckets && t.buckets[0]) : "";
  const stageChip = l.stage ? stageTag(l.stage) : "";
  const chips = stageChip + off;
  const asideLink = linkTheme
    ? `<a href="backlog.html?theme=${encodeURIComponent(linkTheme)}">Итерации подтемы в Бэклоге →</a>` : "";
  const aside = `<aside class="pn-aside"><div class="pn-aside__card">
      <div class="pn-aside__cnt"><span class="n">${l2countStr(l, byTheme, true)}</span><span class="l">итераций</span></div>
      ${chips ? `<div class="ltags ltags--col">${chips}</div>` : ""}
      ${hypBlock(l.hyp)}
      <div class="pn-aside__links">${asideLink}
        <a href="tree.html">Кто и зачем — Дерево (JTBD) →</a></div>
    </div></aside>`;
  return `<div class="pn-layout"><div class="pn">
    <div class="pn__crumb"><a href="${selHref("t:" + t.name)}" data-sel="t:${esc(t.name)}">‹ ${esc(t.name)}</a></div>
    <div class="pn__head">
      <span class="pn__kind">Подтема L2</span>
      <h2 class="pn__title">${esc(l.name)}</h2>
    </div>
    ${l.note ? `<p class="l2note">${esc(l.note)}</p>` : ""}
    ${renderFull(l.full)}
    ${bodyFooter}
  </div>${aside}</div>`;
}
// Ссылка-состояние для пунктов навигации (даёт клавиатуру, «Назад», открытие в новой вкладке).
function selHref(sel) { return "?sel=" + encodeURIComponent(sel); }
// Левая навигация — ветка с темами и (для редакторских) вложенными подтемами.
function railBranch(b, byTheme, idx, sel) {
  const themes = b.themes.map((t) => {
    const tid = "t:" + t.name;
    const cnt = (t.buckets && t.buckets.length) ? themeCount(t, byTheme) : ASSUME;
    const subs = (t.editorialL2 && t.editorialL2.length)
      ? `<ul class="rail-l2">${t.editorialL2.map((l, i) => {
          const lid = "l:" + t.name + ":" + i;
          const on = sel === lid;
          return `<li><a class="rail-sub${on ? " is-on" : ""}" href="${selHref(lid)}" data-sel="${esc(lid)}"${on ? ' aria-current="true"' : ""}>
            <span>${esc(l.name)}</span><span class="rail-c" title="итераций в бэклоге">${l2countStr(l, byTheme, false)}</span></a></li>`;
        }).join("")}</ul>` : "";
    const on = sel === tid;
    return `<li>
      <a class="rail-theme ${levelsRoleCls(t.role)}${on ? " is-on" : ""}" href="${selHref(tid)}" data-sel="${esc(tid)}"${on ? ' aria-current="true"' : ""}>
        <span class="rail-name">${esc(t.name)}</span><span class="rail-c" title="задач в бэклоге">${cnt}</span></a>
      ${subs}</li>`;
  }).join("");
  return `<details class="rail-branch" open>
    <summary><span class="rail-bnum">Ветка ${idx}</span> <span class="rail-bname">${esc(b.name)}</span></summary>
    <ul class="rail-themes">${themes}</ul></details>`;
}
async function mountLevels() {
  const host = document.querySelector("[data-levels]");
  if (!host) return;
  host.innerHTML = `<div class="loading">Загрузка карты уровней…</div>`;
  let levels, tree, ladder = null;
  try {
    [levels, tree] = await Promise.all([loadJSON("data/levels.json"), loadJSON("data/tree.json")]);
  } catch (e) { host.innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }
  try { ladder = await loadJSON("data/ladder.json"); } catch (e) { /* тексты гипотез необязательны */ }
  HYP_TEXT = {};
  if (ladder && ladder.stages) ladder.stages.forEach((s) => {
    const eat = (arr) => (arr || []).forEach((h) => { if (h.code) HYP_TEXT[h.code] = h.text; });
    eat(s.hypotheses);
    (s.blocks || []).forEach((bl) => eat(bl.hypotheses));
  });

  const byTheme = {};
  LEVELS_L2IDX = {};
  (tree.tree || []).forEach((t) => {
    byTheme[t.theme] = t;
    (t.level2 || []).forEach((l) => { LEVELS_L2IDX[l.name] = l.count; });
  });

  // бакеты бэклога без темы L1 — отдельная псевдо-ветка «Вне карты», ничего не прячем
  const mapped = new Set();
  levels.branches.forEach((b) => b.themes.forEach((t) => {
    (t.buckets || []).forEach((x) => mapped.add(x));
    (t.editorialL2 || []).forEach((l) => { if (l.countFrom) mapped.add(l.countFrom); });
  }));
  const orphans = (tree.tree || []).filter((t) => !mapped.has(t.theme));
  const orphanBranch = orphans.length ? {
    name: "Вне каталога", stage: "группы бэклога без темы уровня 1",
    themes: orphans.map((o) => ({ name: o.theme, role: "", about:
      "Группа бэклога ещё не разнесена по темам уровня 1 — требует редакторского решения.",
      mechanism: "—", subgoal: "—", bigjob: "—", hyp: "—", buckets: [o.theme] })),
  } : null;
  const branches = orphanBranch ? levels.branches.concat([orphanBranch]) : levels.branches;

  const findTheme = (name) => {
    for (const b of branches) { const t = b.themes.find((x) => x.name === name); if (t) return t; }
    return null;
  };

  let sel = "overview";
  const params = new URLSearchParams(location.search);
  if (params.get("sel")) sel = params.get("sel");

  host.innerHTML = `
    <div class="lv2">
      <aside class="lv2__rail" data-rail aria-label="Навигация по темам"></aside>
      <div class="lv2__panel" data-panel></div>
    </div>`;
  const railEl = host.querySelector("[data-rail]");
  const panelEl = host.querySelector("[data-panel]");

  function renderRail() {
    const over = `<a class="rail-over${sel === "overview" ? " is-on" : ""}" href="${selHref("overview")}" data-sel="overview"${sel === "overview" ? ' aria-current="true"' : ""}>▤ Все темы (обзор)</a>`;
    railEl.innerHTML = over + branches.map((b, i) =>
      railBranch(b, byTheme, b === orphanBranch ? "—" : i + 1, sel)).join("");
  }
  function renderPanel() {
    let html;
    if (sel === "overview") {
      html = panelOverview(branches, byTheme, orphanBranch);
    } else if (sel.startsWith("l:")) {
      const rest = sel.slice(2), i = rest.lastIndexOf(":");
      const t = findTheme(rest.slice(0, i)), l = t && t.editorialL2 && t.editorialL2[+rest.slice(i + 1)];
      html = l ? panelL2(t, l, byTheme) : `<p class="error">Подтема не найдена</p>`;
    } else {
      const t = findTheme(sel.slice(2));
      html = t ? panelTheme(t, byTheme) : `<p class="error">Тема не найдена</p>`;
    }
    panelEl.innerHTML = html;
    glossifyDOM(panelEl);
  }
  function render() { renderRail(); renderPanel(); }
  const defaultSel = () => "overview";
  // Переход к теме/подтеме: рендер + (по клику) запись в URL + возврат взгляда к началу карточки.
  function go(newSel, push) {
    sel = newSel;
    if (push) history.pushState({ sel }, "", selHref(sel));
    render();
    const top = host.getBoundingClientRect().top + window.scrollY - 12;
    if (window.scrollY > top) window.scrollTo({ top, behavior: "auto" });
  }
  host.addEventListener("click", (e) => {
    const a = e.target.closest("[data-sel]");
    if (!a) return;
    e.preventDefault();
    go(a.getAttribute("data-sel"), true);
  });
  // Кнопки «Назад/Вперёд» браузера и прямой заход по ?sel=.
  window.addEventListener("popstate", () => {
    sel = new URLSearchParams(location.search).get("sel") || defaultSel();
    render();
  });
  render();
}

// ===================== Агентства. Цифры (agencies.html) =====================
const RU_NUM = new Intl.NumberFormat("ru-RU");
function fmtNum(n) { return n == null ? "—" : RU_NUM.format(Math.round(n)); }
function fmtPct(x, digits = 1) { return x == null ? "—" : (x * 100).toFixed(digits) + "%"; }
function pctCell(x) {
  if (x == null) return `<span class="muted">—</span>`;
  const cls = x > 0 ? "pos" : x < 0 ? "neg" : "zero";
  const sign = x > 0 ? "+" : "";
  return `<span class="delta ${cls}">${sign}${(x * 100).toFixed(1)}%</span>`;
}
// Целочисленная дельта (например, чистая дельта клиентов +4 / −1).
function intDelta(n) {
  if (n == null) return `<span class="muted">—</span>`;
  const cls = n > 0 ? "pos" : n < 0 ? "neg" : "zero";
  const sign = n > 0 ? "+" : "";
  return `<span class="delta ${cls}">${sign}${RU_NUM.format(n)}</span>`;
}

// --- Графики динамики операций (чистый SVG, без библиотек) ---
const RU_MON = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
function monLabel(s) {                          // "05.2025" → "май·25"
  if (!s) return "";
  const [m, y] = String(s).split(".");
  return (RU_MON[(+m) - 1] || m) + "·" + String(y).slice(2);
}
function fmtK(n) {                              // 43587 → "43,6к", 920 → "920"
  if (n == null) return "—";
  return n >= 1000 ? (n / 1000).toFixed(1).replace(".", ",") + "к" : RU_NUM.format(n);
}

// Мини-линия динамики для строки таблицы (цвет = направление: вверх emerald / вниз pink).
function sparkline(series, w = 88, h = 26) {
  const vals = (series || []).filter((v) => v != null);
  if (vals.length < 2) return `<span class="muted">—</span>`;
  const min = Math.min(...vals), max = Math.max(...vals), span = (max - min) || 1;
  const n = series.length, pad = 2;
  const pts = series.map((v, i) => [pad + (i / (n - 1)) * (w - 2 * pad),
    (h - pad) - ((v - min) / span) * (h - 2 * pad)]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const first = series.find((v) => v != null), last = [...series].reverse().find((v) => v != null);
  const dir = last > first ? "up" : last < first ? "down" : "flat";
  const lp = pts[n - 1];
  return `<svg class="spark spark--${dir}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="${lp[0].toFixed(1)}" cy="${lp[1].toFixed(1)}" r="2" fill="currentColor"/></svg>`;
}

// «Красивый» шаг сетки под диапазон значений (1/2/5 × 10ⁿ).
function niceStep(range, ticks = 4) {
  const raw = (range || 1) / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const nrm = raw / mag;
  return (nrm <= 1 ? 1 : nrm <= 2 ? 2 : nrm <= 5 ? 5 : 10) * mag;
}

// Главный area-график по месяцам. opts.fmtVal — подписи точек, opts.fmtAxis — подписи оси Y.
function areaChart(months, values, opts = {}) {
  const v = (values || []).filter((x) => x != null);
  if (v.length < 2) return "";
  const fmtVal = opts.fmtVal || fmtK;
  const fmtAxis = opts.fmtAxis || ((g) => g / 1000 + "к");
  const W = 760, H = 240, pL = 46, pR = 14, pT = 18, pB = 30;
  const iw = W - pL - pR, ih = H - pT - pB, n = values.length;
  const step = opts.step || niceStep(Math.max(...v) - Math.min(...v));
  const lo = Math.floor(Math.min(...v) / step) * step;
  const hi = Math.ceil(Math.max(...v) / step) * step;
  const span = (hi - lo) || 1;
  const X = (i) => pL + (i / (n - 1)) * iw;
  const Y = (val) => pT + ih - ((val - lo) / span) * ih;
  const pts = values.map((val, i) => [X(i), Y(val)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const base = (pT + ih).toFixed(1);
  const area = `M${pts[0][0].toFixed(1)} ${base} ` + pts.map((p) => "L" + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ") + ` L${pts[n - 1][0].toFixed(1)} ${base} Z`;
  let grid = "";
  for (let g = lo; g <= hi + 1e-9; g += step) {
    const y = Y(g).toFixed(1);
    grid += `<line x1="${pL}" y1="${y}" x2="${W - pR}" y2="${y}" class="ch-grid"/>`
      + `<text x="${pL - 8}" y="${(+y + 3).toFixed(1)}" class="ch-ylab" text-anchor="end">${fmtAxis(g)}</text>`;
  }
  // Якорь по краям, чтобы крайние подписи не обрезались о границу SVG.
  const anc = (x) => (x <= pL + 22 ? "start" : x >= W - pR - 22 ? "end" : "middle");
  let xlab = "";
  months.forEach((m, i) => { if (i % 2 === 0 || i === n - 1) xlab += `<text x="${X(i).toFixed(1)}" y="${H - 9}" class="ch-xlab" text-anchor="${anc(X(i))}">${monLabel(m)}</text>`; });
  const yref = Y(values[0]).toFixed(1);
  const ref = opts.ref === false ? "" : `<line x1="${pL}" y1="${yref}" x2="${W - pR}" y2="${yref}" class="ch-ref"/>`;
  const iMax = values.indexOf(Math.max(...v)), iMin = values.indexOf(Math.min(...v));
  const mk = (i, cls) => { const [x, y] = pts[i]; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" class="ch-dot ${cls}"/>`
    + `<text x="${x.toFixed(1)}" y="${(y - 9).toFixed(1)}" class="ch-mark ${cls}" text-anchor="${anc(x)}">${fmtVal(values[i])}</text>`; };
  return `<svg class="ag-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Операции по месяцам, ${months[0]}–${months[n - 1]}">
    <defs><linearGradient id="agArea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--emerald)" stop-opacity="0.30"/>
      <stop offset="1" stop-color="var(--emerald)" stop-opacity="0.02"/></linearGradient></defs>
    ${grid}${ref}<path d="${area}" fill="url(#agArea)"/><path d="${line}" class="ch-line"/>
    ${mk(iMax, "mk-peak")}${mk(iMin, "mk-low")}${mk(n - 1, "mk-last")}${xlab}</svg>`;
}

// Мульти-линейный график долей в % (динамика доли лидера по операциям и клиентам).
// lines: [{ label, cls (CSS-переменная цвета), vals: [% …] }]
function shareLines(months, lines) {
  const all = lines.flatMap((l) => l.vals).filter((x) => x != null);
  if (all.length < 2) return "";
  const W = 760, H = 224, pL = 40, pR = 14, pT = 16, pB = 44;
  const iw = W - pL - pR, ih = H - pT - pB;
  const step = Math.max(niceStep(Math.max(...all) - Math.min(...all)), 5);
  const lo = Math.floor(Math.min(...all) / step) * step;
  const hi = Math.ceil(Math.max(...all) / step) * step;
  const span = (hi - lo) || 1;
  const n = Math.max(...lines.map((l) => l.vals.length));
  const X = (i) => pL + (i / (n - 1)) * iw;
  const Y = (val) => pT + ih - ((val - lo) / span) * ih;
  let grid = "";
  for (let g = lo; g <= hi + 1e-9; g += step) {
    const y = Y(g).toFixed(1);
    grid += `<line x1="${pL}" y1="${y}" x2="${W - pR}" y2="${y}" class="ch-grid"/>`
      + `<text x="${pL - 8}" y="${(+y + 3).toFixed(1)}" class="ch-ylab" text-anchor="end">${g}%</text>`;
  }
  const anc = (x) => (x <= pL + 22 ? "start" : x >= W - pR - 22 ? "end" : "middle");
  let xlab = "";
  months.forEach((m, i) => { if (i % 2 === 0 || i === n - 1) xlab += `<text x="${X(i).toFixed(1)}" y="${H - 24}" class="ch-xlab" text-anchor="${anc(X(i))}">${monLabel(m)}</text>`; });
  let paths = "", legend = "";
  lines.forEach((l, li) => {
    const pts = l.vals.map((val, i) => [X(i), Y(val)]);
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const lp = pts[pts.length - 1], lv = l.vals[l.vals.length - 1];
    paths += `<path d="${d}" fill="none" stroke="var(${l.cls})" stroke-width="2" stroke-linejoin="round"/>`
      + `<circle cx="${lp[0].toFixed(1)}" cy="${lp[1].toFixed(1)}" r="3" fill="var(${l.cls})"/>`
      + `<text x="${(lp[0] - 6).toFixed(1)}" y="${(lp[1] + 3).toFixed(1)}" text-anchor="end" class="ch-mark" fill="var(${l.cls})">${Math.round(lv)}%</text>`;
    legend += `<g transform="translate(${pL + li * 180}, ${H - 6})"><line x1="0" y1="-4" x2="16" y2="-4" stroke="var(${l.cls})" stroke-width="2"/><text x="22" y="0" class="ch-leg">${esc(l.label)}</text></g>`;
  });
  return `<svg class="ag-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Доля лидера по месяцам">
    ${grid}${paths}${xlab}${legend}</svg>`;
}

async function mountAgencies() {
  const sumHost = document.querySelector("[data-ag-summary]");
  const tblHost = document.querySelector("[data-ag-table]");
  if (!sumHost && !tblHost) return;
  let data;
  try { data = await loadJSON("data/agencies.json"); }
  catch (e) { if (sumHost) sumHost.innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }

  const ags = data.agencies || [];
  const t = data.total || {};
  const c = data.concentration || {};
  const nsm = data.nsm || {};
  const mon = data.monthly || null;
  const monCl = data.monthlyClients || null;

  // Лидер базы (ядро) против остальных — для сплит-полос «IBC ↔ все».
  const lead = ags.reduce((a, b) => ((b.may || 0) > (a.may || 0) ? b : a), ags[0] || {});
  const leadName = /IBC/i.test(lead.name || "") ? "IBC" : (lead.name || "лидер");
  const others = Math.max(ags.length - 1, 0);
  const opsTotal = t.may || ags.reduce((s, a) => s + (a.may || 0), 0);
  const clTotal = nsm.now || ags.reduce((s, a) => s + (a.clNow || 0), 0);
  const opsLeadPct = opsTotal ? (lead.may || 0) / opsTotal : 0;
  const clLeadPct = clTotal ? (lead.clNow || 0) / clTotal : 0;
  const opcLead = lead.clNow ? Math.round((lead.may || 0) / lead.clNow) : null;
  const opcRest = (clTotal - (lead.clNow || 0)) ? Math.round((opsTotal - (lead.may || 0)) / (clTotal - (lead.clNow || 0))) : null;
  const clUp = ags.filter((a) => (a.clNet || 0) > 0).length;
  const clDown = ags.filter((a) => (a.clNet || 0) < 0).length;

  // Динамика доли лидера по месяцам (операции + клиенты). Ряды выравниваем к 12-мес. окну клиентов.
  let ibcShareBlock = "";
  if (mon && monCl && mon.total && monCl.total && mon.byId && monCl.byId) {
    const ibcId = String(lead.id);
    const opsT = mon.total, opsIbc = mon.byId[ibcId] || [];
    const clT = monCl.total, clIbc = monCl.byId[ibcId] || [];
    const cm = monCl.months;
    const off = Math.max(mon.months.length - cm.length, 0);   // ops длиннее на 1 мес. — сдвигаем
    const opsShare = cm.map((_, i) => { const a = opsIbc[i + off], b = opsT[i + off]; return (a != null && b) ? 100 * a / b : null; });
    const clShare = cm.map((_, i) => { const a = clIbc[i], b = clT[i]; return (a != null && b) ? 100 * a / b : null; });
    const chart = shareLines(cm, [
      { label: `Операции (${leadName})`, cls: "--emerald", vals: opsShare },
      { label: `Клиенты (${leadName})`, cls: "--gold", vals: clShare },
    ]);
    const ov = opsShare.filter((x) => x != null), cv = clShare.filter((x) => x != null);
    if (chart && ov.length && cv.length) {
      const oL = ov[ov.length - 1], cL = cv[cv.length - 1];
      ibcShareBlock = `
        <div class="split" style="margin-top:18px">
          <div class="split-row"><div class="lbl">Динамика: доля ${esc(leadName)} в объёме — операции и клиенты, по месяцам</div></div>
          ${chart}
          <div class="conc-cap"><b>Доля ${esc(leadName)} в операциях держится около ${Math.round(oL)}% весь год</b>
          (${Math.round(Math.min(...ov))}–${Math.round(Math.max(...ov))}%) — концентрация по объёму не растёт, но
          остаётся высокой. По клиентам — около ${Math.round(cL)}%, чуть ниже, чем год назад. Разрыв ~${Math.round(oL - cL)} пп
          устойчив: один клиент ${esc(leadName)} «весит» больше.</div>
        </div>`;
    }
  }

  if (sumHost) {
    const splitBar = (leadPct, leadTxt, restTxt) => `
      <div class="split-bar">
        <span class="seg seg-ibc" style="flex:${(leadPct * 100).toFixed(1)}">${leadTxt}</span>
        <span class="seg seg-rest" style="flex:${((1 - leadPct) * 100).toFixed(1)}">${restTxt}</span>
      </div>`;
    sumHost.innerHTML = `
      <div class="ag-strip">
        <div class="ag-stat"><div class="v">${t.count ?? ags.length}</div><div class="l">агентств</div><div class="s">активных в мае</div></div>
        <div class="ag-stat"><div class="v">${fmtNum(nsm.now)}</div><div class="l">клиентов · NSM</div><div class="s">главная метрика</div></div>
        <div class="ag-stat ag-stat--win"><div class="v">+${fmtNum(nsm.net)}</div><div class="l">клиентов / 6 мес.</div><div class="s">${fmtNum(nsm.new)} пришло − ${fmtNum(nsm.lost)} ушло</div></div>
        <div class="ag-stat"><div class="v">${fmtNum(t.may)}</div><div class="l">операций · май</div><div class="s">${pctCell(t.momPct)} к апрелю</div></div>
        <div class="ag-stat"><div class="v">${fmtPct(c.top3, 0)}</div><div class="l">у ТОП-3</div><div class="s">концентрация базы</div></div>
        <div class="ag-stat ag-stat--goal"><div class="v">+20</div><div class="l">цель · агентств</div><div class="s">стратегия 2026 (KR-2)</div></div>
      </div>
      <div class="conc-wrap">
        <div class="conc-bar" role="img" aria-label="Концентрация: ТОП-3 ${fmtPct(c.top3,0)}, ТОП-5 ${fmtPct(c.top5,0)}">
          ${ags.slice(0, 5).map((a, i) => `<span class="conc-seg s${i}" style="flex:${(a.sharePct || 0) * 100}" title="${esc(a.name)} · ${fmtPct(a.sharePct)}"></span>`).join("")}
          <span class="conc-seg rest" style="flex:${(1 - (ags.slice(0, 5).reduce((s, a) => s + (a.sharePct || 0), 0))) * 100}" title="остальные"></span>
        </div>
        <div class="conc-cap">Полоса выше — доли пяти крупнейших агентств и «хвоста» по операциям. ТОП-5 = ${fmtPct(c.top5, 0)} операций, ТОП-3 = ${fmtPct(c.top3, 0)}.</div>
      </div>
      <div class="split">
        <div class="split-row">
          <div class="lbl">Операции (май): ${esc(leadName)} ↔ остальные ${others}</div>
          ${splitBar(opsLeadPct, `${esc(leadName)} ${fmtPct(opsLeadPct, 0)}`, `остальные ${others} — ${fmtPct(1 - opsLeadPct, 0)}`)}
        </div>
        <div class="split-row">
          <div class="lbl">Клиенты сейчас: ${esc(leadName)} ↔ остальные ${others}</div>
          ${splitBar(clLeadPct, `${esc(leadName)} ${fmtPct(clLeadPct, 0)}`, `остальные ${others} — ${fmtPct(1 - clLeadPct, 0)}`)}
        </div>
        <div class="conc-cap"><b>${esc(leadName)} даёт ${fmtPct(opsLeadPct, 0)} операций, но лишь ${fmtPct(clLeadPct, 0)} клиентов</b> — клиенты ядра крупнее: ≈${fmtNum(opcLead)} операций на клиента против ${fmtNum(opcRest)} у остальных. Потеря ядра обрушит метрику направления.</div>
      </div>
      ${ibcShareBlock}`;
  }

  // Клиенты агентств — North Star Metric: линия активных клиентов по месяцам + методическая подпись.
  const nsmHost = document.querySelector("[data-ag-nsm]");
  if (nsmHost && nsm.now != null) {
    let clTrend = "";
    if (monCl && monCl.total && monCl.total.filter((x) => x != null).length > 1) {
      const ct = monCl.total, cmm = monCl.months, cvv = ct.filter((x) => x != null);
      const iMax = ct.indexOf(Math.max(...cvv)), iMin = ct.indexOf(Math.min(...cvv));
      const fmtPlain = (x) => RU_NUM.format(Math.round(x));
      clTrend = areaChart(cmm, ct, { fmtVal: fmtPlain, fmtAxis: fmtPlain, ref: false }) + `
        <div class="conc-cap">
          Активных клиентов помесячно (кто ездил в этом месяце): <b>${fmtNum(ct[ct.length - 1])}</b> в мае,
          пик ${fmtNum(ct[iMax])} (${monLabel(cmm[iMax])}), яма ${fmtNum(ct[iMin])} (${monLabel(cmm[iMin])}).
          Метрика NSM (${fmtNum(nsm.now)}) считается за 3 месяца, поэтому выше месячной.
        </div>`;
    }
    nsmHost.innerHTML = clTrend + `
      <div class="conc-cap">
        За полгода (дек.25–май'26) активны <b>${fmtNum(nsm.l6m)}</b> клиентов, в мае — <b>${fmtNum(nsm.activeMo)}</b>.
        Чистая дельта <b>+${fmtNum(nsm.net)}</b>: база выросла у <b>${clUp}</b> из ${ags.length} агентств, сократилась у ${clDown}.
        «Активный» = есть факт поездок (а не логин в Ракете); новые и ушедшие считаем на окнах по 3 месяца — мар–май'26 против сен–ноя'25.
      </div>`;
  }

  // Динамика операций по месяцам — главный area-график (ИТОГО, 13 мес.).
  const trendHost = document.querySelector("[data-ag-trend]");
  if (trendHost && mon && mon.total && mon.total.filter((x) => x != null).length > 1) {
    const tv = mon.total, mm = mon.months;
    const vv = tv.filter((x) => x != null);
    const iMax = tv.indexOf(Math.max(...vv)), iMin = tv.indexOf(Math.min(...vv));
    const yoy = tv[0] ? tv[tv.length - 1] / tv[0] - 1 : null;
    // 1 знак после запятой (общий fmtPct округляет до целых — здесь нужна точность).
    const yoyTxt = yoy == null ? "—" : (yoy > 0 ? "+" : "") + (yoy * 100).toFixed(1).replace(".", ",") + "%";
    trendHost.innerHTML = areaChart(mm, tv) + `
      <div class="conc-cap">
        Пик — ${monLabel(mm[iMax])} (${fmtK(tv[iMax])}), дно — ${monLabel(mm[iMin])} (${fmtK(tv[iMin])}).
        Год к году почти ровно: ${monLabel(mm[0])} ${fmtK(tv[0])} → ${monLabel(mm[mm.length - 1])} ${fmtK(tv[tv.length - 1])}
        (${yoyTxt}). Пунктир — уровень ${monLabel(mm[0])}: спад последнего месяца сезонный, не обвал.
      </div>`;
  }

  // Отображение сегментов партнёрской базы по-русски (данные остаются как в источнике).
  const SEG_RU = {
    "Strategist (ядро)": "Опорные (ядро)",
    "Growth leader": "Лидеры роста",
    "Stable": "Устойчивые",
    "Riser": "Растущие",
    "Riser (новичок)": "Растущие (новичок)",
    "Stagnating/Declining": "Замедляющиеся/Уходящие",
    "Declining": "Уходящие",
  };
  const segRu = (v) => SEG_RU[v] || v;

  if (tblHost) {
    const segs = [...new Set(ags.map((a) => a.segment).filter(Boolean))];
    const bands = [...new Set(ags.map((a) => a.band).filter(Boolean))];
    const state = { seg: "", band: "" };

    const rows = () => {
      const list = ags.filter((a) => (!state.seg || a.segment === state.seg) && (!state.band || a.band === state.band));
      if (!list.length) return `<tr><td colspan="11" class="muted" style="padding:20px">Ничего не найдено.</td></tr>`;
      return list.map((a) => `
        <tr>
          <td class="title">${esc(a.name)}</td>
          <td class="muted">${a.segment ? esc(segRu(a.segment)) : "—"}</td>
          <td class="muted">${esc(a.band ?? "—")}</td>
          <td class="num">${fmtNum(a.may)}</td>
          <td class="num">${fmtPct(a.sharePct)}</td>
          <td class="num">${pctCell(a.momPct)}</td>
          <td class="num">${pctCell(a.yoyPct)}</td>
          <td class="num">${fmtNum(a.l6m)}</td>
          <td class="spark-cell">${sparkline(mon && mon.byId ? mon.byId[a.id] : null)}</td>
          <td class="num">${fmtNum(a.clNow)}</td>
          <td class="num">${intDelta(a.clNet)}</td>
        </tr>`).join("");
    };
    const sel = (key, label, opts, labelFn) =>
      `<select class="ctl" data-ag="${key}" aria-label="${esc(label)}"><option value="">${esc(label)}: все</option>${opts.map((o) => `<option value="${esc(o)}">${esc(labelFn ? labelFn(o) : o)}</option>`).join("")}</select>`;

    tblHost.innerHTML = `
      <div class="toolbar">${sel("seg", "Сегмент", segs, segRu)}${sel("band", "Концентрация", bands)}</div>
      <div class="table-wrap">
        <table class="backlog">
          <thead><tr>
            <th>Агентство</th><th>Сегмент</th><th>Концентрация</th>
            <th>Операций, май</th><th>Доля операций</th>
            <th><abbr title="Операции мая'26 к апрелю'26">За месяц</abbr></th>
            <th><abbr title="Операции мая'26 к маю'25">За год</abbr></th>
            <th><abbr title="Среднее число операций в месяц за последние 6 месяцев">Ср. за 6 мес.</abbr></th>
            <th><abbr title="Операции по месяцам за 13 месяцев (май'25 – май'26)">Динамика</abbr></th>
            <th>Клиентов сейчас</th><th>Δ клиентов за полгода</th>
          </tr></thead>
          <tbody>${rows()}</tbody>
        </table>
      </div>`;
    tblHost.querySelectorAll("[data-ag]").forEach((s) => s.addEventListener("change", (e) => {
      state[e.target.dataset.ag] = e.target.value;
      tblHost.querySelector("tbody").innerHTML = rows();
    }));
  }
}

// ===================== Путь агентства в Ракете (lestnica.html) =====================
async function mountLadder() {
  const host = document.querySelector("[data-ladder]");
  if (!host) return;
  host.innerHTML = `<div class="loading">Загрузка…</div>`;
  let data;
  try { data = await loadJSON("data/ladder.json"); }
  catch (e) { host.innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }

  const focusStages = new Set(["1", "2"]);
  // Этап пути → концепция ценности (concepts.html). Концепции 1–2 — зонтики.
  const STAGE_CONCEPT = {
    "1": { anchor: "c0", label: "Концепция 0 · Не мешать" },
    "2": { anchor: "c1", label: "Концепции 1–2 · Постпродажное / Тормоза" },
    "3": { anchor: "c2", label: "Концепция 2 · Баланс" },
    "4": { anchor: "c3", label: "Концепция 3 · контур A" },
    "5": { anchor: "c3", label: "Концепция 3 · контур B" },
  };
  const hChip = (h) => `<a class="lad-h" href="backlog.html?q=${encodeURIComponent(h.code)}" title="${esc(h.text)}">${esc(h.code)}</a>`;
  const mChip = (m) => `<span class="lad-m">${gloss(esc(m))}</span>`;

  function block(b) {
    return `
      <div class="lad-block">
        <div class="lad-block__sub">Подцель: ${esc(b.subgoal)}</div>
        <div class="lad-block__label">${esc(b.label)}</div>
        <div class="lad-grp"><span class="lad-grp__h">Гипотезы</span>
          <ul class="lad-hyp">${b.hypotheses.map((h) => `<li>${hChip(h)} <span>${gloss(esc(h.text))}</span></li>`).join("")}</ul></div>
        <div class="lad-grp"><span class="lad-grp__h">Критерии успешности</span>
          <ul class="lad-crit">${b.criteria.map((c) => `<li>${gloss(esc(c))}</li>`).join("")}</ul></div>
        <div class="lad-metrics">
          ${b.metricsActive.length ? `<div><span class="lad-mh act">Активные</span> ${b.metricsActive.map(mChip).join(" ")}</div>` : ""}
          ${b.metricsTarget.length ? `<div><span class="lad-mh tgt">Целевые</span> ${b.metricsTarget.map(mChip).join(" ")}</div>` : ""}
        </div>
        ${b.note ? `<p class="lad-note">${gloss(esc(b.note))}</p>` : ""}
      </div>`;
  }

  function stage(s) {
    const focus = focusStages.has(s.n);
    const cn = STAGE_CONCEPT[s.n];
    const cnChip = cn
      ? `<a class="lad-concept" href="concepts.html#${cn.anchor}" title="Что строим на этом этапе">${esc(cn.label)} →</a>`
      : "";
    return `
      <details class="lad-stage${focus ? " is-focus" : ""}" data-stage="${esc(s.n)}"${focus ? " open" : ""}>
        <summary class="lad-sum">
          <span class="lad-n">${esc(s.n)}</span>
          <span class="lad-name">${esc(s.name)}</span>
          ${focus ? `<span class="lad-focus">фокус 2026</span>` : ""}
          <span class="lad-mean">${gloss(esc(s.meaning))}</span>
        </summary>
        <div class="lad-body">
          ${cnChip ? `<div class="lad-concept-row">${cnChip}</div>` : ""}
          ${s.blocks.map(block).join("")}
          <dl class="lad-foot">
            <div><dt>Что должна делать Ракета</dt><dd>${gloss(esc(s.doWhat))}</dd></div>
            <div><dt>Результат для агентства</dt><dd>${gloss(esc(s.result))}</dd></div>
            <div><dt>Цель этапа</dt><dd>${gloss(esc(s.goal))}</dd></div>
          </dl>
        </div>
      </details>`;
  }

  const subMap = (data.subgoalMap || []).map((s) =>
    `<div class="sg-row"><span class="sg-n">${esc(s.n)}</span><span class="sg-name">${esc(s.name)}</span><span class="sg-stage">этап ${esc(s.stage)}</span></div>`).join("");

  host.innerHTML = `
    <p class="lede" style="margin-bottom:8px">${esc(data.focus || "")}</p>
    <div class="lad-controls">
      <button type="button" class="btn" data-lad-expand>Раскрыть все</button>
      <button type="button" class="btn" data-lad-collapse>Свернуть все</button>
      <span class="result-meta">источник: ${esc(data.source)} v${esc(data.version)}</span>
    </div>
    <div class="lad-stages">${data.stages.map(stage).join("")}</div>

    <h2>7 подцелей → этап</h2>
    <div class="sg-map">${subMap}</div>

    <h2>Методологическая оговорка</h2>
    <div class="lad-caveat">
      <div class="lad-caveat__h">${esc(data.caveat.title)}</div>
      <p>${esc(data.caveat.text)}</p>
    </div>`;

  const all = () => host.querySelectorAll("details.lad-stage");
  host.querySelector("[data-lad-expand]").addEventListener("click", () => all().forEach((d) => (d.open = true)));
  host.querySelector("[data-lad-collapse]").addEventListener("click", () => all().forEach((d) => (d.open = false)));
}

// ===================== Исследования (research.html) =====================
function hypStatusClass(s) {
  const t = String(s || "").toLowerCase();
  if (t.startsWith("подтв") || t.startsWith("закрыто") || t.startsWith("✅")) return "ok";
  if (t.startsWith("конкур")) return "comp";
  if (t.startsWith("частично")) return "part";
  if (t.startsWith("гипотеза") || t.startsWith("идея") || t.startsWith("данные") || t.startsWith("спорн") || t.includes("не пров")) return "open";
  return "neu";
}

async function mountResearch() {
  const host = document.querySelector("[data-research]");
  if (!host) return;
  host.innerHTML = `<div class="loading">Загрузка исследований…</div>`;
  let data;
  try { data = await loadJSON("data/research.json"); }
  catch (e) { host.innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }

  const all = data.findings || [];
  const state = { groupBy: "theme", filters: {} };
  const FF = [["theme", "Тема"], ["role", "Роль"], ["stage", "Этап"], ["mechanism", "Механизм"], ["hCode", "Гипотеза"], ["hypStatus", "Статус гипотезы"]];

  const optsFor = (field) => {
    const c = new Map();
    all.forEach((x) => { const v = x[field] || "—"; c.set(v, (c.get(v) || 0) + 1); });
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  };

  function findingHTML(f) {
    const chips = [
      f.role ? `<span class="rf-chip">${esc(f.role)}</span>` : "",
      f.reachCount ? `<span class="rf-chip" title="подтв. агентств">👥 ${esc(f.reachCount)}</span>` : "",
      f.hCode ? `<span class="rf-chip rf-h">${esc(f.hCode)}</span>` : "",
      f.stage && f.stage !== "—" ? `<span class="rf-chip">этап ${esc(f.stage)}</span>` : "",
      f.hypStatus ? `<span class="rf-stat ${hypStatusClass(f.hypStatus)}">${esc(f.hypStatus)}</span>` : "",
    ].join("");
    const row = (l, v) => v && v !== "—" ? `<div class="rf-row"><dt>${esc(l)}</dt><dd>${esc(v)}</dd></div>` : "";
    return `
      <details class="rf">
        <summary class="rf-sum">
          <span class="rf-id">${esc(f.id || "")}</span>
          <span class="rf-text">${esc(f.finding || "—")}</span>
          <span class="rf-chips">${chips}</span>
        </summary>
        <div class="rf-body"><dl>
          ${row("Кол. данные", f.qty)}${row("JTBD", f.jtbd)}${row("Reach (агентства)", f.reach)}
          ${row("Механизм", f.mechanism)}${row("Статус", f.status)}${row("Источник", f.src)}
        </dl>
        ${f.hCode ? `<a class="rf-link" href="backlog.html?q=${encodeURIComponent(f.hCode)}">итерации по ${esc(f.hCode)} →</a>` : ""}
        </div>
      </details>`;
  }

  function render() {
    const list = all.filter((f) => FF.every(([field]) => {
      const v = state.filters[field];
      return !v || (f[field] || "—") === v;
    }));

    const map = new Map();
    list.forEach((f) => { const k = f[state.groupBy] || "—"; (map.get(k) || map.set(k, []).get(k)).push(f); });
    const groups = [...map.entries()].sort((a, b) => b[1].length - a[1].length);

    const groupsHTML = groups.map(([name, arr]) => `
      <details class="rg" open>
        <summary class="rg-sum"><span class="rg-name">${esc(name)}</span><span class="rg-count">${arr.length}</span></summary>
        <div class="rg-body">${arr.map(findingHTML).join("")}</div>
      </details>`).join("") || `<div class="muted" style="padding:20px">Ничего не найдено.</div>`;

    host.querySelector("[data-rg]").innerHTML = groupsHTML;
    host.querySelector("[data-rmeta]").textContent = `Показано ${list.length} из ${all.length}`;
  }

  const selects = FF.map(([field, label]) =>
    `<select class="ctl" data-rf="${field}" aria-label="${esc(label)}"><option value="">${esc(label)}: все</option>${optsFor(field).map(([v, c]) => `<option value="${esc(v)}">${esc(v)} (${c})</option>`).join("")}</select>`).join("");

  const confirmed = all.filter((f) => hypStatusClass(f.hypStatus) === "ok").length;
  const left = all.filter((f) => String(f.status || "").includes("Осталось")).length;

  host.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="v">${all.length}</div><div class="l">находок</div></div>
      <div class="stat"><div class="v">${confirmed}</div><div class="l">подтв./закрыто</div></div>
      <div class="stat"><div class="v">${new Set(all.map((x) => x.theme).filter(Boolean)).size}</div><div class="l">тем</div></div>
    </div>
    <div class="toolbar">
      <div class="seg" role="group" aria-label="Группировка">
        <button type="button" class="seg__btn is-active" data-grp="theme">по Теме</button>
        <button type="button" class="seg__btn" data-grp="role">по Роли</button>
      </div>
      ${selects}
      <button type="button" class="ctl ctl--reset" data-rreset>Сбросить</button>
    </div>
    <div class="result-meta" data-rmeta aria-live="polite"></div>
    <div data-rg></div>`;

  host.querySelectorAll("[data-rf]").forEach((s) => s.addEventListener("change", (e) => { state.filters[e.target.dataset.rf] = e.target.value; render(); }));
  host.querySelectorAll("[data-grp]").forEach((b) => b.addEventListener("click", () => {
    host.querySelectorAll("[data-grp]").forEach((x) => x.classList.toggle("is-active", x === b));
    state.groupBy = b.dataset.grp; render();
  }));
  host.querySelector("[data-rreset]").addEventListener("click", () => {
    state.filters = {}; host.querySelectorAll("[data-rf]").forEach((s) => (s.value = "")); render();
  });
  render();
}

// ===================== Метрики (metrics.html) =====================
async function mountMetrics() {
  const host = document.querySelector("[data-metrics]");
  if (!host) return;
  host.innerHTML = `<div class="loading">Загрузка метрик…</div>`;
  let data;
  try { data = await loadJSON("data/metrics.json"); }
  catch (e) { host.innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }

  const metrics = data.metrics || [];
  // Внутри типа держим осмысленный порядок по этапу пути.
  const stageOrder = { "1": 0, "2A": 1, "2B": 2, "3": 3, "4": 4, "5": 5 };
  const byStage = (a, b) => (stageOrder[a.stage] ?? 9) - (stageOrder[b.stage] ?? 9);
  const stageLabel = (s) => (s === "1" ? "этап 1" : `этап ${esc(s)}`);

  function card(m) {
    const dirGood = `хорошо ${esc(m.direction)}`;
    const lead = m.leading ? `<span class="m-lead">ведущая</span>` : "";
    const base = m.baseline
      ? `<div class="m-base"><span class="m-base__h">baseline 2026-05</span> ${esc(m.baseline)}</div>`
      : `<div class="m-base m-base--need">baseline нужен</div>`;
    const note = m.note ? `<div class="m-note">${esc(m.note)}</div>` : "";
    const mid = String(m.code).toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-|-$/g, "");
    return `
      <article id="m-${mid}" class="m-card ${m.type === "active" ? "is-act" : "is-tgt"}">
        <div class="m-card__top">
          <span class="m-dir ${m.direction === "↑" ? "up" : "down"}">${esc(m.direction)}</span>
          <span class="m-code">${esc(m.code)}</span>
          <span class="m-stage">${stageLabel(m.stage)}</span>${lead}
        </div>
        <div class="m-name">${esc(m.name)}</div>
        <p class="m-measures">${esc(m.measures)}</p>
        <div class="m-meta">
          <span title="${esc(dirGood)}">${dirGood}</span>
          <span>подцель ${esc(m.subgoal)}</span>
          <span>${esc(m.hypothesis)}</span>
        </div>
        ${base}${note}
        <a class="m-link" href="backlog.html?q=${encodeURIComponent(m.code)}">итерации с метрикой →</a>
      </article>`;
  }

  const active = metrics.filter((m) => m.type === "active").sort(byStage);
  const target = metrics.filter((m) => m.type === "target").sort(byStage);

  // Основное визуальное разделение — Целевые и Активные.
  const primary = `
    <section class="m-group m-group--primary m-group--tgt">
      <h2>Целевые <span class="m-h-cnt">${target.length}</span></h2>
      <p class="m-group__sub">Куда хотим прийти. Влияем косвенно — показывают, сдвигается ли цель направления.</p>
      <div class="m-grid">${target.map(card).join("")}</div>
    </section>
    <section class="m-group m-group--primary m-group--act">
      <h2>Активные <span class="m-h-cnt">${active.length}</span></h2>
      <p class="m-group__sub">На них влияем прямо и планируем считать в Q2. По каждой — одна ведущая метрика.</p>
      <div class="m-grid">${active.map(card).join("")}</div>
    </section>`;

  const leadHTML = Object.entries(data.leading || {}).map(([blk, arr]) =>
    `<div class="lead-row"><span class="lead-blk">${esc(blk)}</span> ${arr.map((x) => `<span class="lead-chip">${esc(x)}</span>`).join(" ")}</div>`).join("");

  // Остальное — для информации, без яркого выделения.
  const secondary = `
    <section class="m-group m-group--info">
      <h2>Ведущие метрики по блокам <span class="m-h-note">(зеркало Impact в скоринге)</span></h2>
      <div class="lead-wrap">${leadHTML}</div>
    </section>`;

  host.innerHTML = `
    <div class="m-intro">
      <div class="stats">
        <div class="stat"><div class="v">${target.length}</div><div class="l">целевых</div></div>
        <div class="stat"><div class="v">${active.length}</div><div class="l">активных</div></div>
      </div>
    </div>
    ${primary}
    ${secondary}`;

  // Доскролл к метрике, если пришли по ссылке вида metrics.html#m-<код> (карточки рендерятся асинхронно).
  if (location.hash) {
    const el = document.getElementById(location.hash.slice(1));
    if (el) { el.scrollIntoView({ block: "center" }); el.classList.add("is-target"); }
  }
}

// ===================== Легенды (legend.html) =====================
async function mountLegend() {
  const host = document.querySelector("[data-legend]");
  if (!host) return;
  host.innerHTML = `<div class="loading">Загрузка легенды…</div>`;
  let data;
  try { data = await loadJSON("data/legend.json"); }
  catch (e) { host.innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }

  const secs = data.sections || [];
  const toc = secs.map((s) => `<a class="leg-toc__item" href="#${s.id}">${esc(s.title)}</a>`).join("");
  const body = secs.map((s) => `
    <section class="leg-sect" id="${s.id}">
      <h2>${esc(s.title)}</h2>
      <dl class="leg-list">
        ${s.items.map((it) => `<div class="leg-row" id="${it.id}"><dt>${esc(it.term)}</dt><dd>${esc(it.def)}</dd></div>`).join("")}
      </dl>
    </section>`).join("");

  host.innerHTML = `
    <nav class="leg-toc" aria-label="Разделы легенды">${toc}</nav>
    <div class="leg-body">${body}</div>`;

  // JSON грузится асинхронно — браузер уже не доскроллит к входящему #якорю сам.
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash) {
    const el = document.getElementById(hash);
    if (el) el.scrollIntoView({ block: "start" });
  }
}

// ===================== Концепции ценности (concepts.html + матрица в vision) =====================
const Q2_BADGE = {
  focus:   ["q2-focus", "сейчас в фокусе"],
  partial: ["q2-part",  "частично сейчас"],
  out:     ["q2-out",   "позже"],
};
function q2Badge(kind) {
  const b = Q2_BADGE[kind] || Q2_BADGE.out;
  return `<span class="cn-q2 ${b[0]}">${b[1]}</span>`;
}
function conceptsOverviewHTML(concepts) {
  if (!concepts.length) return "";
  const items = concepts.map((c) => `
    <a class="cn-over__item" href="#c${esc(c.n)}">
      <span class="cn-over__n">${esc(c.n)}</span>
      <span class="cn-over__txt">${esc(c.short || c.title)}</span>
      ${q2Badge(c.q2)}
    </a>`).join("");
  return `
    <div class="cn-over">
      <div class="cn-over__h">Коротко — 4 концепции и что в фокусе сейчас</div>
      <div class="cn-over__grid">${items}</div>
    </div>`;
}
function conceptCardHTML(c) {
  const mechs = (c.mechanisms || []).map((m) => {
    const metrics = (m.metrics || []).length
      ? `<span class="cn-mech__metrics">${m.metrics.map((x) => `<span class="cn-m">${esc(x)}</span>`).join(" ")}</span>` : "";
    const link = m.backlogTheme
      ? `<a class="cn-mech__link" href="backlog.html?theme=${encodeURIComponent(m.backlogTheme)}">в Бэклоге →</a>` : "";
    return `
      <div class="cn-mech">
        <div class="cn-mech__h"><span class="cn-mech__name">${gloss(esc(m.name))}</span>${link}</div>
        <p class="cn-mech__desc">${gloss(esc(m.desc))}</p>
        ${metrics}
      </div>`;
  }).join("");
  return `
    <article class="cncard" id="c${esc(c.n)}">
      <div class="cncard__top">
        <span class="cncard__n">${esc(c.n)}</span>
        <h2 class="cncard__title">${esc(c.title)}</h2>
        ${q2Badge(c.q2)}
      </div>
      <dl class="cncard__meta">
        <div><dt>Этапы</dt><dd>${gloss(esc(c.stages))}</dd></div>
        <div><dt>Подцели</dt><dd>${esc(c.subgoals)}</dd></div>
        <div><dt>Чья работа</dt><dd>${esc(c.role)}</dd></div>
        <div><dt>Для кого в первую очередь</dt><dd>${esc(c.addressee)}</dd></div>
      </dl>
      <p class="cncard__idea"><b>Главная мысль.</b> ${gloss(esc(c.idea))}</p>
      ${c.q2Note ? `<p class="cncard__q2note">⚠ Что берём сейчас, что нет. ${gloss(esc(c.q2Note))}</p>` : ""}
      <div class="cn-mechs"><div class="cn-mechs__h">Из чего состоит</div>${mechs}</div>
      <p class="cncard__effect"><b>Что это даст.</b> ${gloss(esc(c.effect))}</p>
    </article>`;
}
function valueMatrixHTML(data) {
  const rows = (data.matrix || []).map((r) => {
    const mech = (r.mechanisms || []).map((m) => `<span class="vm-m">${esc(m)}</span>`).join(" ");
    const q2 = r.q2 ? `<span class="vm-q2 on">Q2</span>` : `<span class="vm-q2">—</span>`;
    return `
      <tr class="vm-row${r.q2 ? " is-q2" : ""}">
        <td class="vm-stage"><a href="lestnica.html"><span class="vm-sn" data-stage="${esc(r.stage)}">${esc(r.stage)}</span> ${esc(r.stageName)}</a></td>
        <td class="vm-sub">${esc(r.subgoals)}</td>
        <td class="vm-concept"><a href="concepts.html#c${esc(String(r.concept).replace(/[^0-9].*$/, "").trim() || r.concept)}"><b>${esc(r.concept)}</b> · ${esc(r.conceptName)}</a></td>
        <td class="vm-mech">${mech}</td>
        <td class="vm-role"><a href="tree.html"><span class="vm-dot ${esc(r.roleColor)}"></span>${esc(r.role)}</a></td>
        <td class="vm-foc">${q2}</td>
      </tr>`;
  }).join("");
  const lenses = (data.lenses || []).map((l) => `
    <a class="vm-lens" href="${esc(l.href)}">
      <span class="vm-lens__k">${esc(l.k)}</span>
      <span class="vm-lens__n">${esc(l.name)}</span>
      <span class="vm-lens__d">${esc(l.desc)}</span>
    </a>`).join("");
  const registry = (data.registry || []).map((r) => `
    <a class="vm-reg" href="${esc(r.href)}">
      <span class="vm-reg__n">${esc(r.name)}</span>
      <span class="vm-reg__d">${esc(r.desc)}</span>
    </a>`).join("");
  return `
    <div class="vm-block">
      <div class="vm-block__h">3 проекции — взгляды на одно направление</div>
      <div class="vm-lenses">${lenses}</div>
    </div>
    ${registry ? `<div class="vm-block">
      <div class="vm-block__h">+ реестр работ — где лежат конкретные задачи</div>
      <div class="vm-regs">${registry}</div>
    </div>` : ""}
    <div class="table-wrap">
      <table class="vmatrix">
        <thead><tr>
          <th>Этап (Путь агентства)</th><th>Подцель</th><th>Концепция</th>
          <th>Механизмы (что строим)</th><th>Чья работа (Дерево)</th><th>Фокус</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="vm-note">Концепции 1 и 2 — зонтики: они покрывают несколько этапов, поэтому
    встречаются в разных строках. Подробно каждая концепция — в
    <a href="concepts.html">Концепциях</a>.</p>`;
}
async function mountConcepts() {
  const cardsHost = document.querySelector("[data-concepts]");
  const matrixHost = document.querySelector("[data-value-matrix]");
  if (!cardsHost && !matrixHost) return;
  let data;
  try { data = await loadJSON("data/concepts.json"); }
  catch (e) {
    const msg = `<div class="error">${esc(e.message)}</div>`;
    if (cardsHost) cardsHost.innerHTML = msg;
    if (matrixHost) matrixHost.innerHTML = msg;
    return;
  }
  if (matrixHost) matrixHost.innerHTML = valueMatrixHTML(data);
  if (cardsHost) {
    cardsHost.innerHTML = `
      <p class="cn-intro">${esc(data.intro || "")}</p>
      ${conceptsOverviewHTML(data.concepts || [])}
      <div class="cncards">${(data.concepts || []).map(conceptCardHTML).join("")}</div>
      <p class="result-meta" style="margin-top:18px">источник: ${esc(data.source)} v${esc(data.version)}</p>`;
    if (location.hash) {
      const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (el) { el.scrollIntoView({ block: "start" }); el.classList.add("is-target"); }
    }
  }
}

// ===================== Единая шапка проекции (projbar на 4 страницах) =====================
// 3 проекции одного направления + 1 реестр. Снимает «почему здесь 4 одинаковых дерева».
const PROJ = {
  lestnica: { kicker: "Проекция · Зачем и когда", name: "Путь агентства в Ракете",
    q: "в каком порядке создаём ценность", read: "5 этапов; фокус 2026 — этапы 1–2" },
  concepts: { kicker: "Проекция · Что строим", name: "Концепции ценности",
    q: "что именно строим для агентств и в каком порядке", read: "4 концепции; бейдж справа — над чем работаем сейчас" },
  tree: { kicker: "Проекция · Чья работа", name: "Дерево работ (JTBD)",
    q: "чью работу и на каком уровне абстракции закрываем", read: "Big → Medium → Small по ролям" },
  levels: { kicker: "Реестр работ", name: "Каталог задач",
    q: "где лежат конкретные задачи бэклога", read: "3 ветки → 7 тем → подтемы → итерации" },
};
const PROJ_SIBS = [
  { key: "lestnica", href: "lestnica.html", label: "Путь" },
  { key: "concepts", href: "concepts.html", label: "Концепции" },
  { key: "tree",     href: "tree.html",     label: "Дерево (JTBD)" },
  { key: "levels",   href: "levels.html",   label: "Каталог задач" },
];
function mountProjbar() {
  const host = document.querySelector("[data-projbar]");
  if (!host) return;
  const key = host.getAttribute("data-projbar");
  const p = PROJ[key];
  if (!p) return;
  const isReg = key === "levels";
  const sibs = PROJ_SIBS.filter((s) => s.key !== key)
    .map((s) => `<a class="projbar__sib" href="${s.href}">${esc(s.label)}</a>`).join("");
  host.innerHTML = `
    <div class="projbar${isReg ? " projbar--reg" : ""}">
      <div class="projbar__top">
        <span class="projbar__kicker">${esc(p.kicker)}</span>
        <span class="projbar__name">${esc(p.name)}</span>
      </div>
      <div class="projbar__meta">
        <span class="projbar__q"><b>Отвечает:</b> ${esc(p.q)}</span>
        <span class="projbar__read"><b>Как читать:</b> ${esc(p.read)}</span>
      </div>
      <div class="projbar__sibs">
        <span class="projbar__sibh">${isReg ? "Стратегические проекции:" : "Другие проекции:"}</span>
        ${sibs}
        <a class="projbar__sib projbar__sib--map" href="vision.html#karta">Карта связей →</a>
        <a class="projbar__sib projbar__sib--gloss" href="legend.html" title="Расшифровка терминов, кодов и метрик">Сокращения ⓘ</a>
      </div>
    </div>`;
}

// ===================== Executive Summary (главная для C-level) =====================
const BET_STATUS = {
  "in-progress": ["status--prog", "В работе"],
  "on-track":    ["status--ok",   "В графике"],
  "at-risk":     ["status--risk", "На риске"],
  "blocked":     ["status--risk", "Блокер"],
  "not-started": ["status--idle", "Не начата"],
};
function betStatus(s) {
  const b = BET_STATUS[s] || BET_STATUS["in-progress"];
  return `<span class="status-dot ${b[0]}"></span><span class="status-lbl">${b[1]}</span>`;
}
async function mountExec() {
  const host = document.querySelector("[data-exec]");
  if (!host) return;
  let d;
  try { d = await loadJSON("data/exec.json"); }
  catch (e) { host.innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }

  const pct = Math.min(100, Math.round((d.progress.done / d.progress.goal) * 100));
  const remaining = d.progress.goal - d.progress.done;

  // Цифры клиентской базы — живьём из agencies.json (не дублируем в exec.json).
  let factsBlock = "";
  try {
    const ag = await loadJSON("data/agencies.json");
    const ags = ag.agencies || [];
    const clients = (ag.nsm && ag.nsm.now) || null;
    const lead = ags.reduce((m, a) => ((a.may || 0) > (m.may || 0) ? a : m), ags[0] || {});
    const totalMay = ags.reduce((s, a) => s + (a.may || 0), 0);
    const leadPct = totalMay ? Math.round((lead.may || 0) / totalMay * 100) : null;
    const facts = [];
    if (clients != null) facts.push(`<a class="ex-fact" href="agencies.html"><b>${fmtInt(clients)}</b><span>активных клиентов · NSM</span></a>`);
    if (leadPct != null) facts.push(`<a class="ex-fact" href="agencies.html#nsm"><b>IBC ${leadPct}% <span class="ex-fact__vs">/ остальные ${100 - leadPct}%</span></b><span>доля операций · ${ags.length} агентств</span></a>`);
    if (facts.length) factsBlock = `<div class="ex-facts">${facts.join("")}</div>`;
  } catch (e) { /* agencies.json необязателен — без строки фактов */ }

  const bc = (d.businessCase || []).map((x, i, a) => `
    <span class="bc-step">
      <span class="bc-k">${esc(x.k)}</span>
      <span class="bc-t">${gloss(esc(x.t))}</span>
    </span>${i < a.length - 1 ? `<span class="bc-arr" aria-hidden="true">→</span>` : ""}`).join("");

  const bets = (d.bets || []).map((b) => `
    <article class="bet">
      <div class="bet__top">
        <span class="bet__n">Ставка ${esc(b.n)}</span>
        ${stageTag(b.stage, `этап ${b.stage}`)}
        <span class="bet__name">${esc(b.name)} · ${esc(b.stageName)}</span>
      </div>
      <div class="bet__status">${betStatus(b.status)}</div>
      <p class="bet__what">${gloss(esc(b.what))}</p>
      <div class="bet__metric"><span class="bet__mh">Ключевые метрики</span> ${gloss(esc(b.metric))}</div>
    </article>`).join("");

  const RISK_BADGE = { high: ["risk--high", "критический"], medium: ["risk--med", "средний"], low: ["risk--low", "невысокий"] };
  const risks = (d.risks || []).map((r) => {
    const rb = RISK_BADGE[r.level] || RISK_BADGE.medium;
    return `
      <a class="risk-card ${rb[0]}" href="${esc(r.href)}">
        <div class="risk-card__top">
          <span class="risk-card__lvl">${rb[1]}</span>
          <span class="risk-card__val">${esc(r.value)}</span>
        </div>
        <div class="risk-card__val-lbl">${esc(r.valueLabel)}</div>
        <h3 class="risk-card__title">${esc(r.title)}</h3>
        <p class="risk-card__what">${gloss(esc(r.what))}</p>
        <span class="risk-card__link">${esc(r.linkLabel)} →</span>
      </a>`;
  }).join("");

  const askBlock = d.ask ? `
    <div class="ex-ask${d.ask.placeholder ? " is-placeholder" : ""}">
      <div class="ex-ask__h">📌 ${esc(d.ask.title)}</div>
      <p>${esc(d.ask.text)}</p>
    </div>` : "";

  host.innerHTML = `
    <div class="ex-card">
      <div class="ex-progress" role="img" aria-label="Прогресс к цели">
        <div class="ex-progress__head">
          <span class="ex-progress__lbl">${esc(d.progress.krLabel)} · ${esc(d.progress.label)}</span>
          <span class="ex-progress__num"><b>${d.progress.done}</b> / ${d.progress.goal} <span class="ex-progress__pct">${pct}%</span></span>
        </div>
        <div class="ex-progress__bar"><div class="ex-progress__fill" style="width:${pct}%"></div></div>
        <div class="ex-progress__sub">осталось привлечь: ${remaining} · период: ${esc(d.progress.period)}</div>
        ${factsBlock}
      </div>

      <div class="ex-section">
        <div class="ex-section__h">Бизнес-кейс одной цепочкой</div>
        <div class="bc">${bc}</div>
      </div>

      <div class="ex-section">
        <div class="ex-section__h">Две ставки направления — где мы сейчас</div>
        <div class="bets">${bets}</div>
      </div>

      <div class="ex-section">
        <div class="ex-section__h">Стратегические риски</div>
        <div class="risks">${risks}</div>
      </div>

      ${askBlock}
    </div>`;
}

// Дашборды главной (Проекции / Работа / Данные) из data/home.json
function fmtInt(n) { return typeof n === "number" ? n.toLocaleString("ru-RU").replace(/,/g, " ") : "—"; }
function fmtPct(x) { return typeof x === "number" ? Math.round(x * 100) + "%" : "—"; }
function fmtSigned(x) {
  if (typeof x !== "number") return "—";
  const v = Math.round(x * 1000) / 10;
  return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) + "%";
}
function dstat(n, label, accent) {
  return `<div class="dstat"><div class="dstat__n${accent ? " dstat__n--" + accent : ""}">${n}</div><div class="dstat__l">${label}</div></div>`;
}
function dlinks(items) {
  return `<div class="dash__links">${items.map((i) => `<a href="${i.href}">${esc(i.label)} →</a>`).join("")}</div>`;
}

async function mountDashboards() {
  if (!document.querySelector("[data-dash]")) return;
  let d;
  try { d = await loadJSON("data/home.json"); }
  catch (e) {
    document.querySelectorAll("[data-dash]").forEach((h) => h.innerHTML = `<div class="error">${esc(e.message)}</div>`);
    return;
  }
  const P = d.projections || {}, W = d.work || {}, D = d.data || {};

  // --- Проекции ---
  const proj = document.querySelector('[data-dash="proj"]');
  if (proj) {
    proj.innerHTML = `
      <div class="dash dash--proj">
        <p class="dash__lead">Одно направление с трёх сторон плюс портал-обзор. Каждая проекция отвечает на свой вопрос.</p>
        <div class="dash__stats">
          ${dstat("+" + (P.goal ?? "—"), "цель: новых агентств", "emerald")}
          ${dstat(P.stages ?? "—", "этапов · фокус " + esc(P.stagesFocus || ""), "emerald")}
          ${dstat(P.concepts ?? "—", "концепции ценности", "emerald")}
          ${dstat(P.treeRoles ?? "—", "роли в дереве (JTBD)", "emerald")}
        </div>
        <div class="dash__note">
          Концепции: <span class="dot-leg dot-leg--focus">${P.conceptsFocus ?? 0} в фокусе Q2</span> ·
          <span class="dot-leg dot-leg--part">${P.conceptsPartial ?? 0} частично</span> ·
          <span class="dot-leg dot-leg--out">${P.conceptsOut ?? 0} вне</span>.
          Две ставки: ${(P.betsNames || []).map(esc).join(" · ")}.
        </div>
        ${dlinks([
          { href: "vision.html", label: "Видение" },
          { href: "lestnica.html", label: "Путь" },
          { href: "concepts.html", label: "Концепции" },
          { href: "tree.html", label: "Дерево" },
        ])}
      </div>`;
  }

  // --- Работа ---
  const work = document.querySelector('[data-dash="work"]');
  if (work) {
    const m = W.moscow || {};
    const order = [["Must", "must"], ["Should", "should"], ["Could", "could"], ["Won't", "wont"]];
    const total = W.total || order.reduce((s, [k]) => s + (m[k] || 0), 0);
    const bar = order.map(([k, cls]) => {
      const v = m[k] || 0; const w = total ? (v / total * 100) : 0;
      return `<span class="mbar__seg mbar__seg--${cls}" style="width:${w}%" title="${k}: ${v}"></span>`;
    }).join("");
    const legend = order.map(([k, cls]) => `<span class="mleg"><span class="mleg__sw mbar__seg--${cls}"></span>${k} ${m[k] || 0}</span>`).join("");
    work.innerHTML = `
      <div class="dash dash--work">
        <p class="dash__lead">Где лежат конкретные задачи: плоский список со скорингом, оглавление по темам и отобранные must.</p>
        <div class="dash__stats">
          ${dstat(fmtInt(W.total), "итераций всего", "gold")}
          ${dstat(fmtInt(W.scored), "со скорингом", "gold")}
          ${dstat(fmtInt(W.unscored), "без Effort", "muted")}
          ${dstat(W.themes ? W.themes.length : "—", "тем в каталоге", "gold")}
        </div>
        <div class="mbar" role="img" aria-label="Распределение по MoSCoW">${bar}</div>
        <div class="mleg-row">${legend}</div>
        ${W.topTitle ? `<div class="dash__note">ТОП по приоритету (Final ${W.topFinal}): <b>${esc(W.topTitle)}</b></div>` : ""}
        ${dlinks([
          { href: "backlog.html", label: "Бэклог" },
          { href: "levels.html", label: "Каталог" },
          { href: "must.html", label: "Must" },
        ])}
      </div>`;
  }

  // --- Данные ---
  const data = document.querySelector('[data-dash="data"]');
  if (data) {
    const top3 = typeof D.top3 === "number" ? D.top3 * 100 : 0;
    const top5extra = typeof D.top5 === "number" ? Math.max(0, D.top5 * 100 - top3) : 0;
    data.innerHTML = `
      <div class="dash dash--data">
        <p class="dash__lead">Фактура под направлением: цифры по агентствам, исследования, метрики и рынок.</p>
        <div class="dash__stats">
          ${dstat(fmtInt(D.agenciesActive), "активных агентств", "copper")}
          ${dstat(fmtInt(D.opsMay) + ` <span class="dstat__d ${D.momPct < 0 ? "is-down" : "is-up"}">${fmtSigned(D.momPct)}</span>`, "операций в мае · м/м", "copper")}
          ${dstat(fmtInt(D.researchTotal), `находок · подтв. ${D.researchConfirmed ?? "—"}`, "copper")}
          ${dstat((D.metricsActive ?? "—") + " + " + (D.metricsTarget ?? "—"), "метрик: активных + целевых", "copper")}
        </div>
        <div class="cbar-wrap">
          <div class="cbar" role="img" aria-label="Концентрация по операциям">
            <span class="cbar__top3" style="width:${top3}%"></span>
            <span class="cbar__top5" style="width:${top5extra}%"></span>
          </div>
          <div class="dash__note">Концентрация: ТОП-3 = <b>${fmtPct(D.top3)}</b> · ТОП-5 = <b>${fmtPct(D.top5)}</b> операций. База хрупкая.</div>
        </div>
        ${dlinks([
          { href: "research.html", label: "Исследования" },
          { href: "agencies.html", label: "Агентства" },
          { href: "rynok.html", label: "Рынок" },
          { href: "metrics.html", label: "Метрики" },
        ])}
      </div>`;
  }
}

// Путеводитель по сайту (vision.html) — из data/guide.json. Назначение каждой
// страницы + «как читать» + маршруты чтения. Числа НЕ хардкодим — только смысл.
const GUIDE_SRC = {
  auto: { label: "авто", title: "числа собираются из рабочих таблиц автоматически" },
  hand: { label: "вручную", title: "автор ведёт вручную" },
  edit: { label: "текст", title: "редакторский текст прямо в странице" },
};
async function mountGuide() {
  const gHost = document.querySelector("[data-guide]");
  const rHost = document.querySelector("[data-guide-routes]");
  if (!gHost && !rHost) return;
  let d;
  try { d = await loadJSON("data/guide.json"); }
  catch (e) {
    [gHost, rHost].forEach((h) => { if (h) h.innerHTML = `<div class="error">${esc(e.message)}</div>`; });
    return;
  }

  if (gHost) {
    gHost.innerHTML = `<div class="guide">${(d.groups || []).map((g) => {
      const rows = (g.pages || []).map((p) => {
        if (p.srcKind === "self") {
          return `<div class="guide__row guide__row--here">
            <div class="guide__rtop"><span class="guide__name">${esc(p.name)}</span><span class="guide__here">вы здесь</span></div>
            <div class="guide__read">${esc(p.read)}</div>
          </div>`;
        }
        const s = GUIDE_SRC[p.srcKind];
        const tag = s ? `<span class="guide__src guide__src--${esc(p.srcKind)}" title="${esc(s.title)}">${esc(s.label)}</span>` : "";
        return `<a class="guide__row" href="${esc(p.href)}">
          <div class="guide__rtop"><span class="guide__name">${esc(p.name)}</span>${tag}</div>
          <div class="guide__q"><b>Отвечает:</b> ${esc(p.q)}</div>
          <div class="guide__read">${esc(p.read)}</div>
        </a>`;
      }).join("");
      return `<section class="guide__grp">
        <div class="guide__ghead">
          <span class="guide__glabel">${esc(g.label)}</span>
          <span class="guide__gtag">${esc(g.tagline)}</span>
        </div>
        <div class="guide__rows">${rows}</div>
      </section>`;
    }).join("")}</div>`;
  }

  if (rHost) {
    rHost.innerHTML = `<div class="routes">${(d.routes || []).map((r) => {
      const steps = (r.steps || []).map((s, i) =>
        `<a class="route__step" href="${esc(s.href)}"><span class="route__n">${i + 1}</span>${esc(s.label)}</a>`
      ).join('<span class="route__arr">→</span>');
      return `<div class="route">
        <div class="route__goal">${esc(r.goal)}</div>
        ${r.note ? `<div class="route__note">${esc(r.note)}</div>` : ""}
        <div class="route__steps">${steps}</div>
      </div>`;
    }).join("")}</div>`;
  }
}

// «Сейчас в работе» — отдельный блок под саммари (данные из exec.json → now)
async function mountNow() {
  const host = document.querySelector("[data-now]");
  if (!host) return;
  let d;
  try { d = await loadJSON("data/exec.json"); }
  catch (e) { host.innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }
  const n = d.now;
  if (!n) return;
  host.innerHTML = `
    <a class="now-card" href="${esc(n.href)}">
      <div class="now-card__head">
        <span class="now-card__live"><span class="now-card__dot"></span>Сейчас в работе</span>
        <span class="now-card__k">${esc(n.kicker)}</span>
      </div>
      <h3 class="now-card__title">${esc(n.title)}</h3>
      <p class="now-card__what">${gloss(esc(n.what))}</p>
      <div class="now-card__foot">
        ${(n.stats || []).map((s) => `<span class="badge${s.badge ? " badge--" + esc(s.badge) : ""}">${esc(s.label)}</span>`).join("")}
        <span class="now-card__link">${esc(n.linkLabel || "Открыть")} →</span>
      </div>
    </a>`;
}

// JTBD-дерево (tree.html) — глоссарий по узлам/листьям
function mountJtbd() {
  if (!document.querySelector(".tree-cols")) return;
  glossifyDOM(document.getElementById("main"));
}

document.addEventListener("DOMContentLoaded", () => {
  mountHeader();
  mountFooter();
  mountBacklog();
  mountMust();
  mountLevels();
  mountJtbd();
  mountLegend();
  mountAgencies();
  mountMetrics();
  mountResearch();
  mountLadder();
  mountConcepts();
  mountProjbar();
  mountExec();
  mountNow();
  mountDashboards();
  mountGuide();
});
