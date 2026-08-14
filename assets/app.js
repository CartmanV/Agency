/* Сайт направления «Агентства» — общий JS (итерации 0–1).
   Хедер + бэклог как инструмент: фильтры, сортировка, поиск, бейджи; срез Must. */

// Единый источник навигации. Поле group = дропдаун-меню, к которому относится
// страница (см. NAV_MENUS — оно ВЫВОДИТСЯ отсюда, отдельного списка пунктов больше нет).
// Порядок внутри «Обзора» = маршрут чтения: что за направление → видение → стратегия →
// диагностика → выводы → план → текущее состояние → планы дальше.
const NAV = [
  // Обзор — стратегия и статус
  { href: "index.html",    label: "Направление", group: "Обзор" },
  { href: "karta.html",    label: "Карта решений", short: "Карта", group: "Обзор" },
  { href: "vision.html",   label: "Видение", group: "Обзор" },
  { href: "strategy.html", label: "Стратегия (v5)", short: "Стратегия", group: "Обзор" },
  { href: "nmt.html",      label: "Диагностика (NMT)", short: "Диагностика", group: "Обзор" },
  { href: "masshtab.html", label: "Свод по масштабу", short: "Свод", group: "Обзор" },
  { href: "plan-1-2.html", label: "Общий план 1+2", short: "План 1+2", group: "Обзор" },
  { href: "now.html",      label: "Сейчас в работе", group: "Обзор" },
  { href: "q3.html",       label: "Планы Q3", group: "Обзор" },
  // Работа — проекции стратегии + реестры задач
  { href: "etapy.html",    label: "Этапы ценности", group: "Работа" },
  { href: "tree.html",     label: "Дерево (JTBD)", group: "Работа" },
  { href: "levels.html",   label: "Каталог задач", group: "Работа" },
  { href: "backlog.html",  label: "Бэклог", group: "Работа" },
  { href: "initiatives.html", label: "Инициативы", group: "Работа" },
  { href: "ai.html",       label: "AI-проекты", group: "Работа" },
  { href: "metod.html",    label: "Метод оценки задач", short: "Метод оценки", group: "Работа" },
  // Данные — доказательная база + справка
  { href: "research.html", label: "Исследования", group: "Данные" },
  { href: "sootvetstvie.html", label: "Доказательная база", short: "Доказательства", group: "Данные" },
  { href: "planned.html", label: "План исследований", short: "План ресёрча", group: "Данные" },
  { href: "agencies.html", label: "Агентства", group: "Данные" },
  { href: "support.html",  label: "Экономика поддержки", short: "Поддержка", group: "Данные" },
  { href: "rynok.html",    label: "Рынок", group: "Данные" },
  { href: "metrics.html",  label: "Метрики", group: "Данные" },
  { href: "legend.html",   label: "Легенды", group: "Данные" },
  // voprosy.html выведена из навигации 2026-07-03 как неактуальная (файл оставлен, но не линкуется).
];

// Актуальность данных берётся из data/manifest.json, который пишет сборка.
// Раньше здесь была ручная константа SITE_UPDATED: одна дата на весь сайт,
// проставленная руками. Она устаревала незаметно и подписывала июньскими
// данными июльские страницы — второй, ложный источник правды.
// Теперь футер показывает дату САМЫХ СТАРЫХ данных, которые взяла страница.
let MANIFEST = null;
const USED_DATA = new Set();   // какие data/*.json загрузила текущая страница

function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return String(iso || "").slice(0, 10);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function daysSince(iso) {
  const d = new Date(iso);
  return isNaN(d) ? null : Math.floor((Date.now() - d.getTime()) / 86400000);
}

async function ensureManifest() {
  if (MANIFEST !== null) return MANIFEST;
  try { MANIFEST = await (await fetch("data/manifest.json")).json(); }
  catch (e) { MANIFEST = false; }   // манифеста нет — футер остаётся нейтральным
  return MANIFEST;
}

/** Строка о свежести данных страницы: дата старейшего файла + пометка, если
 *  он старше порога. Порог живёт в манифесте (staleAfterDays), а не здесь. */
function freshnessHtml(manifest) {
  if (!manifest || !manifest.files) return "";
  const used = [...USED_DATA]
    .map((name) => [name, manifest.files[name]])
    .filter(([, f]) => f && f.date);
  // Страница без выгружаемых данных (стратегия, рынок, метод) — показываем
  // дату сборки сайта: пустое место в футере читалось бы как «нет данных».
  if (!used.length) {
    return manifest.builtAt ? `сайт собран ${fmtDate(manifest.builtAt)}` : "";
  }

  used.sort((a, b) => new Date(a[1].date) - new Date(b[1].date));
  const [oldestName, oldest] = used[0];
  const age = daysSince(oldest.date);
  const limit = manifest.staleAfterDays || 30;

  const breakdown = used
    .map(([n, f]) => `${n} — ${fmtDate(f.date)} (${f.kind === "authored" ? "вручную" : "сборка"}: ${f.source})`)
    .join("\n");

  const stale = age !== null && age > limit;
  const label = used.length > 1
    ? `данные не новее ${fmtDate(oldest.date)}`
    : `данные от ${fmtDate(oldest.date)}`;
  const warn = stale
    ? ` <span class="freshness__stale" title="Старше ${limit} дней: ${oldestName}">· устарело (${age} дн.)</span>`
    : "";

  return `<span class="freshness" title="${esc(breakdown)}">${label}</span>${warn}`;
}

/** Футер перерисовывается после загрузки данных: mountFooter() отрабатывает
 *  на DOMContentLoaded, а json страница тянет асинхронно и позже. */
async function refreshFreshness() {
  const host = document.querySelector("[data-freshness]");
  if (!host) return;
  const manifest = await ensureManifest();
  host.innerHTML = freshnessHtml(manifest);
}

function currentPage() {
  return location.pathname.split("/").pop() || "index.html";
}

function mountFooter() {
  const host = document.querySelector("[data-footer]");
  if (!host) return;
  host.innerHTML = `
    <footer class="site-footer">
      Направление «Агентства» · внутренние данные направления · <span data-freshness></span>
    </footer>`;
  refreshFreshness();
}

// Навигация v4 (Design Guide · 06): 3 группы-дропдауна в один ряд вместо 14 пунктов в рядах.
// Меню выводится из NAV по полю group — единого списка страниц. Порядок групп фиксирован;
// порядок пунктов внутри группы = порядок в NAV. Так ни одна страница не «теряется» из меню.
const NAV_GROUP_ORDER = ["Обзор", "Работа", "Данные"];
const NAV_MENUS = NAV_GROUP_ORDER.map((label) => ({
  label,
  items: NAV.filter((n) => n.group === label).map((n) => n.href),
}));

function mountHeader() {
  const host = document.querySelector("[data-header]");
  if (!host) return;
  const cur = currentPage();
  const byHref = Object.fromEntries(NAV.map((n) => [n.href, n]));

  const menus = NAV_MENUS.map((m, mi) => {
    const items = m.items.map((href) => byHref[href]).filter(Boolean);
    const hasActive = items.some((n) => n.href === cur);
    const links = items.map((n) => {
      if (n.disabled) {
        return `<span class="navm__item navm__item--soon" aria-disabled="true"
                  title="будет в следующих итерациях">${esc(n.label)}</span>`;
      }
      const active = n.href === cur ? " is-active" : "";
      return `<a class="navm__item${active}" href="${n.href}">${esc(n.label)}</a>`;
    }).join("");
    return `<div class="navm" data-navm>
        <button class="navm__btn${hasActive ? " is-active" : ""}" type="button"
                aria-expanded="false" aria-controls="navm-pop-${mi}" data-navm-btn id="navm-btn-${mi}">
          ${esc(m.label)}<span class="navm__caret" aria-hidden="true">▾</span>
        </button>
        <div class="navm__pop" id="navm-pop-${mi}" aria-labelledby="navm-btn-${mi}" data-navm-pop hidden>${links}</div>
      </div>`;
  }).join("");

  host.innerHTML = `
    <header class="site-header">
      <div class="site-header__inner">
        <a class="brand" href="index.html">Направление <b>«Агентства»</b></a>
        <nav class="nav" aria-label="Основная навигация">${menus}</nav>
        <div class="gsearch" data-gsearch>
          <input type="search" class="gsearch__input ctl" data-gsearch-input autocomplete="off"
                 spellcheck="false" aria-label="Поиск по сайту"
                 role="combobox" aria-expanded="false" aria-controls="gsearch-results"
                 aria-haspopup="listbox" aria-autocomplete="list"
                 placeholder="Поиск…  (/ или ⌘K)" />
          <div class="gsearch__results" id="gsearch-results" data-gsearch-results
               role="listbox" aria-label="Результаты поиска" hidden></div>
        </div>
      </div>
    </header>`;
  mountNavDropdowns();
  mountGlobalSearch();
}

// Контроллер дропдаунов навигации (disclosure-паттерн, 2026-07-03).
// Клик/Enter — открыть/закрыть; ↓/↑ на кнопке — открыть и увести фокус в список;
// в списке ↓/↑/Home/End двигают фокус, Escape закрывает и ВОЗВРАЩАЕТ фокус на кнопку,
// Tab уходит из меню штатно; клик вне — закрывает всё.
function mountNavDropdowns() {
  const menus = [...document.querySelectorAll("[data-navm]")];
  if (!menus.length) return;
  const itemsOf = (m) => [...m.querySelectorAll("[data-navm-pop] a")];
  const setOpen = (m, open) => {
    m.querySelector("[data-navm-btn]").setAttribute("aria-expanded", String(open));
    m.querySelector("[data-navm-pop]").hidden = !open;
  };
  const closeAll = (except) => menus.forEach((m) => { if (m !== except) setOpen(m, false); });
  const close = (m, focusBtn) => {
    setOpen(m, false);
    if (focusBtn) m.querySelector("[data-navm-btn]").focus();
  };
  const openMenu = () => menus.find((m) =>
    m.querySelector("[data-navm-btn]").getAttribute("aria-expanded") === "true");

  menus.forEach((m) => {
    const btn = m.querySelector("[data-navm-btn]");
    const pop = m.querySelector("[data-navm-pop]");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = btn.getAttribute("aria-expanded") === "true";
      closeAll(m);
      setOpen(m, !open);
    });
    btn.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        closeAll(m); setOpen(m, true);
        const it = itemsOf(m);
        (e.key === "ArrowDown" ? it[0] : it[it.length - 1])?.focus();
      }
    });
    pop.addEventListener("keydown", (e) => {
      const it = itemsOf(m);
      const i = it.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); (it[i + 1] || it[0])?.focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); (it[i - 1] || it[it.length - 1])?.focus(); }
      else if (e.key === "Home") { e.preventDefault(); it[0]?.focus(); }
      else if (e.key === "End") { e.preventDefault(); it[it.length - 1]?.focus(); }
      else if (e.key === "Escape") { e.preventDefault(); close(m, true); }
      else if (e.key === "Tab") { setOpen(m, false); }
    });
  });
  document.addEventListener("click", (e) => {
    if (!menus.some((m) => m.contains(e.target))) closeAll();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { const m = openMenu(); if (m) close(m, true); }
  });
}

// Глобальный поиск по сайту (ТЗ 08): один индекс data/search.json по находкам/метрикам/
// легендам/темам. Индекс грузится лениво при первом фокусе. Клавиши: / и ⌘/Ctrl-K — фокус.
function mountGlobalSearch() {
  const box = document.querySelector("[data-gsearch]");
  if (!box) return;
  const input = box.querySelector("[data-gsearch-input]");
  const results = box.querySelector("[data-gsearch-results]");
  let index = null, loaded = false, active = -1;

  async function ensureIndex() {
    if (loaded) return;
    loaded = true;
    try { const d = await loadJSON("data/search.json"); index = d.index || []; }
    catch (e) { index = []; }
  }
  const collapse = () => {
    results.hidden = true; input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant"); active = -1;
  };
  function render(q) {
    const query = q.trim().toLowerCase();
    if (!query) { results.innerHTML = ""; collapse(); return; }
    const hits = (index || []).filter((r) =>
      (`${r.title} ${r.snippet} ${r.kind}`).toLowerCase().includes(query)).slice(0, 30);
    active = -1;
    input.removeAttribute("aria-activedescendant");
    results.innerHTML = hits.length
      ? hits.map((r, i) =>
          `<a class="gsearch__item" role="option" id="gsearch-opt-${i}" aria-selected="false"
              data-i="${i}" href="${esc(r.href)}">
             <span class="gsearch__row"><span class="gsearch__kind">${esc(r.kind)}</span>
             <span class="gsearch__t">${esc(r.title)}</span></span>
             ${r.snippet ? `<span class="gsearch__s">${esc(r.snippet)}</span>` : ""}</a>`).join("")
      : `<div class="empty" style="padding:16px">Ничего не найдено</div>`;
    results.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }
  const opts = () => [...results.querySelectorAll(".gsearch__item")];
  const setActive = (i) => {
    const o = opts(); if (!o.length) return;
    active = (i + o.length) % o.length;
    o.forEach((el, k) => {
      const on = k === active;
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-selected", String(on));
    });
    input.setAttribute("aria-activedescendant", o[active].id);
    o[active].scrollIntoView({ block: "nearest" });
  };

  input.addEventListener("focus", ensureIndex);
  input.addEventListener("input", async (e) => { await ensureIndex(); render(e.target.value); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { input.value = ""; render(""); input.blur(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
    else if (e.key === "Enter") {
      // без явного выбора — переходим к первому результату (ожидаемое поведение combobox)
      const o = opts(); const target = (active >= 0 && o[active]) ? o[active] : o[0];
      if (target) location.href = target.getAttribute("href");
    }
  });
  document.addEventListener("click", (e) => { if (!box.contains(e.target)) collapse(); });
  document.addEventListener("keydown", (e) => {
    const tag = (document.activeElement && document.activeElement.tagName) || "";
    if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); input.focus(); }
    else if (e.key === "/" && document.activeElement !== input && !/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) { e.preventDefault(); input.focus(); }
  });
}

async function loadJSON(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    // Регистрируем файл до возврата: футер считает свежесть только по тем
    // данным, которые страница действительно взяла.
    const name = path.split("/").pop();
    if (!USED_DATA.has(name)) { USED_DATA.add(name); refreshFreshness(); }
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
const ASSUME = `<abbr class="assume-mark" tabindex="0" data-tip="редакторское допущение по сборке — не подтверждено данными" aria-label="редакторское допущение по сборке — не подтверждено данными">*</abbr>`;

// Канон цвета этапа v4: идентичность 1=--cat-1, 2A/2B=--cat-3, 3/4/5=muted; «фокус» — золото.
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
  ["T-op", "трудозатраты на транзакцию (время консультанта)"],
  ["T-wait", "время ожидания: очередь, поддержка, согласования"],
  ["OPEX", "операционные расходы агентства"],
  ["NSM", "главная метрика направления (North Star)"],
  ["Q2", "2-й квартал 2026 — текущий фокус направления"],
  // Английские метрики из этапов пути — раскрываем простым языком (раньше шли без тултипа).
  ["Adoption-in-AA", "доля новых агентств, реально перешедших работать в Агентскую админку"],
  ["Parity gap", "разрыв в функциях: чего в Ракете ещё нет против привычных инструментов"],
  ["Self-service share", "доля транзакций, которые делают сами, без обращения в поддержку"],
  ["Support-ratio", "сколько обращений в поддержку Ракеты приходится на объём транзакций"],
  ["Rework rate", "доля переделок — транзакций, которые пришлось делать заново"],
  ["Incidents-per-services", "число сбоев на объём оказанных услуг"],
  ["Blocker-time", "время, когда работа стоит из-за блокера"],
  ["SLA hit rate", "доля обращений, закрытых в обещанный срок"],
  ["Time-to-cash", "время от оказанной услуги до денег на счёте агентства"],
  ["Hidden-work", "скрытая ручная работа, не видимая в системе"],
  ["Steps-per-task", "сколько шагов уходит на одну задачу"],
  ["Operations per consultant", "сколько ручных операций делает один консультант (нагрузка, стремимся ↓)"],
  ["adoption", "приживаемость: реально ли команда начала пользоваться продуктом"],
  ["паритет", "паритет функций: в Ракете есть всё, к чему команда привыкла"],
  ["GDS", "глобальная система бронирования (Amadeus, Sabre и т.п.)"],
];
function gloss(s) {
  if (!s) return s;
  // tabindex+data-tip+aria-label вместо title: расшифровка доступна с клавиатуры и на таче,
  // не только по наведению мышью (2026-07-03). Всплывашка рисуется CSS из data-tip.
  let out = String(s)
    .replace(/\b(H\d+(?:\.\d+){1,2})\b/g,
      `<abbr class="gloss" tabindex="0" data-tip="проверяемая гипотеза ценности — раскрыта в «Пути агентства» и Легендах" aria-label="$1 — проверяемая гипотеза ценности">$1</abbr>`)
    .replace(/\b(E\.\d)\b/g,
      `<abbr class="gloss" tabindex="0" data-tip="находка анализа дерева работ — см. Дерево (JTBD)" aria-label="$1 — находка анализа дерева работ">$1</abbr>`);
  for (const [t, def] of GLOSS_TERMS) {
    const esc_t = t.replace(/[-]/g, "\\-");
    out = out.replace(new RegExp(`(?<![\\wА-Яа-я-])(${esc_t})(?![\\wА-Яа-я-])`, "g"),
      `<abbr class="gloss" tabindex="0" data-tip="${def}" aria-label="$1 — ${def}">$1</abbr>`);
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
const FILTERS_STORAGE = "agency-backlog-filters-v1";   // память поиска/фильтров/сортировки (ТЗ 07)

// Колонки страницы «Инициативы» (сокращённый бэклог): та же ось, что бэклог, но без
// «Цитата / данные» и «Агентства (исслед.)», плюс «Задач» и «Свёрнутые итерации».
const INIT_COLS = [
  ["num", "#", "num", true],
  ["status", "Статус", "text", false],
  ["moscow", "MoSCoW", "badge", true],
  ["theme", "Тема", "text", true],
  ["level2", "Уровень 2", "text", true],
  ["iteration", "Инициатива", "title", true],
  ["taskCount", "Задач", "num", true],
  ["gitlabId", "ID гитлаб", "mono", false],
  ["title", "Название", "title", true],
  ["jobStory", "Проблема (Job Story)", "long", true],
  ["problemSource", "Проблема: источник", "text", false],
  ["jtbdWork", "Работа (JTBD)", "long", true],
  ["stage", "Этап", "text", true],
  ["block", "Блок", "text", true],
  ["mechanism", "Механизм", "text", true],
  ["subgoal", "Подцель", "text", true],
  ["hypothesis", "Гипотеза", "long", true],
  ["impact", "Impact", "num", false],
  ["confidence", "Confidence", "num", false],
  ["mlLeverage", "ML (рычаг метрик)", "num", false],
  ["depth", "Depth (глубина)", "num", false],
  ["pvMult", "PV Mult", "num", false],
  ["value", "Value", "num", false],
  ["normPct", "Приоритет %", "num", true],
  ["reach", "Reach", "num", false],
  ["effort", "Effort", "num", false],
  ["rice", "RICE", "num", false],
  ["finalScore", "Final", "num", false],
  ["gate", "Gate", "badge-plain", true],
  ["concentration", "Концентрация", "text", true],
  ["metricsSummary", "Метрики (сводно)", "long", true],
  ["rationale", "Обоснование", "long", false],
  ["pvNotes", "PV Notes", "text", false],
  ["activeMetrics", "Активные метрики", "text", false],
  ["targetMetrics", "Целевые метрики", "text", false],
  ["reachNote", "Reach — обоснование", "long", false],
  ["collapsedIterations", "Свёрнутые итерации", "long", false],
];
const INIT_FILTER_FIELDS = [
  ["theme", "Тема"],
  ["moscow", "MoSCoW"],
  ["stage", "Этап"],
  ["mechanism", "Механизм"],
  ["subgoal", "Подцель"],
  ["gate", "Gate"],
  ["hCode", "Гипотеза"],
  ["concentration", "Концентрация"],
];
const INIT_SEARCH_FIELDS = ["title", "jobStory", "iteration", "id", "gitlabId", "rationale", "hypothesis", "jtbdWork", "metricsSummary", "activeMetrics", "targetMetrics", "collapsedIterations", "reachNote"];

// Конфиг рендерера таблицы: backlog.html и initiatives.html — одна машина, разные данные/колонки.
const BACKLOG_CFG = {
  host: "[data-backlog]", dataUrl: "data/backlog.json",
  cols: COLS_FULL, filterFields: FILTER_FIELDS, searchFields: SEARCH_FIELDS,
  colsStorage: COLS_STORAGE, filtersStorage: FILTERS_STORAGE,
  loading: "Загрузка бэклога…", searchLabel: "Поиск по бэклогу",
  searchPlaceholder: "Поиск по названию, job story, гипотезе, агентствам, цитатам, ID…",
  unit: "итераций", countLabel: "итераций", tableClass: "",
};
const INIT_CFG = {
  host: "[data-initiatives]", dataUrl: "data/initiatives.json",
  cols: INIT_COLS, filterFields: INIT_FILTER_FIELDS, searchFields: INIT_SEARCH_FIELDS,
  colsStorage: "agency-init-cols-v3", filtersStorage: "agency-init-filters-v1", // v3: компоненты формулы скрыты по дефолту (п.7 ревью)
  tieBreak: "value",
  loading: "Загрузка инициатив…", searchLabel: "Поиск по инициативам",
  searchPlaceholder: "Поиск по названию, job story, гипотезе, свёрнутым итерациям, ID…",
  unit: "инициатив", countLabel: "инициатив", tableClass: "backlog--init",
};

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

async function mountBacklog(cfg = BACKLOG_CFG) {
  const host = document.querySelector(cfg.host);
  if (!host) return;
  const COLS = cfg.cols, FILTERS = cfg.filterFields, SEARCH = cfg.searchFields;
  const COLS_KEY = cfg.colsStorage, FILTERS_KEY = cfg.filtersStorage;
  host.innerHTML = `<div class="loading">${esc(cfg.loading)}</div>`;

  let data;
  try { data = await loadJSON(cfg.dataUrl); }
  catch (e) { host.innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }

  const all = data.items || [];
  all.forEach((it) => { it.hCode = hCodeOf(it.hypothesis); });

  const defaultsOn = COLS.filter((c) => c[3]).map((c) => c[0]);
  let savedCols = null;
  try { const raw = localStorage.getItem(COLS_KEY); if (raw) savedCols = JSON.parse(raw); } catch (e) { /* ignore */ }
  const visInit = Array.isArray(savedCols) && savedCols.length
    ? new Set(savedCols.filter((k) => COLS.some((c) => c[0] === k)))
    : new Set(defaultsOn);

  const state = {
    q: "",
    filters: {},
    sort: { key: "moscow", dir: "asc" },      // дефолт: MoSCoW → Final (тай-брейк)
    expanded: new Set(),
    vis: visInit,
  };
  const visCols = () => COLS.filter((c) => state.vis.has(c[0]));
  const colType = (key) => (COLS.find((c) => c[0] === key) || [])[2];

  // опции фильтров — из реальных значений, по убыванию частоты
  const filterDefs = FILTERS.map(([field, label]) => {
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
    const boxes = COLS.map(([key, label]) =>
      `<label class="colbox"><input type="checkbox" data-col="${key}" ${state.vis.has(key) ? "checked" : ""}/> ${esc(label)}</label>`).join("");
    return `
      <div class="toolbar" role="search">
        <input type="search" class="ctl ctl--search" data-search
               aria-label="${esc(cfg.searchLabel)}" autocomplete="off" spellcheck="false"
               placeholder="${esc(cfg.searchPlaceholder)}" />
        ${selects}
        <button type="button" class="ctl ctl--reset" data-reset>Сбросить</button>
      </div>
      <details class="cols-panel">
        <summary>Колонки <span data-cols-count>(${state.vis.size}/${COLS.length})</span></summary>
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
    const get = (k) => { const v = it[k]; return v == null || v === "" ? null : v; };
    const row = (label, val) => val ? `<div class="bd-row"><dt>${esc(label)}</dt><dd>${esc(val)}</dd></div>` : "";
    const score = `R ${get("reach") ?? "—"} · I ${get("impact") ?? "—"} · C ${get("confidence") ?? "—"} · E ${get("effort") ?? "—"} → RICE ${get("rice") ?? "—"} → PV ${get("pvMult") ?? "—"} → Final ${get("finalScore") ?? "—"}`;
    const valueScore = get("value") != null
      ? `I ${get("impact") ?? "—"} × C ${get("confidence") ?? "—"} × ML ${get("mlLeverage") ?? "—"} × Depth ${get("depth") ?? "—"} × PV ${get("pvMult") ?? "—"} → Value ${get("value")} (Norm ${get("normPct") ?? "—"}%)`
      : null;
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
              ${row("Работа (JTBD)", get("jtbdWork"))}${row("Этап", get("stage"))}${row("Блок", get("block"))}${row("Механизм", get("mechanism"))}${row("Подцель", get("subgoal"))}${row("Гипотеза", get("hypothesis"))}
            </dl></div>
            <div class="bd-sect"><div class="bd-h">Проблема</div><dl>
              ${row("Job Story", get("jobStory"))}${row("Источник", get("problemSource"))}${row("Цитата / данные", get("quote"))}
            </dl></div>
            <div class="bd-sect"><div class="bd-h">Скоринг</div><dl>
              ${valueScore ? `<div class="bd-row"><dt>Value</dt><dd class="mono">${esc(valueScore)}</dd></div>` : ""}
              <div class="bd-row"><dt>RICE</dt><dd class="mono">${esc(score)}</dd></div>
              ${row("Gate", get("gate"))}${row("Концентрация", get("concentration"))}${row("Reach — обоснование", get("reachNote"))}
            </dl></div>
            ${(get("taskCount") != null || get("collapsedIterations")) ? `<div class="bd-sect"><div class="bd-h">Свёртка инициативы</div><dl>
              ${row("Задач в инициативе", get("taskCount"))}${row("Свёрнутые итерации", get("collapsedIterations"))}
            </dl></div>` : ""}
            <div class="bd-sect"><div class="bd-h">Метрики</div><dl>
              ${row("Сводно", get("metricsSummary"))}${row("Активные", get("activeMetrics"))}${row("Целевые", get("targetMetrics"))}
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
    if (!items.length) return `<tr><td colspan="${span}"><div class="empty">Ничего не найдено<span class="empty__hint">Измени или сбрось фильтры и поиск.</span></div></td></tr>`;
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
      const tieKey = cfg.tieBreak || "finalScore";
      let r = compare(a, b, state.sort.key, state.sort.dir);
      if (r === 0 && state.sort.key !== tieKey) r = compare(a, b, tieKey, "desc");
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
        const hay = SEARCH.map((f) => it[f] || "").join(" ").toLowerCase();
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
    saveFilters();
  }

  // Память поиска/фильтров/сортировки между визитами (ТЗ 07). Колонки — отдельно (COLS_STORAGE).
  function saveFilters() {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify({ q: state.q, filters: state.filters, sort: state.sort }));
    } catch (e) { /* ignore */ }
  }
  function restoreFilters() {
    let s = null;
    try { const raw = localStorage.getItem(FILTERS_KEY); if (raw) s = JSON.parse(raw); } catch (e) { /* ignore */ }
    if (!s) return;
    if (typeof s.q === "string" && s.q) {
      state.q = s.q;
      const si = host.querySelector("[data-search]"); if (si) si.value = s.q;
    }
    if (s.filters && typeof s.filters === "object") {
      Object.entries(s.filters).forEach(([field, v]) => {
        if (!v) return;
        const sel = host.querySelector(`[data-filter="${field}"]`);
        if (sel && [...sel.options].some((o) => o.value === v)) { sel.value = v; state.filters[field] = v; }
      });
    }
    if (s.sort && s.sort.key) state.sort = { key: s.sort.key, dir: s.sort.dir === "desc" ? "desc" : "asc" };
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
      <div class="stat"><div class="v">${all.length}</div><div class="l">${esc(cfg.unit)}</div></div>
      <div class="stat"><div class="v">${mustCount}</div><div class="l">Must</div></div>
      <div class="stat"><div class="v">${themes.size}</div><div class="l">тем</div></div>
    </div>
    ${controlsHTML()}
    <div class="table-wrap table-wrap--full">
      <table class="backlog backlog--full ${cfg.tableClass || ""}">
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
    state.sort = { key: "moscow", dir: "asc" };
    host.querySelector("[data-search]").value = "";
    host.querySelectorAll("[data-filter]").forEach((s) => (s.value = ""));
    try { localStorage.removeItem(FILTERS_KEY); } catch (e) { /* ignore */ }
    history.replaceState(null, "", location.pathname);
    apply();
  });
  host.querySelectorAll("[data-col]").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const key = e.target.dataset.col;
      if (e.target.checked) state.vis.add(key); else state.vis.delete(key);
      try { localStorage.setItem(COLS_KEY, JSON.stringify([...state.vis])); } catch (err) { /* ignore */ }
      const c = host.querySelector("[data-cols-count]");
      if (c) c.textContent = `(${state.vis.size}/${COLS.length})`;
      apply();
    });
  });

  // deep-link: ?q=… и/или фильтры (?theme=&stage=&moscow=&gate=&hCode=&concentration=&…)
  const params = new URLSearchParams(location.search);
  const qp = params.get("q");

  // Память (ТЗ 07): без параметров в URL — восстанавливаем сохранённое. Если в URL есть
  // хоть один параметр (поделились ссылкой) — она побеждает, сохранённое игнорируем.
  const hasURLState = qp != null || filterDefs.some(({ field }) => params.get(field) != null);
  if (!hasURLState) restoreFilters();
  if (qp) { state.q = qp; host.querySelector("[data-search]").value = qp; }
  filterDefs.forEach(({ field }) => {
    const v = params.get(field);
    if (v == null) return;
    const sel = host.querySelector(`[data-filter="${field}"]`);
    if (sel && [...sel.options].some((o) => o.value === v)) { sel.value = v; state.filters[field] = v; }
  });

  apply();
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
    `<span class="ltag big">Big job · ${esc(t.bigjob)}</span>`,
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

// Канон русских названий сегментов. Жил внутри mountAgencies, поднят наверх:
// те же сегменты выводит «Экономика поддержки», а в источниках они записаны
// по-английски и по-разному. Две копии карты разъехались бы молча.
const SEG_RU = {
  "Strategist (ядро)": "Опорные (ядро)",
  "Growth leader": "Лидеры роста",
  "Stable": "Устойчивые",
  "Riser": "Растущие",
  "Riser (новичок)": "Растущие (новичок)",
  "Stagnating/Declining": "Замедляющиеся/Уходящие",
  "Declining": "Уходящие",
  "Declining (уходит)": "Уходящие",
};
const segRu = (v) => SEG_RU[v] || v;

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

// --- Графики динамики транзакций (чистый SVG, без библиотек) ---
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

// --- Тултипы графиков: одна плавающая плашка на страницу + делегирование на контейнер ---
// Любой SVG-элемент с атрибутом data-tip="..." показывает плашку у курсора. HTML внутри data-tip
// допустим (мы сами его собираем из экранированных значений). Работает и для касаний (pointer*).
function chTip() {
  let t = document.getElementById("ch-tip");
  if (!t) { t = document.createElement("div"); t.id = "ch-tip"; t.className = "ch-tip"; t.setAttribute("role", "tooltip"); document.body.appendChild(t); }
  return t;
}
function wireTips(root) {
  if (!root || root.dataset.tipsOn) return;     // вешаем один раз на контейнер; переживает re-render потомков
  root.dataset.tipsOn = "1";
  const t = chTip();
  root.addEventListener("pointermove", (e) => {
    const el = e.target.closest("[data-tip]");
    if (!el) { t.classList.remove("is-on"); return; }
    t.innerHTML = el.getAttribute("data-tip");
    t.classList.add("is-on");
    const pad = 14, r = t.getBoundingClientRect();
    let x = e.clientX + pad, y = e.clientY + pad;
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad;
    if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad;
    t.style.left = Math.max(8, x) + "px";
    t.style.top = Math.max(8, y) + "px";
  });
  root.addEventListener("pointerleave", () => t.classList.remove("is-on"));
}

// Мини-линия динамики для строки таблицы (цвет = направление: вверх cat-3 шалфей / вниз cat-2 терракота).
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
  const tip = `последний <b>${fmtNum(last)}</b> · пик ${fmtNum(max)} · дно ${fmtNum(min)}`;
  return `<svg class="spark spark--${dir} ch-hit" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" data-tip="${tip}">
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

// Помесячный тренд «ядро ↔ остальные»: стэк-столбцы (транзакции ядра + остальных) + линия доли ядра
// на правой оси (0–100%) + подпись Δ к прошлому месяцу над столбцом. opts: { leadName, others }.
function agTrend(months, ibcVals, totVals, opts = {}) {
  const n = months.length;
  if (n < 2) return "";
  const leadName = opts.leadName || "ядро", others = opts.others ?? "";
  const restVals = totVals.map((tt, i) => Math.max((tt || 0) - (ibcVals[i] || 0), 0));
  const W = 600, H = 280, pT = 24, pB = 46, pL = 46, pR = 40;
  const iw = W - pL - pR, ih = H - pT - pB;
  const maxT = Math.max(...totVals, 1);
  const step = niceStep(maxT, 5);
  const hi = Math.ceil(maxT / step) * step || step;
  const Y = (val) => pT + ih - (val / hi) * ih;        // левая ось — транзакции
  const Y1 = (pct) => pT + ih - (pct / 100) * ih;      // правая ось — доля %
  const slot = iw / n, bw = Math.min(slot * 0.6, 44), cx = (i) => pL + slot * (i + 0.5);
  let grid = "";
  for (let g = 0; g <= hi + 1e-9; g += step) {
    const y = Y(g).toFixed(1);
    grid += `<line x1="${pL}" y1="${y}" x2="${W - pR}" y2="${y}" class="ch-grid"/>`
      + `<text x="${pL - 8}" y="${(+y + 3).toFixed(1)}" class="ch-ylab" text-anchor="end">${fmtK(g)}</text>`;
  }
  let yr = "";
  [0, 50, 100].forEach((pp) => { const y = Y1(pp).toFixed(1); yr += `<text x="${W - pR + 8}" y="${(+y + 3).toFixed(1)}" class="ch-ylab ch-ylab--r" text-anchor="start">${pp}%</text>`; });
  let bars = "", deltas = "", xlab = "";
  totVals.forEach((tt, i) => {
    const x = (cx(i) - bw / 2).toFixed(1);
    const hI = (ibcVals[i] / hi) * ih, hR = (restVals[i] / hi) * ih;
    const yR = Y(tt), yI = yR + hR;                     // остальные сверху, ядро снизу
    bars += `<rect class="agb agb--ibc" x="${x}" y="${yI.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(hI, 0).toFixed(1)}"/>`
          + `<rect class="agb agb--rest" x="${x}" y="${yR.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(hR, 0).toFixed(1)}"/>`;
    if (i > 0 && totVals[i - 1]) {
      const dp = (tt / totVals[i - 1] - 1) * 100;
      deltas += `<text class="agt-d" x="${cx(i).toFixed(1)}" y="${(yR - 6).toFixed(1)}" text-anchor="middle">${dp > 0 ? "+" : dp < 0 ? "−" : ""}${Math.abs(dp).toFixed(0)}%</text>`;
    }
    if (i % 2 === 0 || i === n - 1) xlab += `<text x="${cx(i).toFixed(1)}" y="${H - 24}" class="ch-xlab" text-anchor="middle">${monLabel(months[i])}</text>`;
  });
  const sh = totVals.map((tt, i) => (tt ? 100 * ibcVals[i] / tt : 0));
  const pts = sh.map((p, i) => [cx(i), Y1(p)]);
  const dPath = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const lineSvg = `<path d="${dPath}" class="agt-line"/>` + pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.4" class="agt-dot"/>`).join("");
  let hit = "";
  totVals.forEach((tt, i) => {
    const x = (cx(i) - slot / 2).toFixed(1);
    const d = i > 0 && totVals[i - 1] ? (tt / totVals[i - 1] - 1) * 100 : null;
    const dtip = d == null ? "" : `<br>Δ к пред.: <b>${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(1)}%</b>`;
    const tip = `<b>${monLabel(months[i])}</b><br>${esc(leadName)}: <b>${fmtNum(ibcVals[i])}</b> · остальные: <b>${fmtNum(restVals[i])}</b><br>всего ${fmtNum(tt)} · доля ${esc(leadName)} <b>${Math.round(sh[i])}%</b>${dtip}`;
    hit += `<rect x="${x}" y="${pT}" width="${slot.toFixed(1)}" height="${ih}" fill="transparent" class="ch-hit" data-tip="${tip}"/>`;
  });
  return `<svg class="agbars-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Транзакции ${esc(leadName)} и остальных по месяцам: стэк-столбцы и доля ядра">
    ${grid}${yr}${bars}${lineSvg}${deltas}${xlab}${hit}</svg>`;
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

  // Подписи месяцев выводятся из data.cut / data.offlineCut, а не зашиты в разметку.
  // До июля 2026 везде стояло «июнь» строкой — при смене среза заголовки врали молча.
  // Отдельная подпись у оффлайна: он приходит из транзакционного дампа и отстаёт от ops.
  // Падежи заданы списками, а не склеиванием окончаний: «июль»+«е» даёт «июлье».
  const MON_N = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
  const MON_G = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const MON_P = ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"];
  const MON_D = ["январю", "февралю", "марту", "апрелю", "маю", "июню", "июлю", "августу", "сентябрю", "октябрю", "ноябрю", "декабрю"];
  const cutP = String(data.cut || "").split(".");
  const cutMi = cutP.length === 3 ? (+cutP[1] - 1) : 5;
  const cutY = cutP.length === 3 ? cutP[2] : "";
  const curM = MON_N[cutMi] || "", curMG = MON_G[cutMi] || "", curMP = MON_P[cutMi] || "";
  const prevMi = (cutMi + 11) % 12;
  const prevMG = MON_G[prevMi] || "", prevMD = MON_D[prevMi] || "";
  const yy = cutY ? "'" + String(cutY).slice(2) : "";
  const yyPrev = cutY ? "'" + String(+cutY - 1).slice(2) : "";
  const offM = (data.offlineCut || curM).replace(/\s*\d{4}\s*$/, "").trim();
  const offStale = offM && offM.toLowerCase() !== curM;   // месяц оффлайна ≠ месяц ops
  const offMG = MON_G[MON_N.indexOf(offM)] || offM;

  // Лидер базы (ядро) против остальных — для сплит-полос «IBC ↔ все».
  const lead = ags.reduce((a, b) => ((b.may || 0) > (a.may || 0) ? b : a), ags[0] || {});
  const leadName = /IBC/i.test(lead.name || "") ? "IBC" : (lead.name || "лидер");
  const others = Math.max(ags.length - 1, 0);
  const clUp = ags.filter((a) => (a.clNet || 0) > 0).length;
  const clDown = ags.filter((a) => (a.clNet || 0) < 0).length;

  // Помесячные ряды «ядро ↔ остальные» для дашборда за период (транзакции — поток, клиенты — сток).
  const ibcId = String(lead.id);
  const opsMonths = (mon && mon.months) || [], opsTot = (mon && mon.total) || [], opsIbc = (mon && mon.byId && mon.byId[ibcId]) || [];
  const clMonths = (monCl && monCl.months) || [], clTot = (monCl && monCl.total) || [], clIbc = (monCl && monCl.byId && monCl.byId[ibcId]) || [];
  const hasSeries = opsTot.length > 1 && opsIbc.length > 1;
  const hasClSeries = clTot.length > 1 && clIbc.length > 1;
  const lastK = (arr, k) => (arr || []).slice(-k);
  const aSum = (a) => a.reduce((s, x) => s + (x || 0), 0);
  const aAvg = (a) => (a.length ? aSum(a) / a.length : 0);
  // Агрегат за окно последних k месяцев: транзакции — сумма, клиенты — среднее активных за период.
  const periodAgg = (k) => {
    const ko = Math.min(k, opsTot.length || 1), kc = Math.min(k, clTot.length || 1);
    const oIbc = aSum(lastK(opsIbc, ko)), oTot = aSum(lastK(opsTot, ko)), oRest = Math.max(oTot - oIbc, 0);
    const cIbc = Math.round(aAvg(lastK(clIbc, kc))), cTot = Math.round(aAvg(lastK(clTot, kc))), cRest = Math.max(cTot - cIbc, 0);
    return {
      ko,
      ops: { ibc: oIbc, rest: oRest, pct: oTot ? oIbc / oTot : 0 },
      cl: { ibc: cIbc, rest: cRest, pct: cTot ? cIbc / cTot : 0 },
      opcIbc: cIbc ? Math.round((oIbc / ko) / cIbc) : null,        // транзакций на клиента в месяц
      opcRest: cRest ? Math.round((oRest / ko) / cRest) : null,
    };
  };

  if (sumHost) {
    // Дашборд «ядро ↔ остальные» за период: два помесячных стэк-тренда (транзакции, клиенты) друг под другом.
    // «Месяц» убран — у одного месяца нет тренда и нет Δ; помесячная детализация видна по столбцам.
    const PERIODS = [
      { v: "3", k: 3, lbl: "3 мес" },
      { v: "6", k: 6, lbl: "6 мес" },
      { v: "all", k: 999, lbl: "Всё" },
    ];
    const PMAP = Object.fromEntries(PERIODS.map((p) => [p.v, p]));
    const state = { period: "all" };

    // Помесячные стэк-тренды за окно периода (см. agTrend): транзакции — поток, клиенты (NSM) — активные за месяц.
    const opsTrend = (k) => {
      const ko = Math.min(k, opsTot.length);
      return agTrend(lastK(opsMonths, ko), lastK(opsIbc, ko), lastK(opsTot, ko), { leadName, others });
    };
    const clTrendChart = (k) => {
      const ko = Math.min(k, clTot.length);
      return agTrend(lastK(clMonths, ko), lastK(clIbc, ko), lastK(clTot, ko), { leadName, others });
    };

    // Перерисовка тела дашборда под выбранный период (обёртка с контролами статична).
    const renderDash = () => {
      const body = sumHost.querySelector("[data-dashbody]");
      if (!body) return;
      const p = PMAP[state.period] || PMAP.all;
      const agg = periodAgg(p.k);
      const legend = `<div class="agbars__legend">
          <span class="lg-key"><i class="lg-sw lg-sw--ibc"></i>${esc(leadName)} (ядро)</span>
          <span class="lg-key"><i class="lg-sw lg-sw--rest"></i>остальные ${others}</span>
          <span class="lg-key"><i class="lg-sw lg-sw--share"></i>доля ${esc(leadName)}, %</span>
        </div>`;
      const opsCol = hasSeries
        ? `<div class="agdash__col"><div class="agdash__cap">Транзакции по месяцам · стэк ${esc(leadName)}+остальные · линия — доля · Δ за месяц над столбцом</div>${opsTrend(p.k)}</div>`
        : "";
      const nsmNote = `<div class="ag-note"><span class="ag-note__lbl">Как считаем NSM</span><p>Активный клиент — это <b>факт поездок</b>, а не логин в Ракете (пока прокси к строгой NSM). Считаем за 3 месяца, поэтому цифра (${fmtNum(nsm.now)}) выше месячной (${fmtNum(nsm.activeMo)}). «+20» и NSM — два множителя одной воронки: «+20» растит число агентств, NSM — число их клиентов.</p></div>`;
      const clCol = `<div class="agdash__col" id="nsm"><div class="agdash__cap">Клиенты (NSM) по месяцам · стэк ${esc(leadName)}+остальные · линия — доля · Δ за месяц над столбцом</div>${hasClSeries ? clTrendChart(p.k) : ""}${nsmNote}</div>`;
      const opc = (agg.opcIbc != null && agg.opcRest != null)
        ? `${fmtNum(agg.opcIbc)} транзакций на клиента-компанию в месяц у ${esc(leadName)} против ${fmtNum(agg.opcRest)} у остальных (клиент — юрлицо-заказчик, а не человек; среднее тянут вверх несколько крупных корпоративных счетов — см. сегмент A в <a href="#abcdx">ABCDX</a>). ` : "";
      const win = p.v === "all" ? "за весь период" : `за ${p.lbl}`;
      const cap = `${opc}В долях ${win} ядро держит <b>${fmtPct(agg.ops.pct, 0)} транзакций</b>, но только <b>${fmtPct(agg.cl.pct, 0)} клиентов</b>: объём опирается на ядро, а число клиентов — уже нет. <b>Потеря ядра обрушит метрику направления.</b>`;
      body.innerHTML = legend + `<div class="agtrend-stack">${opsCol}${clCol}</div><div class="ag-note ag-note--risk"><span class="ag-note__lbl">Концентрация — риск</span><p>${cap}</p></div>`;
    };

    const dashShell = `
      <div class="agbars">
        <div class="agbars__head">
          <div class="lbl">${esc(leadName)} ↔ остальные ${others}: транзакции и клиенты по месяцам</div>
          <div class="seg" role="group" aria-label="Период">
            ${PERIODS.map((p) => `<button type="button" class="seg__btn${p.v === state.period ? " is-active" : ""}" data-period-v="${p.v}">${p.lbl}</button>`).join("")}
          </div>
        </div>
        <div data-dashbody></div>
      </div>`;
    sumHost.innerHTML = `
      <div class="ag-strip">
        <div class="ag-stat"><div class="v">${t.count ?? ags.length}</div><div class="l">агентств</div><div class="s">активных в ${curMP}</div></div>
        <div class="ag-stat"><div class="v">${fmtNum(nsm.now)}</div><div class="l">клиентов-компаний · NSM</div><div class="s">главная метрика</div></div>
        <div class="ag-stat ag-stat--win"><div class="v">${intDelta(nsm.net)}</div><div class="l">клиентов / 6 мес.</div><div class="s">${fmtNum(nsm.new)} пришло − ${fmtNum(nsm.lost)} ушло</div></div>
        <div class="ag-stat"><div class="v">${fmtNum(t.may)}</div><div class="l">транзакций · ${curM}</div><div class="s">${pctCell(t.momPct)} к ${prevMD}</div></div>
        <div class="ag-stat"><div class="v">${fmtPct(c.top3, 0)}</div><div class="l">у ТОП-3</div><div class="s">концентрация базы</div></div>
        <div class="ag-stat ag-stat--goal"><div class="v">+20</div><div class="l">цель · агентств</div><div class="s">стратегия 2026 (KR-2)</div></div>
      </div>
      <div class="ag-insight">
        <span class="ag-insight__lbl">Главный вывод</span>
        <p class="ag-insight__txt">${
          (nsm.net || 0) > 0
            ? `Рост держится на <b>углублении существующих агентств</b>, а не на новых. За полгода чистыми <b>+${fmtNum(nsm.net)} клиента</b>: ${fmtNum(nsm.new)} пришло − ${fmtNum(nsm.lost)} ушло, база выросла у <b>${clUp} из ${ags.length}</b> агентств.`
            : (nsm.net || 0) < 0
              ? `За полгода клиентская база <b>просела чистыми ${fmtNum(nsm.net)}</b>: ${fmtNum(nsm.new)} пришло − ${fmtNum(nsm.lost)} ушло, база просела у <b>${clDown} из ${ags.length}</b> агентств (выросла у ${clUp}). Отток обгоняет приток.`
              : `За полгода клиентская база держится на месте: ${fmtNum(nsm.new)} пришло − ${fmtNum(nsm.lost)} ушло, ровно компенсируя друг друга.`
        } Это рычаг №1 динамики NSM (этап 2A). <a href="metrics.html#nsm">Воронка NSM →</a></p>
      </div>
      <div class="conc-wrap">
        <div class="conc-bar" role="img" aria-label="Концентрация: ТОП-3 ${fmtPct(c.top3,0)}, ТОП-5 ${fmtPct(c.top5,0)}">
          ${ags.slice(0, 5).map((a, i) => `<span class="conc-seg s${i}" style="flex:${(a.sharePct || 0) * 100}" title="${esc(a.name)} · ${fmtPct(a.sharePct)}"></span>`).join("")}
          <span class="conc-seg rest" style="flex:${(1 - (ags.slice(0, 5).reduce((s, a) => s + (a.sharePct || 0), 0))) * 100}" title="остальные"></span>
        </div>
        <div class="conc-cap">Полоса выше — доли пяти крупнейших агентств и «хвоста» по транзакциям. ТОП-5 = ${fmtPct(c.top5, 0)} транзакций, ТОП-3 = ${fmtPct(c.top3, 0)}.</div>
      </div>
      ${dashShell}`;

    // Период-селектор перерисовывает тело; делегирование тултипов на sumHost переживает перерисовку.
    sumHost.querySelectorAll("[data-period-v]").forEach((b) => b.addEventListener("click", () => {
      state.period = b.dataset.periodV;
      sumHost.querySelectorAll("[data-period-v]").forEach((x) => x.classList.toggle("is-active", x === b));
      renderDash();
    }));
    renderDash();
    wireTips(sumHost);
    // Async-рендер: доскроллить к #nsm, если страницу открыли по якорю (ссылки из сводки/etapy).
    if (location.hash === "#nsm") { const el = sumHost.querySelector("#nsm"); if (el) el.scrollIntoView(); }
  }

  // Отображение сегментов партнёрской базы по-русски (данные остаются как в источнике).
  if (tblHost) {
    const segs = [...new Set(ags.map((a) => a.segment).filter(Boolean))];
    const bands = [...new Set(ags.map((a) => a.band).filter(Boolean))];
    const state = { seg: "", band: "" };

    const rows = () => {
      const list = ags.filter((a) => (!state.seg || a.segment === state.seg) && (!state.band || a.band === state.band));
      if (!list.length) return `<tr><td colspan="12"><div class="empty">Ничего не найдено<span class="empty__hint">Измени или сбрось фильтры.</span></div></td></tr>`;
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
          <td class="num" title="${a.offlineN != null ? esc(fmtNum(a.offlineN) + " из " + fmtNum(a.apr) + " опер. за " + offM + " — вручную") : "нет данных"}">${fmtPct(a.offlinePct)}</td>
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
            <th>Транзакций, ${curM}</th><th>Доля транзакций</th>
            <th><abbr title="Транзакции ${curMG}${yy} к ${prevMD}${yy}">За месяц</abbr></th>
            <th><abbr title="Транзакции ${curMG}${yy} к ${MON_D[cutMi]}${yyPrev}">За год</abbr></th>
            <th><abbr title="Среднее число транзакций в месяц за последние 6 месяцев">Ср. за 6 мес.</abbr></th>
            <th><abbr title="Какая доля операций ${offMG} оформлена вручную, а не онлайн — снимок месяца, не накопление за период.${offStale ? " ВНИМАНИЕ: месяц оффлайна отстаёт от месяца транзакций — транзакционного дампа за " + curM + " ещё нет." : ""}">Доля оффлайн, ${offM}${offStale ? " ⚠" : ""}</abbr></th>
            <th><abbr title="Транзакции по месяцам за 13 месяцев (${curM}${yyPrev} – ${curM}${yy})">Динамика</abbr></th>
            <th>Клиентов сейчас</th><th>Δ клиентов за полгода</th>
          </tr></thead>
          <tbody>${rows()}</tbody>
        </table>
      </div>`;
    tblHost.querySelectorAll("[data-ag]").forEach((s) => s.addEventListener("change", (e) => {
      state[e.target.dataset.ag] = e.target.value;
      tblHost.querySelector("tbody").innerHTML = rows();
    }));
    wireTips(tblHost);   // спарклайны в строках — делегирование переживает перерисовку tbody
  }

  // --- ABCDX: сегментация клиентов по объёму (Парето), с 2026-06 ---
  const abcdxHost = document.querySelector("[data-ag-abcdx]");
  if (abcdxHost && data.abcdx && (data.abcdx.segments || []).length) {
    const ab = data.abcdx;
    const SEG_CAP = { A: "накопл. до 50%", B: "50–80%", C: "80–95%", D: "95–100%", X: "≤2 опер/мес" };
    const SEG_BAR = { A: "s0", B: "s1", C: "s2", D: "s3", X: "rest" };
    const strip = ab.segments.map((s) => `
        <div class="ag-stat${s.seg === "A" ? " ag-stat--goal" : ""}">
          <div class="v">${fmtNum(s.clients)}</div>
          <div class="l">клиентов · ${esc(s.seg)}</div>
          <div class="s">${(s.opsPct ?? 0).toFixed(1)}% операций · ${esc(SEG_CAP[s.seg] || "")}</div>
        </div>`).join("");
    const bar = `<div class="conc-bar" role="img" aria-label="Доля операций по сегментам ABCDX">
        ${ab.segments.map((s) => `<span class="conc-seg ${SEG_BAR[s.seg] || "rest"}" style="flex:${s.opsPct || 0}" title="${esc(s.seg)} · ${esc(fmtNum(s.clients))} клиентов · ${s.opsPct}% операций"></span>`).join("")}
      </div>`;
    const byAg = (ab.byAgency || []).slice().sort((a, b) => (b.clients || 0) - (a.clients || 0));
    const rowsHtml = byAg.map((a) => `
        <tr>
          <td class="title">${esc(a.name)}</td>
          <td class="num">${fmtNum(a.clients)}</td>
          <td class="num">${a.a || "—"}</td>
          <td class="num">${a.b || "—"}</td>
          <td class="num">${a.c || "—"}</td>
          <td class="num">${a.d || "—"}</td>
          <td class="num">${a.x || "—"}</td>
        </tr>`).join("");
    abcdxHost.innerHTML = `
      <div class="ag-strip">${strip}</div>
      <div class="conc-wrap">
        ${bar}
        <div class="conc-cap">Полоса — доля операций ${curMG} по сегментам объёма (Парето: A — верхние клиенты, дающие половину объёма; X — почти неактивные). Клиенты IBC внутри холдинга размечены не ниже сегмента B — поэтому у IBC почти нет C/D/X.</div>
      </div>
      <div class="table-wrap" style="margin-top:14px">
        <table class="backlog">
          <thead><tr><th>Агентство</th><th>Клиентов, ${curM}</th><th>A</th><th>B</th><th>C</th><th>D</th><th>X</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
    wireTips(abcdxHost);
  }

  // --- Ось денег к ABCDX (лист «Цена транзакции» единого свода) ---
  // Выручка — расчёт «тариф × операции», не биллинг. IBC вынесен из сравнения:
  // тариф 170 ₽ считается по всем деньгам холдинга, а не по транзакционному сбору.
  const priceHost = document.querySelector("[data-ag-price]");
  if (priceHost && data.price && (data.price.rows || []).length) {
    const pr = data.price;
    const pct = (v) => (v == null ? "—" : (v * 100).toFixed(1) + "%");
    const money = (r) => (r.revenue != null ? fmtNum(Math.round(r.revenue)) : esc(r.revenueText || "—"));
    const rows = pr.rows.slice().sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
    const tr = rows.map((r) => `
        <tr${r.excluded ? ' class="ag-row-muted"' : ""}>
          <td class="title">${esc(r.name)}${r.excluded ? ' <span class="ev-chip ev-warn">вне сравнения</span>' : ""}</td>
          <td class="num">${fmtNum(r.ops)}</td>
          <td>${esc(r.tariff || "—")}</td>
          <td class="num">${money(r)}</td>
          <td class="num">${r.effPrice != null ? fmtNum(Math.round(r.effPrice)) : "—"}</td>
          <td class="num">${pct(r.revSharePct)}</td>
          <td class="num">${r.excluded ? "—" : pct(r.revShareExIbcPct)}</td>
          <td class="num">${pct(r.opsSharePct)}</td>
          <td>${esc(r.flag || "")}</td>
        </tr>`).join("");
    const concRows = (pr.concentration || []).map((c) => `
        <tr>
          <td class="title">${esc(c.cut)}</td>
          <td>${esc(c.byOps)}</td>
          <td>${esc(c.byMoney)}</td>
          <td>${esc(c.byMoneyExIbc)}</td>
          <td>${esc(c.note || "")}</td>
        </tr>`).join("");
    priceHost.innerHTML = `
      <div class="callout--soft">
        <b>Оговорка по IBC — читать до таблицы.</b> IBC входит в тот же холдинг, что и Ракета,
        и тариф 170 ₽ за операцию считается по <b>всем полученным от клиента деньгам</b>, а не
        только по транзакционному сбору, как у внешних агентств. С 32–100 ₽ остальных он
        несопоставим — это разные базы начисления. Поэтому доля выручки дана двумя колонками:
        «с IBC» — вес направления в деньгах компании, «без IBC» — сравнение агентств между
        собой и метка «Концентрация». Оценка «клиент IBC ≈ ×8 к клиенту внешнего агентства» —
        допущение PM, в данных не проверено.
      </div>
      <div class="table-wrap" style="margin-top:14px">
        <table class="backlog">
          <thead><tr>
            <th>Агентство</th><th>Опер. ${curM}</th><th>Тариф</th><th>Выручка ₽, оценка</th>
            <th>Эфф. ₽/трз</th><th>Доля денег, с IBC</th><th>Доля денег, без IBC</th>
            <th>Доля объёма</th><th>Флаг</th>
          </tr></thead>
          <tbody>${tr}</tbody>
        </table>
      </div>
      <p class="ev-srcline"><b>Эффективная цена</b> — сколько агентство фактически платит за одну операцию
      с учётом минимумов и лицензий: у Космоса и Альбатроса номинал 35 и 50 ₽, но объёма до минимума
      они не добирают и платят фиксированные 105 000 ₽, то есть 415 и 279 ₽ за операцию.</p>
      ${concRows ? `<h3 style="margin-top:22px">Концентрация: объём против денег</h3>
      <div class="table-wrap">
        <table class="backlog">
          <thead><tr><th>Срез</th><th>По объёму</th><th>По деньгам, с IBC</th><th>По деньгам, без IBC</th><th>Комментарий</th></tr></thead>
          <tbody>${concRows}</tbody>
        </table>
      </div>` : ""}
      <p class="ev-srcline">Источник цен — ${esc(pr.priceSource || "")}. ${esc(pr.assumption || "")}</p>`;
    wireTips(priceHost);
  }

  // --- Отток / рост / миграции (лист «3. Отток и миграции» единого свода) ---
  const churnHost = document.querySelector("[data-ag-churn]");
  if (churnHost && data.churn) {
    const ch = data.churn;
    const TYPE_CLS = { "уход к конкуренту": "t-comp", "cross-agency миграция": "t-mig" };
    const byType = {};
    (ch.lost || []).forEach((d) => {
      const t = d.type || "прочее / демо";
      (byType[t] = byType[t] || []).push(d.name);
    });
    const items = Object.entries(byType).map(([t, names]) => `
        <div class="churn-item"><span class="churn-type ${TYPE_CLS[t] || "t-other"}">${esc(t)}</span>${names.map((n) => esc(n)).join(" · ")}</div>`).join("");
    const c = ch.counts || {};
    churnHost.innerHTML = `
      <p class="lede" style="font-size:14px">
        Цель KR-2 «+20 агентств» считается как <b>привлечено − отток</b>, а не валовой
        прирост. За ${esc(ch.window || "")} потеряно <b>${c.Lost ?? "—"}</b> агентств,
        добавилось <b>${c.New ?? "—"}</b> новых (в основном микро-новички) — это фон, который
        новые привлечения должны сначала компенсировать (это <a href="metrics.html#nsm">вход воронки NSM</a>).
      </p>
      <div class="churn">${items}</div>`;
  }
}

// ===================== Экономика поддержки (support.html) ===================
// Страница отвечает на «сколько стоит поддержка и где предел у людей».
// Данные: support_econ.json (считанное) + support_econ_extra.json (суждения PM).
// Чисел в этом файле нет — всё приходит из json.

const SE_RU_MON = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

// Свой форматтер процентов: глобальный fmtPct объявлен в файле дважды, и
// побеждает версия, округляющая до целых. Здесь нужен один знак — «6,4%»
// вместо «6%», иначе главный вывод страницы теряет точность.
function sePct(x, d = 1) {
  return x == null ? "—" : (x * 100).toFixed(d).replace(".", ",") + "%";
}
// Разряды разделяем УЗКИМ НЕРАЗРЫВНЫМ пробелом. Обычный пробел здесь ломает
// число переносом: в узкой ячейке таблицы «67,52 млн ₽» распадалось на две
// строки, а «2 050 ₽» оставляло рубль сиротой на второй.
const SE_NB = " ";
function seNum(n, d = 0) {
  if (n == null) return "—";
  return n.toLocaleString("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d })
    .replace(/[   ]/g, SE_NB);
}
// Деньги крупно: 4317127 → «4,32 млн ₽», 343616 → «344 тыс ₽», 676 → «676 ₽».
function seMoney(n, long = false) {
  if (n == null) return "—";
  if (long) return seNum(n) + SE_NB + "₽";
  const a = Math.abs(n);
  if (a >= 1e6) return seNum(n / 1e6, 2) + SE_NB + "млн" + SE_NB + "₽";
  if (a >= 1e4) return seNum(n / 1e3) + SE_NB + "тыс" + SE_NB + "₽";
  return seNum(n) + SE_NB + "₽";
}
// «2025-07» → «июл·25»
function seMon(key) {
  if (!key) return "";
  const [y, m] = String(key).split("-");
  return (SE_RU_MON[(+m) - 1] || m) + "·" + String(y).slice(2);
}
// Полное имя месяца — для фраз в тексте: «пришлась на июль 2026». В подсказках
// и подписях осей остаётся короткая форма, иначе они не помещаются.
const SE_RU_MON_FULL = ["январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
function seMonFull(key) {
  if (!key) return "";
  const [y, m] = String(key).split("-");
  return (SE_RU_MON_FULL[(+m) - 1] || m) + " " + y;
}
function seMonLong(key) {
  if (!key) return "";
  const [y, m] = String(key).split("-");
  return (SE_RU_MON[(+m) - 1] || m) + " " + y;
}

const SE_METRICS = {
  calls: { label: "Обращения", axis: "обращений", fmt: (v) => seNum(v) },
  cost: { label: "Стоимость, ₽", axis: "₽ в месяц", fmt: (v) => seMoney(v) },
  pct: { label: "% выручки", axis: "% выручки", fmt: (v) => sePct(v) },
  load: { label: "Загрузка на специалиста", axis: "обращений на человека", fmt: (v) => seNum(v) },
};

// «1 тема / 2 темы / 5 тем»: без этого в заголовках колонок стояло «3 тем».
function sePlural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b > 1 && b < 5) return few;
  return many;
}

// Ширина холста графиков — почти во всю колонку страницы (--maxw 1280 минус
// поля = 1232px). Прежние 760 браузер растягивал до той же ширины, увеличивая
// вместе с картинкой и текст: подписи осей выходили крупнее основного текста
// страницы и налезали друг на друга. Рисуем 1:1 — размеры подписей задаёт css.
const SE_W = 1200;
// Подпись оси — отдельной строкой над полем графика. Раньше она рисовалась в
// той же точке, что и верхняя риска, и «395 тыс ₽» с «₽ в месяц» печатались
// друг поверх друга.
function seAxisCap(x, anchor, text) {
  return `<text x="${x}" y="15" class="se-axis-cap" text-anchor="${anchor}">${esc(text)}</text>`;
}

async function mountSupportEcon() {
  const headHost = document.querySelector("[data-se-head]");
  if (!headHost) return;
  headHost.innerHTML = `<div class="loading">Загрузка…</div>`;
  let D, X;
  try {
    [D, X] = await Promise.all([
      loadJSON("data/support_econ.json"),
      loadJSON("data/support_econ_extra.json"),
    ]);
  } catch (e) {
    headHost.innerHTML = `<div class="error">${esc(e.message)}</div>`;
    return;
  }

  const mKeys = D.months.map((m) => m.m);
  const FOTS = D.fotScenarios.map((s) => s.fot);
  // Названий агентств и порогов-суждений в этом файле быть не должно:
  // имя внутреннего агентства приходит из сборки, цель и пороги — из авторского слоя.
  const IBC = D.meta.ibcName;
  const GOAL = (X.b3 || {}).goalAgencies || 0;
  const SMALL_OPS = (X.b5 || {}).smallBaseOps || 0;

  // --- состояние страницы живёт в адресе -------------------------------
  // Чтобы ссылку на конкретный разрез можно было отправить в чат. localStorage
  // для этого не годится: он не уезжает вместе со ссылкой.
  function readState() {
    const p = new URLSearchParams(location.search);
    const fot = Number(p.get("fot"));
    // Number(null) === 0, поэтому без явной проверки ползунок «сколько новых
    // агентств» открывался на нуле — под заголовком «что будет, если выполнить
    // цель +20» страница показывала «+0 агентств» и «+0% к очереди».
    const n = p.has("n") ? Number(p.get("n")) : NaN;
    return {
      base: p.get("base") === "ex" ? "ex" : "all",
      fot: FOTS.includes(fot) ? fot : D.meta.fotBase,
      metric: SE_METRICS[p.get("m")] ? p.get("m") : "cost",
      ag: p.get("ag") || null,
      mm: mKeys.includes(p.get("mm")) ? p.get("mm") : null,
      n: Number.isFinite(n) && n >= 0 && n <= GOAL ? n : GOAL,
      heat: p.get("heat") === "cost" ? "cost" : "ratio",
      // Денежный блок свёрнут по умолчанию, но ссылка вида support.html#dengi
      // должна приводить в раскрытый блок, а не к закрытому заголовку.
      money: p.get("money") === "1" || location.hash === "#dengi",
      heatOpen: p.get("map") === "1" || location.hash === "#pomesyachno",
      small: p.get("small") === "1",
      // Пять пунктов под выводом первого экрана: свёрнуты по умолчанию.
      points: p.get("v") === "1",
    };
  }
  const state = readState();

  function writeState() {
    const p = new URLSearchParams();
    if (state.base !== "all") p.set("base", state.base);
    if (state.fot !== D.meta.fotBase) p.set("fot", state.fot);
    if (state.metric !== "cost") p.set("m", state.metric);
    if (state.ag) p.set("ag", state.ag);
    if (state.mm) p.set("mm", state.mm);
    if (state.n !== GOAL) p.set("n", state.n);
    if (state.heat !== "ratio") p.set("heat", state.heat);
    if (state.money) p.set("money", "1");
    if (state.heatOpen) p.set("map", "1");
    if (state.small) p.set("small", "1");
    if (state.points) p.set("v", "1");
    const q = p.toString();
    history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + location.hash);
  }

  // --- пересчёт под выбранную зарплату и базу ---------------------------
  // Стоимость обращения прямо пропорциональна зарплате (число обращений от неё
  // не зависит), поэтому все денежные величины масштабируются одним множителем.
  // Проверено на сценариях из источника: 4 317 127 × 118 300/91 000 = 5 612 265.
  // Единственное, что так не считается, — убыток: это сумма превышений по
  // месяцам, а max(0, …) не линеен. Его пересчитываем по рядам.
  function derive() {
    const k = state.fot / D.meta.fotBase;
    const ex = state.base === "ex";
    const staff = D.meta.staff;

    const months = D.months.map((m) => ({
      m: m.m,
      calls: ex ? m.callsExt : m.calls,
      ops: ex ? m.opsExt : m.ops,
      revenue: ex ? m.revenueExt : m.revenue,
      ratio: ex ? m.ratioExt : m.ratio,
      supportCost: (ex ? m.supportCostExt : m.supportCost) * k,
      pctRevenue: (ex ? m.pctRevenueExt : m.pctRevenue) * k,
      ticketCost: m.ticketCost * k,
      capacityTickets: m.capacityTickets,
      perSpecialist: m.perSpecialist,
      callsIbc: m.callsIbc,
      callsExt: m.callsExt,
    }));

    const list = D.agencies.filter((a) => !ex || a.name !== IBC);
    const agencies = list.map((a) => ({
      ...a,
      supportCost: a.supportCost * k,
      pctRevenue: a.pctRevenue * k,
      marginBeforeCost: a.revenue - a.supportCost * k,
      series: {
        ...a.series,
        supportCost: (a.series.supportCost || []).map((v) => (v == null ? null : v * k)),
        pctRevenue: (a.series.pctRevenue || []).map((v) => (v == null ? null : v * k)),
      },
    }));

    let loss = 0;
    const lossByMonth = mKeys.map((mk, i) => {
      let s = 0;
      agencies.forEach((a) => {
        const c = (a.series.supportCost || [])[i] || 0;
        const r = (a.series.revenue || [])[i] || 0;
        if (c > r) s += c - r;
      });
      loss += s;
      return { m: mk, loss: s };
    });

    const sum = (f) => agencies.reduce((t, a) => t + (f(a) || 0), 0);
    const revenue = sum((a) => a.revenue);
    const supportCost = sum((a) => a.supportCost);
    const calls = sum((a) => a.calls);
    const ops = sum((a) => a.ops);
    const scen = D.fotScenarios.find((s) => s.fot === state.fot);

    return {
      k, ex, staff, months, agencies, lossByMonth,
      totals: {
        calls, ops, revenue, supportCost,
        pctRevenue: revenue ? supportCost / revenue : null,
        ratio: ops ? (calls / ops) * 1000 : null,
        ticketCostAvg: D.totals.ticketCostAvg * k,
        perSpecialistLast: D.capacity[D.capacity.length - 1]?.perSpecialist,
        lossTotal: loss,
        lossPctRevenue: revenue ? loss / revenue : null,
        lossWorst: lossByMonth.reduce((a, b) => (b.loss > a.loss ? b : a), lossByMonth[0]),
      },
      scenario: scen,
    };
  }

  // ---------------------------------------------------------------- шапка
  const P = X.page || {};
  headHost.innerHTML = `
    <p class="eyebrow">${esc(P.eyebrow || "")}</p>
    <h1>${esc(P.h1 || "Экономика поддержки")}</h1>
    <p class="lede">${esc(P.lede || "")}</p>
    ${P.srcline ? `<p class="ev-srcline">${P.srcline}</p>` : ""}`;

  // -------------------------------------------- B0 executive summary
  // Первый экран отвечает на всё сразу: четыре числа, пять выводов и один
  // запрос. Остальная страница — доказательство каждого из выводов, поэтому
  // каждый ведёт ссылкой в свой блок.
  function renderSummary(M) {
    const host = document.querySelector("[data-se-summary]");
    if (!host) return;
    const b0 = X.b0 || {};
    const nc = D.newcomer || {};
    const S = D.supplier || {};
    const plus = nc.callsPerNewcomer && nc.baseCallsPerMonth
      ? (nc.callsPerNewcomer * GOAL) / nc.baseCallsPerMonth : null;

    const VAL = {
      supportCost: () => seMoney(M.totals.supportCost),
      pctRevenue: () => sePct(M.totals.pctRevenue),
      perSpecialist: () => seNum(M.totals.perSpecialistLast),
      ratio: () => seNum(M.totals.ratio, 1),
      // Доля к поставщику от базы не зависит: она считается на своём окне и
      // по всему потоку обращений, включая корзину «Другое».
      toSupplier: () => sePct(S.share),
      plus20: () => (plus == null ? "—" : "+" + Math.round(plus * 100) + "%"),
    };
    const kpi = (b0.kpi || []).map((k) => {
      const cls = k.accent === "alert" ? " se-stat--alert" : k.accent === "gold" ? " ag-stat--goal" : "";
      // Загрузка и очередь — величины на всю службу: специалисты общие, и от
      // исключения IBC из денежного среза очередь не становится короче.
      // Без этой оговорки «Без IBC» читается как «а вот тут полегче».
      // В срезе «Без IBC» три плашки остаются общими по службе: специалисты
      // одни на всех, и доля к поставщику считается по всему потоку обращений.
      const SHARED = {
        perSpecialist: " · считая IBC: люди общие",
        plus20: " · считая IBC: люди общие",
        toSupplier: " · доля считается по всему потоку, включая IBC",
      };
      const shared = state.base === "ex" ? (SHARED[k.key] || "") : "";
      return `<div class="ag-stat${cls}">
        <div class="v">${esc((VAL[k.key] || (() => "—"))())}</div>
        <div class="l">${esc(k.label || "")}</div>
        <div class="s">${esc(k.sub || "")}${shared}</div>
      </div>`;
    }).join("");

    const v = b0.verdict || {};
    const points = (v.points || []).map((p) => `
      <li>
        <b>${esc(p.head)}.</b> ${esc(p.text)}
        ${p.to ? `<a class="se-point-l" href="#${esc(p.to)}">разбор →</a>` : ""}
      </li>`).join("");

    const a = b0.ask || {};
    // Сам вывод и его статус достоверности видны всегда — это главное
    // утверждение страницы. Пять пунктов, на которых он держится, свёрнуты:
    // первый экран должен отвечать одной фразой, а доказательство разворачивают
    // те, кому оно нужно. Состояние — в адресе, как у остальных раскрытий.
    const chip = (() => {
      // evChip возвращает описатель {cls, sign, label}, а не готовую разметку.
      const c = evChip(v.chipStatus || "подтв.");
      return `<p class="se-verdict-chip"><span class="ev-chip ${c.cls}" aria-label="${esc(c.label)}">${c.sign} ${esc(c.label)}</span>
        <span class="muted">${esc(v.chipLabel || "")}</span></p>`;
    })();
    host.innerHTML = `
      <div class="ag-strip se-kpi">${kpi}</div>
      <article class="accent-card is-nsm se-verdict">
        <h3>${esc(v.head || "")}</h3>
        ${chip}
        <details class="se-details se-verdict-d"${state.points ? " open" : ""} data-pointsbox>
          <summary>${esc(v.pointsHead || "На чём держится вывод")}</summary>
          <ol class="se-points">${points}</ol>
        </details>
      </article>
      ${a.text ? `<div class="se-ask">
        <span class="se-prio ${a.status === "done" ? "se-prio--done" : "se-prio--high"}">${esc(a.label || "нужно решение")}</span>
        <p>${esc(a.text)}</p>
        <p class="se-ask-l"><a href="#${esc(a.to || "delat")}">${esc(a.linkText || "Что решить")} →</a></p>
      </div>` : ""}`;

    // Раскрытие не должно схлопываться при каждой перерисовке страницы —
    // та же причина, что у денежного блока.
    const pd = host.querySelector("[data-pointsbox]");
    if (pd) pd.addEventListener("toggle", () => { state.points = pd.open; writeState(); });
  }

  // -------------------------------------------------------- B1 управление
  // Здесь остаётся только база: она меняет всю страницу. Зарплата специалиста
  // и показатель графика управляют одним денежным блоком — они живут внутри
  // него, в разделе «Что стоит за числами», и наверху были лишним шумом.
  const seOpt = (val, cur, label) =>
    `<button type="button" class="se-seg${val === cur ? " is-on" : ""}" data-val="${esc(val)}">${esc(label)}</button>`;

  // Навигация внутри длинного блока. Два блока — методика и потолок эффекта —
  // сами по себе высотой в несколько экранов и состоят из раскрытий: без
  // чипов на их части единственный способ узнать, что внутри, — пролистать
  // всё. Возврат к заголовку нужен после таблиц и карты той же высоты.
  const seSub = (items) => {
    const li = items.filter((i) => i.id && i.text)
      .map((i) => `<a href="#${esc(i.id)}">${esc(i.text)}</a>`).join("");
    return li ? `<nav class="se-subnav" aria-label="Части раздела">${li}</nav>` : "";
  };
  const seUp = (id) => `<a class="se-uptop" href="#${esc(id)}">↑ К началу раздела</a>`;

  function renderControls(M) {
    const host = document.querySelector("[data-se-controls]");
    if (!host) return;
    const c = X.b1 || {};

    host.innerHTML = `
      <div class="se-bar">
        <div class="se-ctl" data-ctl="base">
          <span class="se-ctl-l">${esc(c.baseLabel || "База")}</span>
          <div class="se-segs">
            ${seOpt("all", state.base, c.baseAll || "Всё направление")}
            ${seOpt("ex", state.base, c.baseExIbc || "Без IBC")}
          </div>
          <span class="se-ctl-h">${esc(c.baseHint || "")}</span>
        </div>
      </div>
      ${state.base === "ex" && c.warnExIbc ? `<p class="se-warn">${esc(c.warnExIbc)}</p>` : ""}`;

    host.querySelectorAll("[data-ctl] .se-seg").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.base = btn.dataset.val;
        renderAll();
      });
    });
  }

  // ------------------------------------------------------------- B2 деньги
  // Комбинированный график: столбцы — выбранный показатель, линия — доля выручки.
  function chartMoney(M) {
    const W = SE_W, H = 340, pL = 104, pR = 74, pT = 46, pB = 50;
    const key = state.metric;
    const bars = M.months.map((m) => ({
      m: m.m,
      v: key === "calls" ? m.calls : key === "pct" ? m.pctRevenue
        : key === "load" ? m.perSpecialist : m.supportCost,
    }));
    const vals = bars.map((b) => b.v).filter((v) => v != null);
    if (!vals.length) return `<p class="muted">Нет данных для графика.</p>`;
    const max = Math.max(...vals) * 1.15;
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const n = bars.length;
    const bw = (W - pL - pR) / n;
    const y = (v) => H - pB - (v / max) * (H - pT - pB);
    const cx = (i) => pL + bw * i + bw / 2;

    const lineMax = Math.max(...M.months.map((m) => m.pctRevenue || 0)) * 1.3 || 1;
    const yr = (v) => H - pB - (v / lineMax) * (H - pT - pB);

    let grid = "";
    for (let g = 0; g <= 3; g++) {
      const v = (max / 3) * g, yy = y(v).toFixed(1);
      grid += `<line x1="${pL}" x2="${W - pR}" y1="${yy}" y2="${yy}" class="se-grid"/>
        <text x="${pL - 10}" y="${(+yy + 4).toFixed(1)}" class="ch-ylab" text-anchor="end">${SE_METRICS[key].fmt(v)}</text>`;
    }
    for (let g = 0; g <= 2; g++) {
      const v = (lineMax / 2) * g;
      grid += `<text x="${W - pR + 10}" y="${(yr(v) + 4).toFixed(1)}" class="ch-ylab ch-ylab--r" text-anchor="start">${sePct(v, 0)}</text>`;
    }

    const rects = bars.map((b, i) => {
      const on = state.mm === b.m;
      const h = Math.max(1, H - pB - y(b.v || 0));
      const mo = M.months[i];
      const tip = `<b>${esc(seMonLong(b.m))}</b><br>обращений ${seNum(mo.calls)} · транзакций ${seNum(mo.ops)}<br>`
        + `стоимость ${seMoney(mo.supportCost, true)} · ${sePct(mo.pctRevenue)} выручки<br>`
        + `на специалиста ${seNum(mo.perSpecialist)} · обращение ${seMoney(mo.ticketCost, true)}`;
      return `<rect class="se-bar-r${on ? " is-on" : ""} ch-hit" data-m="${esc(b.m)}" data-tip="${esc(tip)}"
        x="${(pL + bw * i + bw * 0.16).toFixed(1)}" y="${y(b.v || 0).toFixed(1)}"
        width="${(bw * 0.68).toFixed(1)}" height="${h.toFixed(1)}"/>`;
    }).join("");

    // Разница между месяцами здесь мала (у стоимости — 7%), и на нулевой базе
    // столбцы выглядят одинаковыми. Поэтому значение подписано над каждым
    // столбцом: сравнивать глазом всё равно нечего, читать — есть что.
    const vlab = bars.map((b, i) => b.v == null ? "" :
      `<text x="${cx(i).toFixed(1)}" y="${(y(b.v) - 9).toFixed(1)}" text-anchor="middle"
        class="se-val${b.v === hi ? " is-hi" : b.v === lo ? " is-lo" : ""}">${SE_METRICS[key].fmt(b.v)}</text>`).join("");

    const pts = M.months.map((m, i) => [cx(i), yr(m.pctRevenue || 0)]);
    const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const dots = pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" class="se-line-dot"/>`).join("");

    const xlab = bars.map((b, i) =>
      `<text x="${cx(i).toFixed(1)}" y="${H - 16}" class="ch-xlab" text-anchor="middle">${seMon(b.m)}</text>`).join("");

    const label = `Столбцы — ${SE_METRICS[key].label.toLowerCase()} по месяцам, линия — доля выручки, `
      + `с ${seMonLong(mKeys[0])} по ${seMonLong(mKeys[n - 1])}. `
      + `Разброс: от ${SE_METRICS[key].fmt(lo)} до ${SE_METRICS[key].fmt(hi)}`;
    return `<figure class="se-fig">
      <figcaption class="se-fig-cap">
        <span class="se-key se-key--bar">${esc(SE_METRICS[key].label)} по месяцам</span>
        <span class="se-key se-key--pct">доля выручки, правая ось</span>
      </figcaption>
      <svg class="se-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
        ${grid}${rects}${vlab}
        <path d="${path}" class="se-line se-line--pct" fill="none"/>${dots}
        ${xlab}
        ${seAxisCap(0, "start", SE_METRICS[key].axis)}
        ${seAxisCap(W, "end", "% выручки")}
      </svg>
    </figure>`;
  }

  // Кто именно создал превышение в худшем месяце. Без этого «8,7 тыс в июле»
  // читается как ухудшение экономики базы, хотя почти всю сумму даёт один
  // новичок, у которого объём ещё не набран.
  function worstMonthTop(M) {
    const w = M.totals.lossWorst;
    if (!w || !w.loss) return null;
    const i = mKeys.indexOf(w.m);
    let top = null;
    M.agencies.forEach((a) => {
      const c = (a.series.supportCost || [])[i] || 0;
      const r = (a.series.revenue || [])[i] || 0;
      if (c > r && (!top || c - r > top.loss)) top = { name: a.name, loss: c - r, ops: (a.series.ops || [])[i] || 0 };
    });
    return top ? { ...w, top, share: top.loss / w.loss } : null;
  }

  function renderMoney(M) {
    const host = document.querySelector("[data-se-money]");
    if (!host) return;
    const b = X.b2 || {}, s = b.sensitivity || {}, sp = b.spike || {};
    const rows = D.fotScenarios.map((sc) => {
      const on = sc.fot === state.fot;
      return `<tr class="${on ? "is-on" : ""}">
        <td class="title">${seNum(sc.fot)} ₽${sc.base ? ` <span class="se-tag">опорный</span>` : ""}</td>
        <td class="num">${seMoney(sc.ticketCost, true)}</td>
        <td class="num">${seMoney(sc.total13m)}</td>
        <td class="num">${sePct(sc.pctDirection)}</td>
        <td class="num">${sePct(sc.pctExternal)}</td>
        <td>${esc(sc.note || "")}</td>
      </tr>`;
    }).join("");

    const t = M.totals;
    const w = worstMonthTop(M);
    const spike = w ? esc((sp.text || "")
      .replace("{total}", seMoney(t.lossTotal, true))
      .replace("{loss}", seMoney(w.loss, true))
      .replace("{month}", seMonFull(w.m))
      .replace("{agency}", w.top.name)
      .replace("{agencyShare}", Math.round(w.share * 100) + "% суммы")) : "";

    // Весь денежный блок — свёрнутый: в деньгах ограничения нет, и держать
    // его открытым значит спорить с главным выводом страницы. Заголовок
    // подписан выводом, чтобы разворачивать было незачем.
    const fotWarn = state.fot !== D.meta.fotBase && (X.b1 || {}).warnFot
      ? `<p class="se-warn">${esc((X.b1.warnFot)
          .replace("{fot}", seMoney(state.fot, true))
          .replace("{base}", seMoney(D.meta.fotBase, true)))}</p>` : "";

    host.innerHTML = `
      <details class="se-details se-money" id="dengi"${state.money ? " open" : ""}>
        <summary>${esc(b.head || "Деньги")} — <b>${esc(b.summaryLine || "")}</b></summary>
        ${w ? `<div class="se-spike">
          <b>${esc(sp.head || "")}</b>
          <p>${spike}</p>
          <p class="se-foot">${esc(sp.foot || "")}</p>
        </div>` : ""}
        <div class="se-bar se-bar--in">
          <div class="se-ctl" data-ctl="fot">
            <span class="se-ctl-l">${esc((X.b1 || {}).fotLabel || "Зарплата специалиста")}</span>
            <div class="se-segs">
              ${D.fotScenarios.map((sc) => seOpt(String(sc.fot), String(state.fot),
                seNum(sc.fot) + (sc.base ? " ₽ · опорный" : " ₽"))).join("")}
            </div>
            <span class="se-ctl-h">${esc((X.b1 || {}).fotHint || "")}</span>
          </div>
          <div class="se-ctl" data-ctl="metric">
            <span class="se-ctl-l">${esc((X.b1 || {}).metricLabel || "Показатель на графике")}</span>
            <div class="se-segs">
              ${Object.entries(SE_METRICS).map(([k, m]) => seOpt(k, state.metric, m.label)).join("")}
            </div>
          </div>
        </div>
        ${fotWarn}
        <p class="se-lede">${esc(b.lede || "")}</p>
        ${chartMoney(M)}
        <p class="se-out">${esc(b.note || "")}</p>
        <h3 class="se-h3">${esc(s.head || "")}</h3>
        <p class="se-lede">${esc(s.lede || "")}</p>
        <div class="table-wrap">
          <table class="se-tbl">
            <thead><tr>
              <th>Зарплата специалиста</th><th class="num">Одно обращение</th>
              <th class="num">Поддержка за ${seNum(D.meta.months)} мес.</th><th class="num">% выручки</th>
              <th class="num">% без IBC</th><th>Что это за сценарий</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <p class="se-out">${esc(s.conclusion || "")}
          <b>При выбранном сценарии превышение — ${seMoney(t.lossTotal, true)} за 13 месяцев,
          это ${sePct(t.lossPctRevenue, 2)} выручки.</b></p>
        <p class="se-foot">${esc(b.footnote || "")}</p>
      </details>`;
    wireTips(host);
    // Раскрытый блок не должен схлопываться при каждой перерисовке: состояние
    // держим в state, иначе клик по столбцу графика закрывает сам график.
    const det = host.querySelector("#dengi");
    if (det) det.addEventListener("toggle", () => { state.money = det.open; });
    host.querySelectorAll("[data-ctl] .se-seg").forEach((btn) => {
      btn.addEventListener("click", () => {
        const kind = btn.closest("[data-ctl]").dataset.ctl;
        if (kind === "fot") state.fot = Number(btn.dataset.val);
        else state.metric = btn.dataset.val;
        state.money = true;
        renderAll();
      });
    });
    host.querySelectorAll("[data-m]").forEach((el) => {
      el.addEventListener("click", () => {
        state.mm = state.mm === el.dataset.m ? null : el.dataset.m;
        state.money = true;
        renderAll();
      });
    });
  }

  // -------------------------------------------------------------- B3 люди
  function chartCapacity() {
    const W = SE_W, H = 300, pL = 76, pR = 40, pT = 44, pB = 46;
    const cap = D.capacity;
    const vals = cap.map((c) => c.perSpecialist).filter((v) => v != null);
    if (vals.length < 2) return `<p class="muted">Нет данных для графика.</p>`;
    const max = Math.max(...vals) * 1.12, min = 0;
    const n = cap.length;
    const cx = (i) => pL + (i / (n - 1)) * (W - pL - pR);
    const y = (v) => H - pB - ((v - min) / (max - min)) * (H - pT - pB);

    let grid = "";
    for (let g = 0; g <= 3; g++) {
      const v = (max / 3) * g, yy = y(v).toFixed(1);
      grid += `<line x1="${pL}" x2="${W - pR}" y1="${yy}" y2="${yy}" class="se-grid"/>
        <text x="${pL - 10}" y="${(+yy + 4).toFixed(1)}" class="ch-ylab" text-anchor="end">${seNum(v)}</text>`;
    }
    const path = cap.map((c, i) => (i ? "L" : "M") + cx(i).toFixed(1) + " " + y(c.perSpecialist).toFixed(1)).join(" ");

    const lo = cap.reduce((a, b) => (b.perSpecialist < a.perSpecialist ? b : a));
    const hi = cap.reduce((a, b) => (b.perSpecialist > a.perSpecialist ? b : a));
    const last = cap[cap.length - 1];
    const mark = (c, cls, txt) => {
      const i = cap.indexOf(c);
      const below = cls === "is-lo";   // минимум подписываем снизу, чтобы не спорить с линией
      return `<circle cx="${cx(i).toFixed(1)}" cy="${y(c.perSpecialist).toFixed(1)}" r="4.5" class="se-mark ${cls}"/>
        <text x="${cx(i).toFixed(1)}" y="${(y(c.perSpecialist) + (below ? 22 : -14)).toFixed(1)}" class="se-mark-t ${cls}" text-anchor="middle">${esc(txt)}</text>`;
    };
    const dots = cap.map((c, i) => {
      const tip = `<b>${esc(seMonLong(c.m))}</b><br>на специалиста ${seNum(c.perSpecialist)}<br>`
        + `всего закрыто ${seNum(c.capacityTickets)} · из них агентских ${seNum(c.agencyTickets)}`;
      return `<circle class="ch-hit se-dot" cx="${cx(i).toFixed(1)}" cy="${y(c.perSpecialist).toFixed(1)}" r="11" data-tip="${esc(tip)}"/>`;
    }).join("");
    const xlab = cap.map((c, i) =>
      `<text x="${cx(i).toFixed(1)}" y="${H - 16}" class="ch-xlab" text-anchor="middle">${seMon(c.m)}</text>`).join("");

    return `<figure class="se-fig">
      <svg class="se-chart" viewBox="0 0 ${W} ${H}" role="img"
        aria-label="Загрузка на специалиста по месяцам: минимум ${seNum(lo.perSpecialist)} в ${esc(seMonLong(lo.m))}, максимум ${seNum(hi.perSpecialist)} в ${esc(seMonLong(hi.m))}, последнее значение ${seNum(last.perSpecialist)}">
        ${grid}
        <path d="${path}" class="se-line se-line--load" fill="none"/>
        ${mark(lo, "is-lo", seNum(lo.perSpecialist))}
        ${mark(hi, "is-hi", seNum(hi.perSpecialist))}
        ${dots}${xlab}
        ${seAxisCap(0, "start", "обращений на человека")}
      </svg>
    </figure>`;
  }

  function renderCapacity() {
    const host = document.querySelector("[data-se-capacity]");
    if (!host) return;
    const b = X.b3 || {}, nc = D.newcomer || {};
    const per = nc.callsPerNewcomer || 0, base = nc.baseCallsPerMonth || 0;
    const add = Math.round(per * state.n);
    const pct = base ? add / base : 0;
    const tr = D.capacityTrend || {};

    host.innerHTML = `
      <p class="lede se-lede">${esc(b.lede || "")}</p>
      ${chartCapacity()}
      <p class="se-out">${esc(b.conclusion || "")}</p>
      ${tr.rangeText ? `<p class="se-foot">Диапазон за окно: ${esc(tr.rangeText)}.</p>` : ""}
      <div class="se-calc">
        <h3 class="se-h3">${esc(b.calcHead || "")}</h3>
        <p class="se-lede">${esc(b.calcLede || "")}</p>
        <div class="se-calc-row">
          <input type="range" min="0" max="${GOAL}" step="1" value="${state.n}" class="se-range"
                 aria-label="Сколько новых агентств подключаем" data-se-n />
          <output class="se-calc-n"><b>+${state.n}</b> агентств</output>
        </div>
        <p class="se-calc-out">
          <b class="se-calc-v">+${seNum(add)}</b>
          ${esc((b.calcResult || "").replace("{base}", seNum(base)))}
          — <b>+${Math.round(pct * 100)}%</b> к очереди
        </p>
        <p class="se-foot">${esc((b.calcNote || "").replace("{perNewcomer}", seNum(per, 1)))}</p>
        <p class="se-foot">${esc((b.calcCaveat || "").replace("{count}", String(nc.count || 0)))}
          ${nc.names ? `Это ${esc(nc.names.join(", "))}.` : ""}</p>
      </div>`;
    wireTips(host);
    const r = host.querySelector("[data-se-n]");
    if (r) {
      r.addEventListener("input", () => {
        state.n = Number(r.value);
        renderCapacity();
        writeState();
      });
    }
  }

  // ------------------------------------------------- B4 кто создаёт нагрузку
  function renderWho(M) {
    const host = document.querySelector("[data-se-who]");
    if (!host) return;
    const b = X.b4 || {};
    const sh = D.totals.ibcShare || {};
    const ibc = D.agencies.find((a) => a.name === IBC);
    const exT = D.totals.exIbc || {};

    const bar = (label, ibcShare) => {
      const p = (ibcShare || 0) * 100;
      return `<div class="se-split">
        <div class="se-split-l">${esc(label)}</div>
        <div class="se-split-bar" role="img" aria-label="${esc(label)}: IBC ${sePct(ibcShare)}, внешние ${sePct(1 - ibcShare)}">
          <span class="se-split-a" style="flex:${p.toFixed(2)}"><i>${sePct(ibcShare, 0)}</i></span>
          <span class="se-split-b" style="flex:${(100 - p).toFixed(2)}"><i>${sePct(1 - ibcShare, 0)}</i></span>
        </div>
      </div>`;
    };

    const times = ibc && exT.revenuePerCall
      ? (ibc.revenuePerCall / exT.revenuePerCall) : null;

    // Две линии: как менялась нагрузка у IBC и у внешней базы.
    const W = SE_W, H = 290, pL = 76, pR = 40, pT = 44, pB = 46;
    const n = D.months.length;
    const all = D.months.flatMap((m) => [m.ratioIbc, m.ratioExt]).filter((v) => v != null);
    const max = Math.max(...all) * 1.15;
    const cx = (i) => pL + (i / (n - 1)) * (W - pL - pR);
    const y = (v) => H - pB - (v / max) * (H - pT - pB);
    const line = (get, cls) => {
      const d = D.months.map((m, i) => (i ? "L" : "M") + cx(i).toFixed(1) + " " + y(get(m)).toFixed(1)).join(" ");
      return `<path d="${d}" class="se-line ${cls}" fill="none"/>`;
    };
    let grid = "";
    for (let g = 0; g <= 3; g++) {
      const v = (max / 3) * g, yy = y(v).toFixed(1);
      grid += `<line x1="${pL}" x2="${W - pR}" y1="${yy}" y2="${yy}" class="se-grid"/>
        <text x="${pL - 10}" y="${(+yy + 4).toFixed(1)}" class="ch-ylab" text-anchor="end">${seNum(v, 1)}</text>`;
    }
    const hits = D.months.map((m, i) => {
      const tip = `<b>${esc(seMonLong(m.m))}</b><br>IBC ${seNum(m.ratioIbc, 1)} · внешние ${seNum(m.ratioExt, 1)}<br>`
        + `<span class="muted">обращений на 1000 транзакций</span>`;
      return `<rect class="ch-hit" x="${(cx(i) - (W - pL - pR) / n / 2).toFixed(1)}" y="${pT}"
        width="${((W - pL - pR) / n).toFixed(1)}" height="${H - pT - pB}" fill="transparent" data-tip="${esc(tip)}"/>`;
    }).join("");
    const xlab = D.months.map((m, i) =>
      `<text x="${cx(i).toFixed(1)}" y="${H - 16}" class="ch-xlab" text-anchor="middle">${seMon(m.m)}</text>`).join("");
    // Крайние значения подписаны прямо у линий: у обеих серий разница по годам
    // невелика, и «вырос с 9,3 до 10,6» из формы линии на нулевой базе не видно.
    const edge = (get, cls) => [0, n - 1].map((i) => {
      const v = get(D.months[i]);
      if (v == null) return "";
      return `<text x="${cx(i).toFixed(1)}" y="${(y(v) - 12).toFixed(1)}" class="se-val ${cls}"
        text-anchor="${i ? "end" : "start"}">${seNum(v, 1)}</text>`;
    }).join("");

    host.innerHTML = `
      <p class="lede se-lede">${esc(b.lede || "")}</p>
      <div class="se-splits">
        <div class="se-legend">
          <span class="se-key se-key--a">${esc(IBC || "внутреннее агентство")}</span>
          <span class="se-key se-key--b">${seNum(D.agencies.length - (IBC ? 1 : 0))} внешних агентств</span>
        </div>
        ${bar("Обращения", sh.calls)}
        ${bar("Объём работы", sh.ops)}
        ${bar("Выручка", sh.revenue)}
      </div>
      ${ibc && times ? `<p class="se-out">${esc((b.gapNote || "")
        .replace("{ibc}", seMoney(ibc.revenuePerCall, true))
        .replace("{ext}", seMoney(exT.revenuePerCall, true))
        .replace("{times}", seNum(times, 1)))}</p>` : ""}
      <h3 class="se-h3">${esc(b.trendHead || "")}</h3>
      <figure class="se-fig">
        <figcaption class="se-fig-cap">
          <span class="se-key se-key--a">${esc(IBC || "внутреннее агентство")}</span>
          <span class="se-key se-key--b">внешние агентства</span>
        </figcaption>
        <svg class="se-chart" viewBox="0 0 ${W} ${H}" role="img"
          aria-label="Обращений на 1000 транзакций по месяцам: у IBC растёт, у внешних агентств уровень выше и без роста">
          ${grid}${line((m) => m.ratioIbc, "se-line--a")}${line((m) => m.ratioExt, "se-line--b")}
          ${edge((m) => m.ratioIbc, "is-a")}${edge((m) => m.ratioExt, "is-b")}
          ${hits}${xlab}
          ${seAxisCap(0, "start", "на 1000 транзакций")}
        </svg>
      </figure>
      <ul class="se-bullets">
        <li><span class="se-key se-key--a"></span>${esc(b.trendIbc || "")}</li>
        <li><span class="se-key se-key--b"></span>${esc(b.trendExt || "")}</li>
      </ul>
      <p class="se-foot">${esc(b.trendNote || "")}</p>
      <details class="se-details">
        <summary>Почему IBC нельзя сравнивать с остальными в лоб</summary>
        <div class="se-caveat">${esc(b.caveat || "")}</div>
      </details>`;
    wireTips(host);
  }

  // ------------------------------------------------------- B5 по агентствам
  const SORTS = {
    pctRevenue: { label: "% выручки", get: (a) => a.pctRevenue, dir: -1 },
    name: { label: "Агентство", get: (a) => a.name, dir: 1, text: true },
    calls: { label: "Обращения", get: (a) => a.calls, dir: -1 },
    ops: { label: "Объём работы", get: (a) => a.ops, dir: -1 },
    revenue: { label: "Выручка", get: (a) => a.revenue, dir: -1 },
    supportCost: { label: "Стоимость поддержки", get: (a) => a.supportCost, dir: -1 },
    ratio: { label: "На 1000 транзакций", get: (a) => a.ratio, dir: -1 },
    escalationShare: { label: "Ушло в разработку", get: (a) => a.escalationShare, dir: -1 },
    toSupplierShare: { label: "К поставщику", get: (a) => a.toSupplierShare, dir: -1 },
  };
  // Сортировка по умолчанию — стоимость поддержки, а не доля выручки: по доле
  // первые пять строк занимали новички с базой в десятки транзакций (501%,
  // 139%, 111%…), и таблица начиналась с шума. По стоимости сверху те, на кого
  // действительно уходят люди и деньги.
  let sortKey = "supportCost", sortDir = -1;

  function renderTable(M) {
    const host = document.querySelector("[data-se-table]");
    if (!host) return;
    const b = X.b5 || {};
    const V = b.verdicts || {};
    const s = SORTS[sortKey];
    const list = [...M.agencies].sort((a, b2) => {
      const x = s.get(a), yv = s.get(b2);
      if (x == null) return 1;
      if (yv == null) return -1;
      return (s.text ? String(x).localeCompare(String(yv), "ru") : x - yv) * sortDir;
    });

    const th = (k, extra = "", note = "") => {
      const on = sortKey === k;
      return `<th class="${extra}${on ? " is-sorted" : ""}" data-sort="${k}"
        aria-sort="${on ? (sortDir < 0 ? "descending" : "ascending") : "none"}">
        <button type="button">${esc(SORTS[k].label)}${on ? (sortDir < 0 ? " ↓" : " ↑") : ""}</button>
        ${note ? `<span class="se-th-note">${esc(note)}</span>` : ""}</th>`;
    };

    const row = (a) => {
      const v = V[a.name] || {};
      const small = (a.ops || 0) < SMALL_OPS;
      const open = state.ag === a.name;
      // Полоску меряем от «вся выручка ушла на поддержку» (100%), а не от
      // максимума в таблице: максимум здесь 501% — Альянс Авиа с двумя
      // транзакциями за месяц, — и рядом с ним 18 остальных агентств
      // рисовались одинаковым волоском. Всё, что за 100%, отмечено отдельно.
      const pctRev = a.pctRevenue || 0;
      const over = pctRev > 1;
      const w = Math.min(100, pctRev * 100);
      return `<tr class="se-row${small ? " is-small" : ""}${open ? " is-open" : ""}" data-ag="${esc(a.name)}" tabindex="0">
          <td class="title">
            <span class="se-ag">
              <span class="se-caret">${open ? "▾" : "▸"}</span><b class="se-ag-n">${esc(a.name)}</b>
              ${a.isNewcomer ? `<span class="se-tag">новичок</span>` : ""}
              ${small ? `<span class="se-tag se-tag--warn" title="${esc(b.smallBaseNote || "")}">малая база</span>` : ""}
            </span>
            <span class="se-seg-l">${esc(segRu(a.segment))}</span>
          </td>
          <td class="num">${seNum(a.calls)}</td>
          <td class="num">${seNum(a.ops)}</td>
          <td class="num">${seMoney(a.revenue)}</td>
          <td class="num">${seMoney(a.supportCost)}</td>
          <td class="num se-load">
            <span class="se-load-val">${sePct(a.pctRevenue)}</span>
            <span class="se-load-track"><span class="se-load-bar${over ? " is-over" : ""}"
              style="width:${w.toFixed(1)}%"></span></span>
          </td>
          <td class="num">${seNum(a.ratio, 1)}</td>
          <td class="num">${a.escalationShare == null ? "—" : sePct(a.escalationShare, 0)}</td>
          <td class="num se-dim">${a.toSupplierShare == null ? "—" : sePct(a.toSupplierShare, 0)}</td>
        </tr>
        ${open ? drill(a, v) : ""}`;
    };

    // Агентства с базой меньше порога прячем под строку-раскрытие: на объёме
    // в десятки транзакций доля выручки на поддержку ничего не измеряет, а
    // первое впечатление от таблицы забирает целиком. В «Итого» они входят.
    const isSmall = (a) => (a.ops || 0) < SMALL_OPS;
    const bigList = list.filter((a) => !isSmall(a));
    const smallList = list.filter(isSmall);
    const sumOf = (arr, f) => arr.reduce((t2, a) => t2 + (f(a) || 0), 0);
    const smallAgg = {
      calls: sumOf(smallList, (a) => a.calls),
      ops: sumOf(smallList, (a) => a.ops),
      revenue: sumOf(smallList, (a) => a.revenue),
      supportCost: sumOf(smallList, (a) => a.supportCost),
    };
    smallAgg.pctRevenue = smallAgg.revenue ? smallAgg.supportCost / smallAgg.revenue : null;
    smallAgg.ratio = smallAgg.ops ? (smallAgg.calls / smallAgg.ops) * 1000 : null;

    const moreRow = smallList.length ? `
      <tr class="se-morerow"><td colspan="9">
        <button type="button" data-more>${state.small ? "▾" : "▸"} ${seNum(smallList.length)}
          ${esc(b.smallHead || "агентств с малой базой")}</button>
        <span class="se-morerow-v">вместе: ${seNum(smallAgg.calls)} ${sePlural(smallAgg.calls, "обращение", "обращения", "обращений")} ·
          ${seMoney(smallAgg.supportCost)} · ${sePct(smallAgg.supportCost / M.totals.supportCost, 1)} всей поддержки</span>
      </td></tr>` : "";

    const rows = bigList.map(row).join("") + moreRow
      + (state.small ? smallList.map(row).join("") : "");

    const tot = M.totals;
    const totalRow = (label, t, cls) => `<tr class="se-total ${cls}">
      <td class="title">${esc(label)}</td>
      <td class="num">${seNum(t.calls)}</td><td class="num">${seNum(t.ops)}</td>
      <td class="num">${seMoney(t.revenue)}</td><td class="num">${seMoney(t.supportCost)}</td>
      <td class="num">${sePct(t.pctRevenue)}</td><td class="num">${seNum(t.ratio, 1)}</td>
      <td class="num">—</td><td class="num">—</td></tr>`;

    const exIbc = D.totals.exIbc || {};
    host.innerHTML = `
      <p class="lede se-lede">${esc(b.lede || "")}</p>
      <div class="table-wrap">
        <table class="se-tbl se-tbl--ag">
          <thead><tr>
            ${th("name", "title")}${th("calls", "num")}${th("ops", "num")}${th("revenue", "num")}
            ${th("supportCost", "num")}${th("pctRevenue", "num", "полоска: 100% = вся выручка агентства")}${th("ratio", "num")}
            ${th("escalationShare", "num")}
            <th class="num se-dim" data-sort="toSupplierShare">
              <button type="button">К поставщику${sortKey === "toSupplierShare" ? (sortDir < 0 ? " ↓" : " ↑") : ""}</button>
              <span class="se-th-note">${esc(D.supplier ? `${D.supplier.monthsCovered} из ${D.supplier.monthsTotal} мес.` : "")}</span>
            </th>
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot>
            ${totalRow("Итого", tot, "")}
            ${state.base === "all" && exIbc.calls ? totalRow("Без IBC", {
              calls: exIbc.calls, ops: exIbc.ops, revenue: exIbc.revenue,
              supportCost: exIbc.supportCost * M.k, pctRevenue: exIbc.pctRevenue * M.k,
              ratio: exIbc.ratio,
            }, "se-total--alt") : ""}
          </tfoot>
        </table>
      </div>
      ${smallList.length ? `<p class="se-foot">${esc((b.smallNote || "").replace("{ops}", seNum(SMALL_OPS)))}</p>` : ""}
      <p class="se-foot">${esc(b.supplierColNote || "")}</p>
      <details class="se-details" id="reshenie">
        <summary>${esc(b.highlightHead || "Где нужно решение")}</summary>
        <div class="se-cards">
          ${(b.highlight || []).map((nm) => {
            const a = M.agencies.find((x) => x.name === nm);
            const v = V[nm] || {};
            if (!a) return "";
            return `<article class="accent-card is-bet1 se-card">
              <div class="k">${sePct(a.pctRevenue)} выручки на обслуживание</div>
              <h3>${esc(nm)}</h3>
              <p><b>${esc(v.verdict || "")}.</b> ${esc(v.text || "")}</p>
            </article>`;
          }).join("")}
        </div>
        <p class="se-out">${esc(b.newcomerNote || "")}</p>
      </details>
      ${seUp("agentstva")}`;

    const more = host.querySelector("[data-more]");
    if (more) {
      more.addEventListener("click", (e) => {
        e.stopPropagation();
        state.small = !state.small;
        renderTable(M);
        writeState();
      });
    }

    host.querySelectorAll("th[data-sort]").forEach((h) => {
      h.addEventListener("click", () => {
        const k = h.dataset.sort;
        if (sortKey === k) sortDir = -sortDir;
        else { sortKey = k; sortDir = SORTS[k].dir; }
        renderTable(M);
      });
    });
    host.querySelectorAll(".se-row").forEach((tr) => {
      const toggle = () => {
        state.ag = state.ag === tr.dataset.ag ? null : tr.dataset.ag;
        renderTable(M);
        writeState();
      };
      tr.addEventListener("click", toggle);
      tr.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
      });
    });
    wireTips(host);
  }

  // Разбор одного агентства: помесячные ряды, тариф, разработка, вердикт.
  function drill(a, v) {
    const spark = (key, label, fmt) => {
      const ser = a.series[key] || [];
      const last = [...ser].reverse().find((x) => x != null);
      return `<div class="se-spark">
        <div class="se-spark-l">${esc(label)}</div>
        ${sparkline(ser, 120, 30)}
        <div class="se-spark-v">${fmt(last)}</div>
      </div>`;
    };
    const esc2 = (s) => esc(s || "");
    const agHref = ((X.b5 || {}).agencyLinks || {})[a.name] || "agencies.html";
    return `<tr class="se-drill"><td colspan="9">
      <div class="se-drill-in">
        <div class="se-sparks">
          ${spark("calls", "Обращения", (x) => seNum(x))}
          ${spark("ops", "Объём работы", (x) => seNum(x))}
          ${spark("revenue", "Выручка", (x) => seMoney(x))}
          ${spark("supportCost", "Стоимость поддержки", (x) => seMoney(x))}
        </div>
        <div class="se-drill-facts">
          ${a.tariffNote ? `<p><b>Тариф:</b> ${esc2(a.tariffNote)}</p>` : ""}
          ${a.escalations != null ? `<p><b>Ушло в разработку:</b> ${seNum(a.escalations)} обращений`
            + `${a.escalationShare != null ? ` (${sePct(a.escalationShare, 0)})` : ""}.
            Это нагрузка на разработку, которой нет ни в одной цифре выше.</p>` : ""}
          ${a.toSupplier != null ? `<p><b>Переадресовано поставщику:</b> ${seNum(a.toSupplier)} из ${seNum(a.callsInSupplierWindow)}
            (${sePct(a.toSupplierShare, 0)}).</p>`
            : `<p>Данных о переадресации нет: агентство подключилось позже, чем обрывается выгрузка обращений.</p>`}
          ${a.firstMonth ? `<p>Первый месяц с объёмом — ${esc(seMonLong(a.firstMonth))}.</p>` : ""}
        </div>
        ${v.verdict ? `<div class="se-verdict-box se-v--${esc(v.cls || "mid")}">
          <b>${esc(v.verdict)}</b>
          <p>${esc(v.text || "")}</p>
        </div>` : ""}
        <p class="se-drill-links">
          <a href="${agHref}">Агентство в цифрах →</a>
          <a href="backlog.html?q=${encodeURIComponent(a.name)}">Задачи в бэклоге →</a>
        </p>
      </div>
    </td></tr>`;
  }

  // ---------------------------------------------------------- B6 теплокарта
  function renderHeat(M) {
    const host = document.querySelector("[data-se-heat]");
    if (!host) return;
    const b = X.b6 || {};
    const isCost = state.heat === "cost";
    const cell = (a, i) => {
      const calls = (a.series.calls || [])[i];
      const ops = (a.series.ops || [])[i];
      const cost = (a.series.supportCost || [])[i];
      if (!ops && !calls) return { v: null };
      const v = isCost ? cost : (ops ? (calls || 0) / ops * 1000 : null);
      return { v, calls, ops, cost };
    };
    const all = [];
    M.agencies.forEach((a) => mKeys.forEach((_, i) => {
      const c = cell(a, i);
      if (c.v != null) all.push(c.v);
    }));
    all.sort((x, y) => x - y);
    const max = all.length ? all[all.length - 1] : 1;
    // Уровни режем по квинтилям, а не равными долями от максимума. Максимум
    // здесь — выброс (2 000 обращений на 1000 транзакций у агентства с двумя
    // транзакциями за месяц), и на равной шкале 179 клеток из 182 попадали
    // в самый светлый уровень: карта была одноцветной и не читалась.
    const q = (p) => (all.length ? all[Math.min(all.length - 1, Math.floor(all.length * p))] : 0);
    const cuts = [q(0.2), q(0.4), q(0.6), q(0.8)];
    const lvl = (v) => {
      if (v == null) return -1;
      let l = 0;
      while (l < 4 && v >= cuts[l]) l++;
      return l;
    };
    const fmtV = (v) => (isCost ? seMoney(v) : seNum(v, 0));
    // В подписях шкалы единица названа один раз слева, поэтому «₽» у каждой
    // границы убираем — иначе «8 018 ₽–17 тыс ₽» занимает полстроки.
    const fmtCut = (v) => (isCost ? seMoney(v).replace(SE_NB + "₽", "") : seNum(v, 0));
    // Подпись под каждым квадратом шкалы: без границ «темнее = больше» — пустое
    // обещание, по нему нельзя перевести цвет обратно в число.
    const scaleLabels = [
      "до " + fmtCut(cuts[0]),
      fmtCut(cuts[0]) + "–" + fmtCut(cuts[1]),
      fmtCut(cuts[1]) + "–" + fmtCut(cuts[2]),
      fmtCut(cuts[2]) + "–" + fmtCut(cuts[3]),
      "от " + fmtCut(cuts[3]),
    ];

    const rows = M.agencies.map((a) => `
      <tr>
        <th class="title">${esc(a.name)}</th>
        ${mKeys.map((mk, i) => {
          const c = cell(a, i);
          const l = lvl(c.v);
          const tip = c.v == null
            ? `<b>${esc(a.name)}</b><br>${esc(seMonLong(mk))}<br>ни транзакций, ни обращений`
            : `<b>${esc(a.name)}</b> · ${esc(seMonLong(mk))}<br>`
              + `обращений ${seNum(c.calls)} · транзакций ${seNum(c.ops)}<br>`
              + `${isCost ? "стоимость " + seMoney(c.cost, true) : seNum(c.v, 1) + " на 1000 транзакций"}`;
          return `<td class="se-cell se-l${l}${state.mm === mk ? " is-col" : ""}"
            data-ag="${esc(a.name)}" data-m="${esc(mk)}" data-tip="${esc(tip)}">
            ${c.v == null ? "" : `<span>${isCost ? seMoney(c.cost) : seNum(c.v, 0)}</span>`}</td>`;
        }).join("")}
      </tr>`).join("");

    // 19 × 13 = 247 чисел на виду — это справочник для сверки конкретного
    // месяца, а не аргумент: вывод из карты уже сделан двумя блоками выше.
    // Наверху остаётся строка-вывод, сама карта — под раскрытием.
    host.innerHTML = `
      <p class="se-out">${esc(b.summaryLine || "")}</p>
      <details class="se-details se-details--app"${state.heatOpen ? " open" : ""} data-heatbox>
      <summary>${esc(b.openLabel || "Развернуть карту")}</summary>
      <p class="lede se-lede">${esc(b.lede || "")}</p>
      <div class="se-heat-ctl">
        <div class="se-segs">
          <button type="button" class="se-seg${!isCost ? " is-on" : ""}" data-heat="ratio">На 1000 транзакций</button>
          <button type="button" class="se-seg${isCost ? " is-on" : ""}" data-heat="cost">Стоимость, ₽</button>
        </div>
        <div class="se-scale" role="img"
          aria-label="Шкала: пять уровней по ${esc(isCost ? "стоимости поддержки за месяц" : "обращениям на 1000 транзакций")}, границы ${esc(scaleLabels.join(", "))}">
          <span class="se-scale-l">${isCost ? "₽ за месяц" : "на 1000 транзакций"}</span>
          ${[0, 1, 2, 3, 4].map((l) => `<span class="se-scale-i"><i class="se-l${l}"></i><b>${esc(scaleLabels[l])}</b></span>`).join("")}
        </div>
      </div>
      <div class="table-wrap">
        <table class="se-tbl se-heat">
          <thead><tr><th class="title">Агентство</th>${mKeys.map((mk) => `<th class="num">${seMon(mk)}</th>`).join("")}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="se-foot">${esc(b.emptyNote || "")}
        ${isCost
          ? `Верх шкалы — ${fmtV(max)} за месяц.`
          : `Верх шкалы — выброс: ${fmtV(max)} у агентства с единичными транзакциями за месяц.`}
        Уровни нарезаны по равным долям клеток, а не по равным долям максимума:
        иначе одно крайнее значение забирает всю шкалу и карта выходит одноцветной.</p>
      </details>
      ${seUp("pomesyachno")}`;

    const box = host.querySelector("[data-heatbox]");
    if (box) box.addEventListener("toggle", () => { state.heatOpen = box.open; });
    host.querySelectorAll("[data-heat]").forEach((btn) => {
      btn.addEventListener("click", () => { state.heat = btn.dataset.heat; renderHeat(M); writeState(); });
    });
    host.querySelectorAll(".se-cell").forEach((td) => {
      td.addEventListener("click", () => {
        state.ag = td.dataset.ag;
        state.mm = td.dataset.m;
        renderAll();
        document.querySelector(`.se-row[data-ag="${CSS.escape(td.dataset.ag)}"]`)
          ?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    });
    wireTips(host);
  }

  // -------------------------------------------------- B6a потолок эффекта
  function renderSupplier() {
    const host = document.querySelector("[data-se-supplier]");
    if (!host) return;
    const b = X.b6a || {}, S = D.supplier;
    if (!S) { host.innerHTML = `<p class="muted">Выгрузка обращений недоступна.</p>`; return; }
    const th = b.thresholds || { supplier: 0.25, partial: 0.1 };
    const cls = (share) => (share >= th.supplier ? "supp" : share >= th.partial ? "part" : "own");
    const CLS_CSS = { own: "good", part: "mid", supp: "bad" };

    const buckets = { own: 0, part: 0, supp: 0 };
    (S.byTheme || []).forEach((t) => { buckets[cls(t.share)] += t.total; });
    const tot = buckets.own + buckets.part + buckets.supp;
    // Последнюю долю берём остатком, а не округляем независимо: три округления
    // вверх дают «101%», и читатель справедливо решает, что где-то ошибка.
    const pOwn = tot ? Math.round((buckets.own / tot) * 100) : 0;
    const pPart = tot ? Math.round((buckets.part / tot) * 100) : 0;
    const shares = { own: pOwn, part: pPart, supp: Math.max(0, 100 - pOwn - pPart) };
    const bp = (k) => shares[k];

    // Объём самой крупной темы — общий масштаб полосок во всех трёх колонках,
    // иначе колонки нельзя сравнивать между собой глазами.
    const themeMax = Math.max(1, ...(S.byTheme || []).map((t) => t.total || 0));
    // Колонок три, по одной на класс. Раньше рисовались две — «наружу» (3 темы)
    // и «у нас» (29 тем): половина ширины пустовала, а «частично» из чипов
    // наверху вообще не имела списка.
    const themeList = (pick, head, mod, limit = 9) => {
      const items = (S.byTheme || []).filter((t) => pick.includes(cls(t.share)))
        .sort((a, b2) => b2.total - a.total);
      const li = (t) => `<li>
        <span class="se-theme-n">${esc(t.level2 === "—" ? t.level1 : t.level2)}</span>
        <span class="se-theme-v">${seNum(t.total)}${t.share >= th.partial ? ` · наружу ${sePct(t.share, 0)}` : ""}</span>
        <span class="se-theme-bar"><i class="se-theme-bar--${mod}" style="width:${((t.total / themeMax) * 100).toFixed(1)}%"></i></span>
      </li>`;
      const head9 = items.slice(0, limit), rest = items.slice(limit);
      const calls = items.reduce((s2, t) => s2 + (t.total || 0), 0);
      return `<div class="se-col">
        <h4 class="se-col-h se-col-h--${mod}">${esc(head)}<span>${items.length} ${sePlural(items.length, "тема", "темы", "тем")} · ${seNum(calls)} ${sePlural(calls, "обращение", "обращения", "обращений")}</span></h4>
        <ul class="se-theme-list">${head9.map(li).join("")}</ul>
        ${rest.length ? `<details class="se-details se-details--app se-details--tight">
          <summary>ещё ${seNum(rest.length)} ${sePlural(rest.length, "тема", "темы", "тем")} помельче</summary>
          <ul class="se-theme-list">${rest.map(li).join("")}</ul>
        </details>` : ""}
      </div>`;
    };

    const u = S.unattributed || {};
    // Один знаменатель на весь блок: 6 256 обращений за 12 месяцев выгрузки.
    // Раньше «10,3% наружу» и «19% в разработку» стояли рядом с «89,7%
    // остаются у нас» и читались как противоречие — доли считались от разных
    // оснований, а остаток объявлялся снимаемым продуктом.
    const pSupp = S.share || 0;
    const pEsc = S.total ? (S.escalations || 0) / S.total : 0;
    const pOwnFlow = Math.max(0, 1 - pSupp - pEsc);
    const seg = (w, cls, label, val) => `<span class="se-flow-i se-flow--${cls}" style="flex:${(w * 100).toFixed(2)}">
      <b>${sePct(val, 1)}</b><i>${esc(label)}</i></span>`;

    host.innerHTML = `
      <p class="lede se-lede">${esc(b.lede || "")}</p>
      ${seSub([
        { id: "potok", text: b.flowHead || "Куда уходит поток" },
        { id: "temy", text: "Разбор по темам" },
        { id: "po-agentstvam", text: "Зависимость по агентствам" },
      ])}
      <div class="ag-strip">
        <div class="ag-stat">
          <div class="v">${seNum(S.total)}</div>
          <div class="l">обращений — знаменатель всего блока</div>
          <div class="s">за ${seNum(S.monthsCovered)} месяцев выгрузки поддержки</div>
        </div>
        <div class="ag-stat">
          <div class="v">${sePct(pSupp)}</div>
          <div class="l">поддержка переадресует наружу</div>
          <div class="s">${seNum(S.toSupplier)} ${sePlural(S.toSupplier, "обращение", "обращения", "обращений")} — продуктом не снять</div>
        </div>
        <div class="ag-stat">
          <div class="v">${sePct(pEsc)}</div>
          <div class="l">уходит в разработку</div>
          <div class="s">${seNum(S.escalations)} ${sePlural(S.escalations, "обращение", "обращения", "обращений")} — снимается кодом, а не настройкой</div>
        </div>
      </div>
      <h3 class="se-h3" id="potok">${esc(b.flowHead || "Куда уходит поток")}</h3>
      <div class="se-flow" role="img" aria-label="Из ${seNum(S.total)} обращений: наружу ${sePct(pSupp)}, в разработку ${sePct(pEsc)}, остальное закрывает поддержка сама">
        ${seg(pSupp, "supp", b.flowSupp || "наружу", pSupp)}
        ${seg(pEsc, "esc", b.flowEsc || "в разработку", pEsc)}
        ${seg(pOwnFlow, "own", b.flowOwn || "закрыла сама", pOwnFlow)}
      </div>
      <p class="se-out">${esc(b.ceilingNote || "")}</p>
      <p class="se-foot">${esc((b.denomNote || "")
        .replace("{total}", seNum(S.total))
        .replace("{months}", seNum(S.monthsCovered))
        .replace("{calls13}", seNum(D.totals.calls)))}</p>
      <details class="se-details" id="temy">
        <summary>${esc(b.themesHead || "Разбор по темам")}</summary>
        <div class="se-ceil">
          <span class="sup-cls sup-cls--${CLS_CSS.own}">${bp("own")}% ${esc((b.classLabels || {}).own || "")}</span>
          <span class="sup-cls sup-cls--${CLS_CSS.part}">${bp("part")}% ${esc((b.classLabels || {}).part || "")}</span>
          <span class="sup-cls sup-cls--${CLS_CSS.supp}">${bp("supp")}% ${esc((b.classLabels || {}).supp || "")}</span>
        </div>
        <p class="se-foot">${esc(b.classNote || "")}</p>
        <div class="se-cols se-cols--3">
          ${themeList(["supp"], b.suppHead || "Упирается в поставщика", "bad")}
          ${themeList(["part"], b.partHead || "Частично зависит от поставщика", "mid")}
          ${themeList(["own"], b.ownHead || "Целиком в наших руках", "good")}
        </div>
        ${u.total ? `<p class="se-foot">${esc((b.unattributedNote || "")
          .replace("{n}", seNum(u.total))
          .replace("{pct}", sePct(u.shareOfFlow, 0))
          .replace("{share}", sePct(u.share, 0)))}</p>` : ""}
      </details>
      <details class="se-details se-details--app" id="po-agentstvam">
        <summary>Зависимость от поставщика по агентствам</summary>
        <div class="table-wrap">
          <table class="se-tbl">
            <thead><tr><th>Агентство</th><th class="num">Обращений за окно</th><th class="num">Наружу</th><th class="num">Доля</th></tr></thead>
            <tbody>${(S.byAgency || []).map((r) => `<tr>
              <td class="title">${esc(r.canon)}</td>
              <td class="num">${seNum(r.total)}</td>
              <td class="num">${seNum(r.toSupplier)}</td>
              <td class="num">${sePct(r.share, 0)}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      </details>`;
  }

  // ------------------------------------------------------- B7 рекомендации
  function renderActions() {
    const host = document.querySelector("[data-se-actions]");
    if (!host) return;
    const b = X.b7 || {};
    const PR = { "высокий": "high", "средний": "mid", "низкий": "low" };
    const card = (r) => `<article class="se-act se-act--${PR[r.prio] || "mid"}${r.special ? " is-special" : ""}">
      <div class="se-act-h">
        <span class="se-prio se-prio--${PR[r.prio] || "mid"}">${esc(r.prio || "")}</span>
      </div>
      <p class="se-act-w">${esc(r.what || "")}</p>
      <p class="se-act-e"><b>Что это даст.</b> ${esc(r.effect || "")}</p>
      ${r.backlogQuery ? `<p class="se-act-l"><a href="backlog.html?q=${encodeURIComponent(r.backlogQuery)}">Найти в бэклоге →</a></p>` : ""}
      ${r.special && b.specialNote ? `<p class="se-act-n">${esc(b.specialNote)}</p>` : ""}
    </article>`;
    // Двенадцать карточек подряд читаются как шум: «запросить выгрузку»
    // стоит рядом с «заложить план по людям» и весит столько же. На виду —
    // только высокий приоритет, остальное под одним раскрытием.
    const high = (arr) => (arr || []).filter((r) => r.prio === "высокий");
    const rest = (arr) => (arr || []).filter((r) => r.prio !== "высокий");
    const restCount = rest(b.manage).length + rest(b.product).length;
    const cols = (m, p) => `
      <div class="se-cols se-cols--acts">
        <div class="se-col">
          <h3 class="se-h3">${esc(b.manageHead || "")}</h3>
          ${m.map(card).join("")}
        </div>
        <div class="se-col">
          <h3 class="se-h3">${esc(b.productHead || "")}</h3>
          ${p.map(card).join("")}
        </div>
      </div>`;

    host.innerHTML = `
      ${b.lede ? `<p class="lede se-lede">${esc(b.lede)}</p>` : ""}
      ${cols(high(b.manage), high(b.product))}
      ${restCount ? `<details class="se-details">
        <summary>${esc((b.restHead || "ещё {n} решений").replace("{n}", String(restCount)))}</summary>
        ${cols(rest(b.manage), rest(b.product))}
      </details>` : ""}`;
  }

  // ----------------------------------------------------------- B8 методика
  function renderMethod() {
    const host = document.querySelector("[data-se-method]");
    if (!host) return;
    const b = X.b8 || {};
    const asm = D.meta.assumptions || [];
    const gaps = X.gaps || [];
    host.innerHTML = `
      <p class="lede se-lede">${esc(b.lede || "")}</p>
      ${seSub([
        { id: "dengi", text: (X.b2 || {}).head || "Деньги" },
        { id: "kak-schitali", text: b.methodHead || "Как считали" },
        { id: "ogranicheniya", text: b.limitsHead || "Ограничения" },
        { id: "riski", text: b.risksHead || "Риски" },
        { id: "ogovorki", text: asm.length ? "Оговорки из расчёта" : "" },
        { id: "chego-ne-hvataet", text: b.openHead || "Чего не хватает" },
      ])}
      <details class="se-details" id="kak-schitali" open>
        <summary>${esc(b.methodHead || "Как считали")}</summary>
        <ul class="se-method">${(b.method || []).map((m) => `<li>${m}</li>`).join("")}</ul>
        <p class="se-foot">Обращения агентств за окно — ${seNum(D.totals.calls)}, а всего специалисты закрыли
          ${seNum(D.totals.capacityTickets)} обращений. Разница — непрофильные:
          ${(D.capacityMix || []).map((c) => `${esc(c.name.toLowerCase())} ${seNum(c.total)}`).join(", ")}.</p>
      </details>
      <details class="se-details" id="ogranicheniya">
        <summary>${esc(b.limitsHead || "Ограничения")}</summary>
        <ul class="se-limits">${(b.limits || []).map((l) =>
          `<li><b>${esc(l.what)}.</b> ${esc(l.text)}</li>`).join("")}</ul>
      </details>
      <details class="se-details" id="riski">
        <summary>${esc(b.risksHead || "Риски")}</summary>
        <ul class="se-limits">${(b.risks || []).map((l) =>
          `<li><b>${esc(l.what)}.</b> ${esc(l.text)}</li>`).join("")}</ul>
      </details>
      ${asm.length ? `<details class="se-details" id="ogovorki">
        <summary>${esc(b.sourceCaveatsHead || "Оговорки из расчёта")}</summary>
        <p class="se-foot">${esc(b.sourceCaveatsNote || "")}</p>
        <ul class="se-limits">${asm.map((a) =>
          `<li><b>${esc(a.what)}</b> — ${esc(a.note)}</li>`).join("")}</ul>
      </details>` : ""}
      <details class="se-details" id="chego-ne-hvataet">
        <summary>${esc(b.openHead || "Чего не хватает")}</summary>
        <ul class="se-limits">${(b.open || []).map((o) => `<li>${esc(o)}</li>`).join("")}</ul>
        ${gaps.length ? `<h4 class="se-h4">Что ушло с прежней версии страницы</h4>
          <ul class="se-limits">${gaps.map((g) =>
            `<li><b>${esc(g.what)}.</b> ${esc(g.text)}</li>`).join("")}</ul>` : ""}
      </details>
      ${seUp("znamenatel")}`;
  }

  // ------------------------------------------------------------- B9 подвал
  function renderFootData() {
    const host = document.querySelector("[data-se-footdata]");
    if (!host) return;
    const b = X.b9 || {};
    const S = D.supplier || {};
    // Имена исходных файлов анализа в видимый текст не выносим — только вывод
    // и период. Происхождение файлов видно в плашке свежести из манифеста.
    host.innerHTML = `<div class="se-footdata">
      <p><b>${esc(b.windowNote || "")}</b> ${esc(b.refreshNote || "")}</p>
      <p>Обращения в расчёте — по ${seNum(D.meta.months)} месяцам;
        выгрузка поддержки покрывает ${seNum(S.monthsCovered)} из них${S.windowFact ? ` (${esc(S.windowFact)})` : ""}.
        Зарплата специалиста в опорном расчёте — ${seMoney(D.meta.fotBase, true)} в месяц,
        специалистов ${seNum(D.meta.staff)}.</p>
    </div>`;
  }

  // ------------------------------------------------------------------ сборка
  function renderAll() {
    const M = derive();
    renderSummary(M);
    renderControls(M);
    renderMoney(M);
    renderCapacity();
    renderWho(M);
    renderTable(M);
    renderHeat(M);
    renderSupplier();
    renderActions();
    renderMethod();
    renderFootData();
    writeState();
  }
  renderAll();
  seNav();

  // Оглавление страницы и номера у заголовков. Строятся из самих h2:
  // отдельный список в разметке разошёлся бы с ними при первой же правке.
  // Страница длинная — восемь блоков и полтора десятка раскрытий, — и до сих
  // пор в ней негде было понять, где ты находишься и сколько осталось.
  function seNav() {
    const nav = document.querySelector("[data-se-toc]");
    if (!nav) return;
    const heads = [...document.querySelectorAll(".se-body h2[id]")];
    // Первый экран номера не получает: он не раздел, а сводка всех остальных.
    // В оглавлении — короткая подпись из data-nav, в заголовке остаётся полная
    // фраза. С полными восемь пунктов дают 1490px при колонке 1232, то есть
    // половина разделов сразу уезжает за горизонтальную прокрутку.
    const items = [{ id: "glavnoe", text: "Главное", n: "" }].concat(
      heads.map((h, i) => ({
        id: h.id, n: String(i + 1), el: h,
        text: (h.dataset.nav || h.textContent).trim(),
      })));

    items.forEach((it) => {
      if (!it.el) return;
      const num = document.createElement("span");
      num.className = "se-num";
      num.setAttribute("aria-hidden", "true");
      num.textContent = it.n;
      it.el.prepend(num);
    });

    nav.innerHTML = items.map((it) =>
      `<a href="#${esc(it.id)}" data-toc="${esc(it.id)}">
         <span class="se-toc-n" aria-hidden="true">${esc(it.n || "·")}</span>
         <span>${esc(it.text)}</span></a>`).join("");

    // Высоты липких слоёв — в переменные: от них считаются и позиция панели
    // управления, и отступ прокрутки у якорей. Захардкоженные значения
    // разъехались бы при любой правке шапки сайта.
    const measure = () => {
      const hdr = document.querySelector(".site-header");
      const R = document.documentElement.style;
      R.setProperty("--se-hdr", (hdr ? hdr.offsetHeight : 52) + "px");
      R.setProperty("--se-toc", nav.offsetHeight + "px");
    };

    const links = new Map();
    nav.querySelectorAll("a").forEach((a) => links.set(a.dataset.toc, a));
    let cur = null;
    // Активен последний заголовок, ушедший под липкие слои. Считаем по позиции,
    // а не наблюдателем пересечений: блоки здесь очень разной высоты, и порог
    // видимости у теплокарты и у строки-вывода означал бы разное.
    const sync = () => {
      const edge = nav.getBoundingClientRect().bottom + 8;
      let on = items[0].id;
      items.forEach((it) => {
        const el = document.getElementById(it.id);
        if (el && el.getBoundingClientRect().top <= edge) on = it.id;
      });
      if (on === cur) return;
      const first = cur === null;
      cur = on;
      links.forEach((a, id) => a.classList.toggle("is-on", id === on));
      // Дотягиваем активный пункт в видимую часть оглавления, если оно
      // прокручено вбок. Двигаем scrollLeft руками: scrollIntoView увёл бы
      // заодно и вертикальную прокрутку страницы. На первом вызове не трогаем
      // вовсе — иначе оглавление стартовало сдвинутым и обрезало «Главное».
      const a = links.get(on);
      if (first || !a) return;
      const box = nav.getBoundingClientRect(), r = a.getBoundingClientRect();
      if (r.left < box.left) nav.scrollLeft += r.left - box.left - 12;
      else if (r.right > box.right) nav.scrollLeft += r.right - box.right + 12;
    };

    measure();
    sync();
    addEventListener("scroll", sync, { passive: true });
    addEventListener("resize", () => { measure(); sync(); }, { passive: true });
  }

  // Ссылка на свёрнутую часть должна приводить в раскрытую часть, а не к
  // закрытому заголовку: иначе читатель видит строку вместо обещанного разбора.
  // Касается и «разбор →» с первого экрана, и чипов навигации внутри блоков.
  // Денежный блок разворачивается через состояние страницы (оно уезжает в
  // ссылке), остальным достаточно открыть сам <details> и всех его предков.
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href").slice(1);
    if (!id) return;
    if (id === "dengi") {
      if (!state.money) { state.money = true; renderMoney(derive()); writeState(); }
      return;
    }
    const t = document.getElementById(id);
    if (!t) return;
    let d = t.tagName === "DETAILS" ? t : t.closest("details");
    while (d) {
      d.open = true;
      d = d.parentElement ? d.parentElement.closest("details") : null;
    }
  });
}

// ===================== Этапы ценности (etapy.html) =====================
// Объединённая проекция: путь агентства (5 этапов) + концепции как слой над ними.

async function mountEtapy() {
  const host = document.querySelector("[data-etapy]");
  if (!host) return;
  host.innerHTML = `<div class="loading">Загрузка…</div>`;
  let data;
  try { data = await loadJSON("data/etapy.json"); }
  catch (e) { host.innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }

  const hLink = (code, title) => `<a class="e-hcode" href="backlog.html?q=${encodeURIComponent(code)}"${title ? ` title="${esc(title)}"` : ""}>${esc(code)}</a>`;

  // Якорь карточки гипотезы для прямых/обратных ссылок: «H1.1»→«h1-1», «H2.1-доп»→«h2-1-доп».
  const hypId = (code) => "h" + String(code).replace(/^H/i, "").toLowerCase().replace(/[.\s]+/g, "-").replace(/^-|-$/g, "");

  // Чип-доказательство (ТЗ 15): kind → цель ссылки; статус → знак/цвет канона .ev-chip (ТЗ 14).
  const EV_HREF = {
    research: (r) => `research.html#${findingAnchor(r)}`,
    sootv: (r) => `sootvetstvie.html#${r}`,
    planned: (r) => `planned.html#${r}`,
    agencies: (r) => `agencies.html#${r}`,
    support: (r) => (r ? `support.html#${r}` : "support.html"),
    rynok: (r) => `rynok.html#${r}`,
  };
  function evidenceChips(arr) {
    if (!(arr || []).length) return "";
    const chips = arr.map((e) => {
      const c = evChip(e.status);
      const body = `${c.sign} ${esc(e.label)}`;
      if (e.kind === "doc" || !EV_HREF[e.kind]) {
        return `<span class="ev-chip ${c.cls}" title="источник без отдельной страницы">${body}</span>`;
      }
      return `<a class="ev-chip ${c.cls}" href="${EV_HREF[e.kind](e.ref)}">${body}</a>`;
    }).join(" ");
    return `<div class="e-hyp__ev"><span class="e-hyp__evh">Доказательства</span><div class="e-hyp__evchips">${chips}</div></div>`;
  }

  // ——— Врезка «Через призму NMT» (свёрнутая, ✅ подтверждает / ⚠️ оспаривает / 👁 наблюдение) ———
  const NMT_CLS = { "✅": "ok", "⚠️": "warn", "👁": "eye" };
  function nmtLens(arr) {
    if (!(arr || []).length) return "";
    const items = arr.map((x) =>
      `<li class="e-nmt__it e-nmt__it--${NMT_CLS[x.mark] || "eye"}"><span class="e-nmt__m" aria-hidden="true">${esc(x.mark)}</span><span>${gloss(esc(x.text))}</span></li>`
    ).join("");
    return `<details class="e-nmt">
      <summary class="e-nmt__sum">👁 Через призму NMT</summary>
      <ul class="e-nmt__list">${items}</ul>
    </details>`;
  }

  // ——— Верхний блок «Рамка v5» (сверка с NMT и стратегией) ———
  function frameworkBlock() {
    const f = data.framework;
    if (!f) return "";
    const li = (arr) => (arr || []).map((x) => `<li>${gloss(esc(x))}</li>`).join("");
    const funnelSteps = (f.funnel.steps || []).map((s) => `<span class="e-fun__step">${esc(s)}</span>`).join('<span class="e-fun__arr" aria-hidden="true">→</span>');
    const tracks = (f.tracks.items || []).map((t) => `
      <div class="e-trk">
        <div class="e-trk__name">${esc(t.name)}</div>
        <div class="e-trk__body">${gloss(esc(t.body))}</div>
        <div class="e-trk__owner">владелец: <b>${esc(t.owner)}</b></div>
      </div>`).join("");
    const divRows = (f.divergences || []).map((d) => `
      <tr><td class="e-div__c">${esc(d.code)}</td>
      <td>${gloss(esc(d.v51))}</td><td>${gloss(esc(d.nmt))}</td>
      <td class="e-div__t">${esc(d.type)}</td></tr>`).join("");
    const porter = (f.porter || []).map((p) => `
      <div class="e-por"><div class="e-por__h"><span class="e-por__c">${esc(p.code)}</span> ${esc(p.title)}</div>
      <p>${gloss(esc(p.body))}</p></div>`).join("");
    const fixRows = (arr) => (arr || []).map((x) =>
      `<tr><td class="e-fix__n">${esc(x.n)}</td><td>${gloss(esc(x.what))}</td><td class="e-fix__w">${esc(x.where)}</td><td class="e-fix__t">${esc(x.type)}</td></tr>`).join("");
    return `
    <section class="e-frame">
      <h3 class="e-h3">${esc(f.title)}</h3>
      <p class="e-frame__intro">${gloss(esc(f.intro))}</p>
      ${f.plain ? `<p class="e-frame__plain"><span aria-hidden="true">🗣</span> ${gloss(esc(f.plain))}</p>` : ""}
      <div class="e-frame__grid">
        <details class="e-fold"><summary>Что подтвердилось (менять нечего)</summary><ul class="e-frame__ok">${li(f.confirmed)}</ul></details>
        <details class="e-fold"><summary>${esc(f.funnel.title)}</summary>
          <div class="e-fun">${funnelSteps}</div>
          <p class="e-note">${gloss(esc(f.funnel.note))}</p></details>
        <details class="e-fold"><summary>${esc(f.tracks.title)}</summary>
          <div class="e-trks">${tracks}</div>
          <p class="e-note">${gloss(esc(f.tracks.note))}</p></details>
        <details class="e-fold"><summary>Расхождения рамки (B1–B7)</summary>
          <div class="table-wrap"><table class="e-table"><thead><tr><th>#</th><th>Что в v5.1</th><th>Что говорит NMT</th><th>Тип</th></tr></thead><tbody>${divRows}</tbody></table></div></details>
        <details class="e-fold"><summary>Слой Портера (П1–П5)</summary><div class="e-pors">${porter}</div></details>
        <details class="e-fold"><summary>Что править: 7 правок NMT + 5 Портера</summary>
          <div class="table-wrap"><table class="e-table"><thead><tr><th>#</th><th>Что</th><th>Где</th><th>Тип</th></tr></thead><tbody>${fixRows(f.fixes.nmt)}${fixRows(f.fixes.porter)}</tbody></table></div>
          <p class="e-note">${gloss(esc(f.fixes.note))}</p></details>
      </div>
    </section>`;
  }

  // ——— Краткий обзор сверху ———
  // Цвет этапа — категориальный канон v4 (1=cat-1, 2=cat-3, 3–5=muted), просто опознавание этапа.
  const stageChip = (n) => `<span class="stage-tag s-${n === "2" ? "2a" : n}">${esc(n)}</span>`;
  const prismRows = (data.prism.rows || []).map((r) => `
    <tr>
      <td class="e-pr-n">${stageChip(r.stage)} ${esc(r.name)}</td>
      <td>${gloss(esc(r.phase))}</td>
      <td>${esc(r.question)}</td>
    </tr>`).join("");
  const prismCaveats = (data.prism.caveats || []).map((c) => `<li>${gloss(esc(c))}</li>`).join("");
  const leadsItems = (data.leadsTo.items || []).map((x) => `<li>${gloss(esc(x))}</li>`).join("");

  const overview = `
    <section class="e-over">
      <h3 class="e-h3">5 этапов пути — коротко</h3>
      <div class="table-wrap">
        <table class="e-table e-prism">
          <thead><tr><th>Этап</th><th>Участок CJM</th><th>Что спрашивает у Ракеты</th></tr></thead>
          <tbody>${prismRows}</tbody>
        </table>
      </div>
      <ul class="e-caveat-list">${prismCaveats}</ul>

      <details class="e-extra"><summary>Что внутри каждого этапа</summary>
        <p class="e-flow-intro">Разверните любой этап ниже — структура одинаковая:</p>
        <ul class="e-flow">
          <li><b>Фаза агентства</b> — кто это и что у него болит.</li>
          <li><b>Цель этапа</b> — что должно измениться.</li>
          <li><b>Гипотезы</b> — предположения вида «если сделаем X, то изменится Y». Клик по гипотезе раскрывает, как мы это проверяем.</li>
          <li><b>Задачи</b> — какие пункты бэклога этим занимаются.</li>
          <li><b>Исследования</b> — что уже знаем и что ещё надо выяснить.</li>
          <li><b>Метрики</b> — чем измеряем и когда считаем этап пройденным.</li>
        </ul>
      </details>

      <details class="e-extra"><summary>Зачем это направление</summary>
        <ul class="e-leads">${leadsItems}</ul>
        ${data.leadsTo.note ? `<p class="e-note">${gloss(esc(data.leadsTo.note))}</p>` : ""}
      </details>
    </section>`;

  // ——— Карточка гипотезы (раскрытие по клику) ———
  function hypCard(h) {
    const typeCls = h.candidate ? "is-cand" : (String(h.type).startsWith("ориент") ? "is-orient" : "is-feat");
    const dec = h.decision ? `<span class="e-hyp__dec">${esc(h.decision)}</span>` : "";
    const probs = (h.problem || []).map((p) => `<li>${gloss(esc(p))}</li>`).join("");
    const row = (l, v) => v ? `<div class="e-hyp__row"><dt>${l}</dt><dd>${gloss(esc(v))}</dd></div>` : "";
    return `
      <details class="e-hyp ${typeCls}" id="${hypId(h.code)}">
        <summary class="e-hyp__sum">
          ${hLink(h.code, h.title)}
          <span class="e-hyp__title">${gloss(esc(h.title))}</span>
          <span class="e-hyp__type">${esc(h.type)}</span>
          ${h.candidate ? `<span class="e-hyp__cand">кандидат</span>` : ""}
        </summary>
        <div class="e-hyp__body">
          ${(h.if || h.then) ? `<p class="e-hyp__ift"><b>Если</b> ${gloss(esc(h.if))} <b>то</b> ${gloss(esc(h.then))}</p>` : ""}
          ${probs ? `<div class="e-hyp__prob"><span class="e-hyp__lh">Проблема</span><ul>${probs}</ul></div>` : ""}
          ${evidenceChips(h.evidence)}
          <dl class="e-hyp__dl">
            ${row("Цепочка", h.chain)}
            ${row("Подтвердится, если", h.confirm)}
            ${row("Не подтвердится, если", h.deny)}
            ${row("Проверяем", h.check)}
            ${row("Статус решения", h.decision)}
            ${row("По исследованиям (пояснение)", h.research)}
          </dl>
          ${h.note ? `<p class="e-hyp__note">${gloss(esc(h.note))}</p>` : ""}
        </div>
      </details>`;
  }

  function hypotheses(s) {
    if (s.hypGroups && s.hypGroups.length) {
      return s.hypGroups.map((g) => {
        const code = (g.label.match(/2[AB]/) || [""])[0];
        const list = (s.hypotheses || []).filter((h) => (h.group || "") === code);
        return `<div class="e-hgrp"><div class="e-hgrp__h">${esc(g.label)}</div>${list.map(hypCard).join("")}</div>`;
      }).join("");
    }
    return (s.hypotheses || []).map(hypCard).join("");
  }

  // ——— Таблицы задач / исследований ———
  // Темы, совпадающие с темами бэклога, → ссылка на отфильтрованный бэклог; служебные («(нет владельца)» и т.п.) — текстом.
  const BACKLOG_THEMES = new Set(["Онлайн-услуги", "Агентская админка", "Заказы", "Оффлайн 4.0", "Единый чат", "Сервис для клиента", "Предложения 2.0"]);
  const themeCell = (theme) => BACKLOG_THEMES.has(theme)
    ? `<a class="tlink" href="backlog.html?theme=${encodeURIComponent(theme)}">${esc(theme)}</a>`
    : esc(theme);
  function tasksTable(s) {
    if (!(s.tasks || []).length) return "";
    const hasStatus = s.tasks.some((t) => t.status);
    const head = `<tr><th>Тема</th><th>Ключевые итерации</th><th>Гипотеза</th>${hasStatus ? "<th>Статус</th>" : ""}</tr>`;
    const rows = s.tasks.map((t) => `<tr>
      <td>${themeCell(t.theme)}</td><td>${gloss(esc(t.iters))}</td><td>${esc(t.hyp || "—")}</td>
      ${hasStatus ? `<td>${esc(t.status || "")}</td>` : ""}</tr>`).join("");
    return `
      <div class="e-sub"><span class="e-sub__h">Задачи (проверяют гипотезы)</span>
        <div class="table-wrap"><table class="e-table">${`<thead>${head}</thead>`}<tbody>${rows}</tbody></table></div>
        ${s.tasksNote ? `<p class="e-note">${esc(s.tasksNote)}</p>` : ""}
      </div>`;
  }

  function research(s) {
    // Источник исследования → Исследования по этому этапу (этап 2 раскрывается в 2A,2B), по аналогии с колонкой «Тема».
    const rStage = s.n === "2" ? "2A,2B" : s.n;
    const srcCell = (src) => `<a class="tlink" href="research.html?stage=${encodeURIComponent(rStage)}">${esc(src)}</a>`;
    const done = (s.researchDone || []).map((r) => `<tr><td>${srcCell(r.src)}</td><td>${gloss(esc(r.note))}</td></tr>`).join("");
    const todo = (s.researchTodo || []).map((r) => {
      const how = r.planned ? `<a href="planned.html#${esc(r.planned)}">${esc(r.how)} →</a>` : esc(r.how);
      return `<tr><td>${gloss(esc(r.unclear))}</td><td>${how}</td><td><span class="e-rstat">${esc(r.status)}</span></td></tr>`;
    }).join("");
    if (!done && !todo) return "";
    return `
      <div class="e-sub"><span class="e-sub__h">Исследования</span>
        ${done ? `<div class="table-wrap"><table class="e-table"><thead><tr><th>Сделано — что знаем</th><th>Вывод</th></tr></thead><tbody>${done}</tbody></table></div>` : ""}
        ${todo ? `<div class="table-wrap"><table class="e-table"><thead><tr><th>Что неясно</th><th>Чем закрыть</th><th>Статус</th></tr></thead><tbody>${todo}</tbody></table></div>` : ""}
      </div>`;
  }

  const mChip = (m) => `<span class="lad-m">${gloss(esc(m))}</span>`;
  function metrics(s) {
    const a = (s.metricsActive || []).length ? `<div><span class="lad-mh act">Активные</span> ${s.metricsActive.map(mChip).join(" ")}</div>` : "";
    const t = (s.metricsTarget || []).length ? `<div><span class="lad-mh tgt">Целевые</span> ${s.metricsTarget.map(mChip).join(" ")}</div>` : "";
    return `
      <div class="e-sub"><span class="e-sub__h">Метрики и критерий перехода</span>
        ${s.metricsNote ? `<p class="e-muted">${gloss(esc(s.metricsNote))}</p>` : ""}
        <div class="lad-metrics">${a}${t}</div>
        ${s.criterion ? `<p class="e-crit">${gloss(esc(s.criterion))}</p>` : ""}
      </div>`;
  }

  function stage(s) {
    const subs = (s.subgoals || []).map((x) => `<li>${gloss(esc(x))}</li>`).join("");
    const mechs = (s.mechanisms || []).length
      ? `<div class="e-sub"><span class="e-sub__h">Механизмы (для рассказа стейкхолдерам)</span><ol class="e-mechs">${s.mechanisms.map((m) => `<li>${gloss(esc(m))}</li>`).join("")}</ol></div>`
      : "";
    return `
      <details class="e-stage" id="stage-${esc(s.n)}" data-stage="${esc(s.n)}">
        <summary class="e-stage__sum">
          <span class="e-stage__n">${esc(s.n)}</span>
          <span class="e-stage__name">${esc(s.name)}</span>
          <span class="e-stage__mean">${gloss(esc(s.meaning))}</span>
        </summary>
        <div class="e-stage__body">
          ${s.sootv ? `<div class="e-evlink"><a href="sootvetstvie.html#${esc(s.sootv)}">Доказательная база этапа →</a> <a href="research.html?stage=${esc(s.n === "2" ? "2A,2B" : s.n)}">Все находки этапа →</a></div>` : ""}
          <div class="e-sub"><span class="e-sub__h">Участок CJM агентства</span><p>${gloss(esc(s.phase))}</p></div>
          <div class="e-sub"><span class="e-sub__h">Цель этапа</span><p>${gloss(esc(s.goal))}</p>
            ${s.keyIdea ? `<p class="e-note">${gloss(esc(s.keyIdea))}</p>` : ""}</div>
          <div class="e-sub"><span class="e-sub__h">Подцели этапа</span><ul>${subs}</ul></div>
          <div class="e-sub"><span class="e-sub__h">Гипотезы</span>${hypotheses(s)}
            ${s.hypBundle ? `<p class="e-note">${gloss(esc(s.hypBundle))}</p>` : ""}
            ${s.removedCandidate ? `<p class="e-note e-note--del">${gloss(esc(s.removedCandidate))}</p>` : ""}</div>
          ${mechs}
          ${tasksTable(s)}
          ${research(s)}
          ${metrics(s)}
          ${nmtLens(s.nmtLens)}
        </div>
      </details>`;
  }

  // ——— Сквозной слой ———
  const cl = data.crossLayer || {};
  const churn = cl.churn ? `
    <details class="e-hyp is-orient">
      <summary class="e-hyp__sum">${hLink(cl.churn.code, cl.churn.title)}
        <span class="e-hyp__title">${gloss(esc(cl.churn.title))}</span>
        <span class="e-hyp__type">${esc(cl.churn.type)}</span></summary>
      <div class="e-hyp__body">
        <p class="e-hyp__ift"><b>Если</b> ${gloss(esc(cl.churn.if))} <b>то</b> ${gloss(esc(cl.churn.then))}</p>
        <dl class="e-hyp__dl">
          <div class="e-hyp__row"><dt>Проблема</dt><dd>${gloss(esc(cl.churn.problem))}</dd></div>
          <div class="e-hyp__row"><dt>Цепочка</dt><dd>${gloss(esc(cl.churn.chain))}</dd></div>
          <div class="e-hyp__row"><dt>Проверяем</dt><dd>${gloss(esc(cl.churn.check))}</dd></div>
          <div class="e-hyp__row"><dt>Статус решения</dt><dd>${esc(cl.churn.decision)}</dd></div>
        </dl>
        ${evidenceChips(cl.churn.evidence)}
      </div>
    </details>` : "";
  const rmap = (cl.researchMap || []).map((r) => {
    const study = r.href ? `<a href="${esc(r.href)}">${esc(r.study)}</a>` : esc(r.study);
    return `<tr><td>${study}</td><td><span class="e-rstat">${esc(r.status)}</span></td><td>${esc(r.stages)}</td></tr>`;
  }).join("");
  const crossLayer = `
    <h2 class="e-h2">${esc(cl.title || "Сквозной слой")}</h2>
    ${churn}
    ${nmtLens(cl.nmtLens)}
    ${cl.i0 ? `<p class="e-i0">${gloss(esc(cl.i0))}</p>` : ""}
    <div class="e-sub"><span class="e-sub__h">Сводная карта исследований → этапы</span>
      <p class="e-muted">Полная карта планируемых замеров со статусами и владельцами → <a href="planned.html">План исследований</a>.</p>
      <div class="table-wrap"><table class="e-table"><thead><tr><th>Исследование</th><th>Статус</th><th>Какие этапы кормит</th></tr></thead><tbody>${rmap}</tbody></table></div>
    </div>`;

  const caveats = (data.caveats || []).map((c) => `
    <div class="lad-caveat"><div class="lad-caveat__h">${esc(c.title)}</div><p>${gloss(esc(c.text))}</p></div>`).join("");

  host.innerHTML = `
    ${overview}
    ${frameworkBlock()}
    <div class="lad-controls">
      <button type="button" class="btn" data-e-expand>Раскрыть все этапы</button>
      <button type="button" class="btn" data-e-collapse>Свернуть все</button>
      <span class="result-meta">источник: ${esc(data.source)} v${esc(data.version)}</span>
    </div>
    <div class="e-stages">${(data.stages || []).map(stage).join("")}</div>
    ${crossLayer}
    <h2 class="e-h2">Методологические оговорки</h2>
    ${caveats}`;

  const all = () => host.querySelectorAll("details.e-stage");
  host.querySelector("[data-e-expand]").addEventListener("click", () => all().forEach((d) => (d.open = true)));
  host.querySelector("[data-e-collapse]").addEventListener("click", () => all().forEach((d) => (d.open = false)));

  // Доскролл к этапу/концепции, если пришли по ссылке etapy.html#stage-2 / #c1 и т.п.
  if (location.hash) {
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (el) {
      const det = el.closest("details");
      if (det) det.open = true;
      el.scrollIntoView({ block: "start" });
      el.classList.add("is-target");
    }
  }
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

// Канон «чип-доказательство» (.ev-chip) — единый язык статуса доказательства для ТЗ 14–18.
// Сводит статусы гипотез реестра и бейджи рынка к одной системе (не плодим третью).
function evChip(status) {
  const t = String(status || "").toLowerCase();
  // label — словесная расшифровка статуса для aria-label (ТЗ 04: статус не только цветом/знаком).
  if (t.startsWith("закрыто") || t.startsWith("✅")) return { cls: "ev-closed", sign: "✅", label: "закрыто" };
  if (t.startsWith("подтв")) return { cls: "ev-ok", sign: "✓", label: "подтверждено" };
  if (t.startsWith("частично")) return { cls: "ev-part", sign: "~", label: "частично" };
  if (t.startsWith("опров")) return { cls: "ev-warn", sign: "⚠", label: "опровергнута" };
  if (t.startsWith("конкур") || t.startsWith("спорн") || t.includes("конфликт")) return { cls: "ev-warn", sign: "⚠", label: "конфликт" };
  if (t.startsWith("план") || t.includes("заплан")) return { cls: "ev-plan", sign: "?", label: "в плане" };
  if (t.startsWith("гипотеза") || t.startsWith("идея") || t.startsWith("данные") || t.includes("не пров")) return { cls: "ev-muted", sign: "∅", label: "не проверялась" };
  return { cls: "ev-muted", sign: "·", label: "статус не задан" };
}

// Канон якоря находки (зеркало research_anchor в build.py): «A1»→«f-a1», «4.2»→«f-4-2».
function findingAnchor(id) {
  return "f-" + String(id).trim().toLowerCase().replace(/[./\\]+/g, "-");
}

// Этап находки → якорь на странице «Этапы» (этапы 2A/2B ведут на общий #stage-2).
function stageAnchor(s) {
  const m = String(s).match(/\d+/);
  return m ? "stage-" + m[0] : null;
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
  // Этап и Гипотеза работают по массивам stages[]/hCodes[]; Блок синтеза — новый словарь-навигация.
  const FF = [["theme", "Тема"], ["role", "Роль"], ["block", "Блок синтеза"], ["stage", "Этап"], ["mechanism", "Механизм"], ["hCode", "Гипотеза"], ["hypStatus", "Статус гипотезы"]];

  // Значения находки по полю фильтра (массивные поля разворачиваются поэлементно).
  const fieldVals = (f, field) => {
    if (field === "stage") return (f.stages && f.stages.length) ? f.stages : ["вне этапов"];
    if (field === "hCode") return (f.hCodes && f.hCodes.length) ? f.hCodes : ["—"];
    if (field === "block") return [f.block || "—"];
    return [f[field] || "—"];
  };
  const matches = (f, field, v) => {
    if (!v) return true;
    const have = fieldVals(f, field);
    return v.split(",").some((w) => have.includes(w));   // ?stage=2A,2B — пересечение
  };

  const optsFor = (field) => {
    const c = new Map();
    all.forEach((x) => fieldVals(x, field).forEach((v) => c.set(v, (c.get(v) || 0) + 1)));
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  };

  function findingHTML(f) {
    const stageChips = (f.stages || []).filter((s) => s !== "вне этапов")
      .map((s) => `<span class="rf-chip">этап ${esc(s)}</span>`).join("");
    const ev = f.hypStatus ? evChip(f.hypStatus) : null;
    const chips = [
      f.role ? `<span class="rf-chip">${esc(f.role)}</span>` : "",
      f.reachCount ? `<span class="rf-chip" title="подтв. агентств">👥 ${esc(f.reachCount)}</span>` : "",
      (f.hCodes || []).map((h) => `<span class="rf-chip rf-h">${esc(h)}</span>`).join(""),
      f.block && f.block !== "—" ? `<span class="rf-chip" title="блок синтеза">блок ${esc(f.block)}</span>` : "",
      stageChips,
      ev ? `<span class="ev-chip ${ev.cls}">${ev.sign} ${esc(f.hypStatus)}</span>` : "",
    ].join("");
    const row = (l, v) => v && v !== "—" ? `<div class="rf-row"><dt>${esc(l)}</dt><dd>${esc(v)}</dd></div>` : "";

    // Обратные ссылки «находка → этап стратегии» (этапы 2A/2B → общий #stage-2, без дублей).
    const seen = new Set();
    const stageLinks = (f.stages || []).map((s) => {
      const a = stageAnchor(s);
      if (!a) return "";                                   // «клиент»/«вне этапов» — без якоря этапа
      const key = a + "|" + s;
      if (seen.has(key)) return ""; seen.add(key);
      return `<a class="rf-link" href="etapy.html#${a}">работает на этап ${esc(s)} →</a>`;
    }).join("");
    const hLinks = (f.hCodes || []).map((h) =>
      `<a class="rf-link" href="backlog.html?q=${encodeURIComponent(h)}">итерации по ${esc(h)} →</a>`).join("");
    // TODO (ТЗ 16): «строка в Доказательной базе →» — ссылка на sootvetstvie.html по коду боли.

    return `
      <details class="rf" id="${esc(f.anchor || findingAnchor(f.id || ""))}">
        <summary class="rf-sum">
          <span class="rf-id">${esc(f.id || "")}</span>
          <span class="rf-text">${esc(f.finding || "—")}</span>
          <span class="rf-chips">${chips}</span>
        </summary>
        <div class="rf-body"><dl>
          ${row("Кол. данные", f.qty)}${row("JTBD", f.jtbd)}${row("Reach (агентства)", f.reach)}
          ${row("Механизм", f.mechanism)}${row("Статус", f.status)}${row("Источник", f.src)}
        </dl>
        <div class="rf-links">${hLinks}${stageLinks}</div>
        </div>
      </details>`;
  }

  function render() {
    const list = all.filter((f) => FF.every(([field]) => matches(f, field, state.filters[field])));

    const map = new Map();
    list.forEach((f) => { const k = f[state.groupBy] || "—"; (map.get(k) || map.set(k, []).get(k)).push(f); });
    const groups = [...map.entries()].sort((a, b) => b[1].length - a[1].length);

    const groupsHTML = groups.map(([name, arr]) => `
      <details class="rg" open>
        <summary class="rg-sum"><span class="rg-name">${esc(name)}</span><span class="rg-count">${arr.length}</span></summary>
        <div class="rg-body">${arr.map(findingHTML).join("")}</div>
      </details>`).join("") || `<div class="empty">Ничего не найдено<span class="empty__hint">Измени или сбрось фильтры.</span></div>`;

    host.querySelector("[data-rg]").innerHTML = groupsHTML;
    host.querySelector("[data-rmeta]").textContent = `Показано ${list.length} из ${all.length}`;
  }

  const selects = FF.map(([field, label]) =>
    `<select class="ctl" data-rf="${field}" aria-label="${esc(label)}"><option value="">${esc(label)}: все</option>${optsFor(field).map(([v, c]) => `<option value="${esc(v)}">${esc(v)} (${c})</option>`).join("")}</select>`).join("");

  const confirmed = all.filter((f) => hypStatusClass(f.hypStatus) === "ok").length;
  const noStage = all.filter((f) => !f.stages || !f.stages.length || (f.stages.length === 1 && f.stages[0] === "вне этапов")).length;

  host.innerHTML = `
    <p class="rf-howto">
      У каждой находки есть <b>ID</b> (напр. <code>A1</code>, <code>4.2</code>) — на неё можно сослаться
      прямой ссылкой <code>research.html#f-a1</code> или <code>?id=A1</code>. Эти ссылки используются
      на странице «Этапы ценности» и в «Доказательной базе»: каждая находка знает, какой этап стратегии она кормит.
    </p>
    <div class="stats">
      <div class="stat"><div class="v">${all.length}</div><div class="l">находок</div></div>
      <div class="stat"><div class="v">${confirmed}</div><div class="l">подтв./закрыто</div></div>
      <div class="stat"><div class="v">${new Set(all.map((x) => x.theme).filter(Boolean)).size}</div><div class="l">тем</div></div>
      <div class="stat"><div class="v">${noStage}</div><div class="l">без этапа</div></div>
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

  // --- Deep-link фильтр этапа: ?stage=2A,2B (алиас ?stage=2 → 2A,2B) ---
  const params = new URLSearchParams(location.search);
  const stageParam = params.get("stage");
  if (stageParam) {
    const want = stageParam.split(",").map((s) => s.trim())
      .flatMap((s) => (s === "2" ? ["2A", "2B"] : [s]));
    state.filters.stage = want.join(",");
    const sel = host.querySelector('[data-rf="stage"]');
    if (sel && want.length === 1) sel.value = want[0];   // одиночный — отражаем в селекте
  }

  render();

  // --- Deep-link к находке: research.html#f-a1 или ?id=A1 ---
  const idParam = params.get("id");
  const targetAnchor = idParam ? findingAnchor(idParam)
    : (location.hash.startsWith("#f-") ? decodeURIComponent(location.hash.slice(1)) : null);
  if (targetAnchor) {
    const el = host.querySelector("#" + (window.CSS && CSS.escape ? CSS.escape(targetAnchor) : targetAnchor));
    if (el) {
      for (let p = el; p && p !== host; p = p.parentElement) {
        if (p.tagName === "DETAILS") p.open = true;
      }
      el.scrollIntoView({ block: "center" });
      el.classList.add("is-target");
    }
  }
}

// ===================== Доказательная база (sootvetstvie.html) =====================
function moscowClass(m) {
  const t = String(m || "").toLowerCase();
  if (t.startsWith("must")) return "mo-must";
  if (t.startsWith("should")) return "mo-should";
  if (t.startsWith("could")) return "mo-could";
  if (t.startsWith("won")) return "mo-wont";
  return "mo-neu";
}
// Код метрики из фразы матрицы «↓ Parity gap» → слаг для metrics.html#m-<slug> (как в mountMetrics).
function metricSlug(phrase) {
  return String(phrase).replace(/[↑↓~]/g, "").trim().toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-|-$/g, "");
}
// Код этапа из строки матрицы: «2A Сокращение…»→«2A», «1/2»→«1/2», «3 Сохранять…»→«3».
function sootvStageCode(s) {
  const m = String(s || "").match(/^[0-9]+[AB]?(?:\/[0-9]+)?/);
  return m ? m[0] : "—";
}

async function mountSootv() {
  const host = document.querySelector("[data-sootv]");
  if (!host) return;
  host.innerHTML = `<div class="loading">Загрузка доказательной базы…</div>`;
  let data, ex;
  try {
    [data, ex] = await Promise.all([loadJSON("data/sootv.json"), loadJSON("data/sootv_extra.json")]);
  } catch (e) { host.innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }

  const rows = data.rows || [];
  const state = { filters: {} };
  const FF = [["stageCode", "Этап"], ["hyp", "Гипотеза"], ["moscow", "MoSCoW"], ["hypStatus", "Статус гипотезы"], ["mechanism", "Механизм"], ["status", "Статус"]];

  const fieldVals = (r, field) => {
    if (field === "stageCode") return [sootvStageCode(r.stage)];
    if (field === "hyp") return (r.hyps && r.hyps.length) ? r.hyps : ["—"];
    return [r[field] || "—"];
  };
  const matches = (r, field, v) => !v || fieldVals(r, field).some((x) => v.split(",").includes(x));
  const optsFor = (field) => {
    const c = new Map();
    rows.forEach((r) => fieldVals(r, field).forEach((v) => c.set(v, (c.get(v) || 0) + 1)));
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  };

  const backlogQ = (q) => `backlog.html?q=${encodeURIComponent(q)}`;
  const hypChip = (h) => `<a class="rf-chip rf-h" href="${backlogQ(h)}">${esc(h)}</a>`;

  // ---- 1. Как читать (сворачиваемо) ----
  const hr = ex.howToRead || {};
  const statusRows = (hr.statuses || []).map((s) =>
    `<div class="sv-stdef"><span class="ev-chip ${evChip(s.key).cls}">${s.sign || evChip(s.key).sign} ${esc(s.key)}</span><span>${esc(s.def)}</span></div>`).join("");
  const howTo = `
    <details class="sv-howto">
      <summary>Как читать этот документ</summary>
      <div class="sv-howto__body">
        <p>${esc(hr.intro || "")}</p>
        <p class="sv-rule">${esc(hr.rule || "")}</p>
        <div class="sv-stdefs">${statusRows}</div>
        <p class="muted">${esc(hr.painCodes || "")}</p>
        <p class="muted">${esc(hr.moscow || "")} ${esc(hr.reach || "")}</p>
      </div>
    </details>`;

  // ---- 2. Сводная карта ----
  const sm = ex.summary || {};
  const smRows = (sm.rows || []).map((r) => {
    const sc = sootvStageCode(r.stage);
    const anch = sc.match(/\d+/) ? `etapy.html#stage-${sc.match(/\d+/)[0]}` : "etapy.html";
    return `<tr>
      <td><a href="${anch}">${esc(r.stage)}</a></td>
      <td>${(r.hyps || []).map(hypChip).join(" ")}</td>
      <td>${esc(r.painBlocks)}</td>
      <td>${esc(r.mechanisms)}</td>
      <td class="muted">${esc(r.files)}</td>
    </tr>`;
  }).join("");
  const summaryHTML = `
    <section class="sv-summary">
      <h2>Сводная карта</h2>
      <div class="sv-tablewrap"><table class="sv-table sv-map">
        <thead><tr><th>Этап</th><th>Гипотезы</th><th>Ключевые блоки боли</th><th>Механизмы</th><th>Файлы итераций</th></tr></thead>
        <tbody>${smRows}</tbody>
      </table></div>
      <p class="sv-concl"><b>Смысловой вывод.</b> ${esc(sm.conclusion || "")}</p>
      <p class="sv-concl muted">${esc(sm.opportunityNote || "")}</p>
    </section>`;

  // ---- 3. Строка матрицы ----
  function matrixRow(r) {
    const painCell = r.painAnchor
      ? `<a href="research.html#${esc(r.painAnchor)}" title="открыть находку в реестре">${esc(r.painCode)}</a>`
      : esc(r.painCode || "—");
    const ev = r.hypStatus ? evChip(r.hypStatus) : null;
    const metrics = [...(r.metricsActive || []), ...(r.metricsTarget || [])]
      .map((mm) => `<a class="sv-mchip" href="metrics.html#m-${metricSlug(mm)}">${esc(mm)}</a>`).join(" ");
    return `<tr>
      <td class="sv-pain">${painCell}</td>
      <td>${esc(r.pain || "—")}${r.quote ? `<div class="sv-quote">${esc(r.quote)}</div>` : ""}</td>
      <td>${r.iter ? `<a href="${backlogQ(r.iter)}">${esc(r.iter)}</a>` : "—"}</td>
      <td>${metrics || "—"}</td>
      <td>${r.moscow ? `<span class="mo-badge ${moscowClass(r.moscow)}">${esc(r.moscow)}</span>` : "—"}</td>
      <td>${ev ? `<span class="ev-chip ${ev.cls}" title="статус гипотезы: ${esc(ev.label)}" aria-label="статус гипотезы: ${esc(ev.label)}">${ev.sign}</span>` : ""}${r.conflict ? `<span class="sv-warn" role="img" aria-label="конфликт" title="${esc(r.conflict)}">⚠</span>` : ""}</td>
    </tr>`;
  }

  // ---- по этапам ----
  const exStage = (n) => (ex.stages || []).find((s) => s.stageN === n) || {};
  function stageSection(n) {
    const st = exStage(n);
    const open = (n === "1" || n === "2") ? "open" : "";
    const gaps = (st.gaps || []).map((g) => `
      <div class="sv-gap">
        <div class="sv-gap__t">${esc(g.title)}</div>
        <div class="sv-gap__x">${esc(g.text)} ${(g.links || []).map((l) => `<a href="${esc(l.href)}">${esc(l.label)} →</a>`).join(" ")}</div>
      </div>`).join("");
    return `
      <details class="sv-stage" id="stage-${esc(n)}" ${open}>
        <summary class="sv-stage__sum"><span class="stage-tag s-${n.toLowerCase()}">этап ${esc(n)}</span></summary>
        <div class="sv-stage__body">
          ${st.logic ? `<p class="sv-logic"><b>Логика ценности.</b> ${esc(st.logic)}</p>` : ""}
          <div class="sv-tablewrap"><table class="sv-table sv-matrix" data-stage-table="${esc(n)}">
            <thead><tr><th>Код боли</th><th>Суть + цитата</th><th>Итерация</th><th>Метрики</th><th>MoSCoW</th><th>⚑</th></tr></thead>
            <tbody data-stage-rows="${esc(n)}"></tbody>
          </table></div>
          ${gaps ? `<div class="sv-gaps"><div class="sv-gaps__h">Анализ дыр (gap-анализ)</div>${gaps}</div>` : ""}
        </div>
      </details>`;
  }

  // ---- конфликты + что дальше ----
  const conflicts = (ex.conflicts || []).map((c) => `
    <div class="sv-conf" id="conflict-${esc(c.n)}">
      <div class="sv-conf__h"><span class="sv-conf__n">${esc(c.n)}</span> ${esc(c.title)} <span class="ev-chip ${c.status === "решён" ? "ev-ok" : "ev-warn"}">${c.status === "решён" ? "✓ решён" : "⚠ открыт"}</span></div>
      <div class="sv-conf__x">${esc(c.text)}</div>
      <div class="sv-conf__m"><span>затрагивает: ${esc(c.blocks)}</span><span>решит: ${esc(c.resolves)}</span></div>
    </div>`).join("");
  const next = (ex.next || []).map((x) => `<li>${esc(x.text)} ${(x.links || []).map((l) => `<a href="${esc(l.href)}">${esc(l.label)} →</a>`).join(" ")}</li>`).join("");

  const selects = FF.map(([field, label]) =>
    `<select class="ctl" data-sf="${field}" aria-label="${esc(label)}"><option value="">${esc(label)}: все</option>${optsFor(field).map(([v, c]) => `<option value="${esc(v)}">${esc(v)} (${c})</option>`).join("")}</select>`).join("");

  const stagesOrder = ["1", "2", "3", "4", "5"];
  host.innerHTML = `
    ${howTo}
    ${summaryHTML}
    <div class="toolbar sv-toolbar">${selects}<button type="button" class="ctl ctl--reset" data-sreset>Сбросить</button></div>
    <div class="result-meta" data-smeta aria-live="polite"></div>
    <section class="sv-stages">${stagesOrder.map(stageSection).join("")}</section>
    <section class="sv-conflicts">
      <h2>Конфликты и открытые вопросы <span class="sv-cnt">${(ex.conflicts || []).length}</span></h2>
      <p class="muted">Слой честности документа — не прячем. Каждый конфликт: суть, что затрагивает, кто/что решит.</p>
      ${conflicts}
    </section>
    <section class="sv-next">
      <h2>Что дальше</h2>
      <ol class="sv-nextlist">${next}</ol>
    </section>`;

  function render() {
    const list = rows.filter((r) => FF.every(([field]) => matches(r, field, state.filters[field])));
    let shown = 0;
    stagesOrder.forEach((n) => {
      const sub = list.filter((r) => r.stageNum === n);
      shown += sub.length;
      const tb = host.querySelector(`[data-stage-rows="${n}"]`);
      if (tb) tb.innerHTML = sub.map(matrixRow).join("") || `<tr><td colspan="6" class="muted">по фильтру строк нет</td></tr>`;
    });
    host.querySelector("[data-smeta]").textContent = `Показано ${shown} из ${rows.length} строк`;
  }

  host.querySelectorAll("[data-sf]").forEach((s) => s.addEventListener("change", (e) => { state.filters[e.target.dataset.sf] = e.target.value; render(); }));
  host.querySelector("[data-sreset]").addEventListener("click", () => {
    state.filters = {}; host.querySelectorAll("[data-sf]").forEach((s) => (s.value = "")); render();
  });
  render();

  // Доскролл к этапу (#stage-N) или карточке конфликта (#conflict-N) — ссылки из «Этапов» (ТЗ 15)
  if (location.hash.startsWith("#stage-") || location.hash.startsWith("#conflict-")) {
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (el) {
      if (el.tagName === "DETAILS") el.open = true;
      el.scrollIntoView({ block: "start" });
      el.classList.add("is-target");
    }
  }
}

// ===================== План исследований (planned.html) =====================
async function mountPlanned() {
  const host = document.querySelector("[data-planned]");
  if (!host) return;
  host.innerHTML = `<div class="loading">Загрузка плана исследований…</div>`;
  let data;
  try { data = await loadJSON("data/planned.json"); }
  catch (e) { host.innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }

  const items = data.items || [];
  // Статус → чип-канон (ТЗ 14): «в плане» = ? (blue), «не заведено» = ∅ (muted).
  const statusChip = (s) => {
    const t = String(s || "").toLowerCase();
    const cls = t.startsWith("в плане") ? "ev-plan" : "ev-muted";
    const sign = t.startsWith("в плане") ? "?" : "∅";
    return `<span class="ev-chip ${cls}">${sign} ${esc(s)}</span>`;
  };
  // Гипотеза-чип: H-коды → бэклог; прочие разблокировки (KR-2, NSM…) — простой чип.
  const unlockChip = (u) => /^H[\d-]/.test(u)
    ? `<a class="rf-chip rf-h" href="backlog.html?q=${encodeURIComponent(u)}">${esc(u)}</a>`
    : `<span class="rf-chip">${esc(u)}</span>`;
  // Этап → ссылка на «Этапы»; «4–5»→две ссылки; «все»→без якоря.
  const stageLink = (s) => {
    const m = String(s).match(/\d+/);
    return m ? `<a class="pl-stage" href="etapy.html#stage-${m[0]}">этап ${esc(s)}</a>` : `<span class="pl-stage">${esc(s)}</span>`;
  };

  const pkgTag = (p) => p ? `<span class="pl-pkg-mini">Пакет ${esc(p)}</span>` : "";

  // ---- сводная таблица-карта ----
  const mapRows = items.map((it) => `
    <tr id="${esc(it.id)}-row">
      <td>${pkgTag(it.package)}<a href="#${esc(it.id)}"><b>${esc(it.code)}</b> ${esc(it.title)}</a></td>
      <td>${statusChip(it.status)}</td>
      <td>${(it.stages || []).map(stageLink).join(" ")}</td>
      <td>${(it.unlocks || []).map(unlockChip).join(" ")}</td>
    </tr>`).join("");

  // ---- карточки ----
  const card = (it) => {
    const owned = !String(it.owner || "").toLowerCase().startsWith("нет вла");
    const dl = (l, v) => v ? `<div class="pl-row"><dt>${esc(l)}</dt><dd>${esc(v)}</dd></div>` : "";
    const blocks = it.blocksWaves ? `<div class="pl-row"><dt>Разблокирует волны</dt><dd>${esc(it.blocksWaves)}</dd></div>` : "";
    const fail = it.failCriterion ? `<div class="pl-fail"><span class="pl-fail__k">Критерий фейла (до сбора данных)</span> ${esc(it.failCriterion)}</div>` : "";
    return `
      <details class="pl-card" id="${esc(it.id)}">
        <summary class="pl-sum">
          <span class="pl-code">${esc(it.code)}</span>
          <span class="pl-title">${esc(it.title)}</span>
          <span class="pl-chips">${pkgTag(it.package)}${statusChip(it.status)}${owned ? "" : `<span class="pl-noowner">нет владельца</span>`}</span>
        </summary>
        <div class="pl-body">
          <p class="pl-q">${esc(it.question)}</p>
          <div class="pl-unlocks"><span class="pl-unlocks__h">разблокирует:</span> ${(it.unlocks || []).map(unlockChip).join(" ")} ${(it.stages || []).map(stageLink).join(" ")}</div>
          <dl>
            ${blocks}${dl("Метод", it.method)}${dl("Материал", it.material)}${dl("Кто/где", it.audience)}
            ${dl("Владелец", it.owner)}${dl("Срок", it.term)}${dl("Что изменится по результату", it.effect)}
            ${dl("Документ-источник", it.srcDoc)}
          </dl>
          ${fail}
        </div>
      </details>`;
  };

  // ---- карточки сгруппированы: пакеты А/Б/В (этапы 1+2), затем прочий долг ----
  const pkgMeta = (c) => (data.packages || []).find((p) => p.code === c) || {};
  let cardsHTML = "";
  for (const pk of ["А", "Б", "В"]) {
    const inp = items.filter((it) => it.package === pk);
    if (!inp.length) continue;
    const m = pkgMeta(pk);
    cardsHTML += `<div class="pl-pkg-h"><span class="pl-pkg-tag">Пакет ${esc(pk)}</span> <b>${esc(m.title || "")}</b> <span class="pl-pkg-h__items">${esc(m.items || "")}</span></div>`;
    cardsHTML += inp.map(card).join("");
  }
  const debt = items.filter((it) => !it.package);
  if (debt.length) {
    cardsHTML += `<div class="pl-pkg-h pl-pkg-h--debt">Прочий research-долг (этапы 3–5 и точечное)</div>`;
    cardsHTML += debt.map(card).join("");
  }

  // ---- обзор пакетов + решения ----
  const pkgOverview = (data.packages || []).map((p) =>
    `<div class="pl-pkg"><div class="pl-pkg__k"><span class="pl-pkg-tag">Пакет ${esc(p.code)}</span> ${esc(p.title)}</div><div class="pl-pkg__items">${esc(p.items || "")}</div><p>${esc(p.note || "")}</p></div>`).join("");
  const decisionsHTML = (data.decisions || []).map((d) => `<li>${esc(d)}</li>`).join("");

  // ---- акцент-блок «не заведено / нет владельца» ----
  const unstaffed = items.filter((it) => String(it.status).startsWith("не заведено"));
  const unstaffedHTML = unstaffed.map((it) =>
    `<li><a href="#${esc(it.id)}"><b>${esc(it.code)}</b> ${esc(it.title)}</a> — без проверки висит ${(it.unlocks || []).filter((u) => /^H[\d-]/.test(u)).map((u) => esc(u)).join(", ") || "—"}</li>`).join("");

  host.innerHTML = `
    <p class="pl-rule">${esc(data.rule || "")}</p>
    <div class="pl-precond"><span class="pl-precond__k">предусловие</span> ${esc(data.precondition || "")}</div>

    ${data.packages ? `<section class="pl-packages">
      <h2>Три пакета исследований</h2>
      <p class="muted">Из 7 пунктов дискавери этапов 1+2 — 3 пакета вместо 7 заходов: общий источник данных и общий исполнитель.</p>
      <div class="pl-pkg-grid">${pkgOverview}</div>
      ${data.packagesOrder ? `<p class="pl-pkg-order"><b>Очерёдность:</b> ${esc(data.packagesOrder)}</p>` : ""}
    </section>` : ""}

    <section class="pl-map">
      <h2>Сводная карта</h2>
      <div class="sv-tablewrap"><table class="sv-table">
        <thead><tr><th>Исследование</th><th>Статус</th><th>Кормит этапы</th><th>Разблокирует</th></tr></thead>
        <tbody>${mapRows}</tbody>
      </table></div>
    </section>

    <section class="pl-unstaffed">
      <h2>Не заведено / нет владельца <span class="sv-cnt">${unstaffed.length} из ${items.length}</span></h2>
      <p class="muted">Аналог анализа дыр, но для знаний: пока исследование не заведено, эти гипотезы висят без проверки.</p>
      <ul class="pl-unstaffed__list">${unstaffedHTML}</ul>
    </section>

    <section class="pl-cards">
      <h2>Карточки исследований</h2>
      ${cardsHTML}
    </section>

    ${data.decisions ? `<section class="pl-decisions">
      <h2>Решения Влада (2026-06-16)</h2>
      <ol class="pl-dec-list">${decisionsHTML}</ol>
    </section>` : ""}`;

  // Доскролл к карточке: planned.html#g2 (с Рынка/Этапов/Доказательной базы)
  if (location.hash) {
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (el) {
      if (el.tagName === "DETAILS") el.open = true;
      el.scrollIntoView({ block: "start" });
      el.classList.add("is-target");
    }
  }
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
  // Слаг кода метрики → id карточки (#m-…) и блока методики (#calc-…). Должен совпадать в обоих местах.
  const mSlug = (c) => String(c).toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-|-$/g, "");

  // Готовность данных — ОТДЕЛЬНАЯ ось от достоверности (.ev-chip) и категориальной шкалы.
  // Нейтральный монохром: метр из 3 сегментов (сколько данных уже есть), без новых цветов-хексов.
  const READY = {
    green: { lab: "из данных", fill: 3 },
    amber: { lab: "нужен атрибут", fill: 2 },
    red:   { lab: "новая инструментовка", fill: 1 },
    black: { lab: "данные не наши", fill: 0 },
  };
  const readyChip = (r) => {
    if (!r || !READY[r]) return "";
    const cfg = READY[r];
    const segs = [0, 1, 2].map((i) => `<i${i < cfg.fill ? ' class="on"' : ""}></i>`).join("");
    return `<span class="m-ready m-ready--${r}" title="готовность данных: ${esc(cfg.lab)}"><span class="m-ready__meter" aria-hidden="true">${segs}</span>${esc(cfg.lab)}</span>`;
  };

  function card(m) {
    const dirGood = `хорошо ${esc(m.direction)}`;
    const lead = m.leading ? `<span class="m-lead">ведущая</span>` : "";
    let base;
    if (m.baselineNum) {
      // Выделенный baseline: крупная цифра + мелкие подписи; «почему такая» — в блоке «Как считается».
      const unit = m.baselineUnit ? `<div class="m-base__unit">${esc(m.baselineUnit)}</div>` : "";
      const asof = m.baselineAsof ? `<div class="m-base__asof">${esc(m.baselineAsof)}</div>` : "";
      const bnote = m.baselineNote ? `<span>${esc(m.baselineNote)}</span>` : "";
      const blink = m.baselineLink ? `<a href="${esc(m.baselineLink.href)}">${esc(m.baselineLink.text)}</a>` : "";
      const foot = (bnote || blink) ? `<div class="m-base__note">${bnote}${bnote && blink ? " · " : ""}${blink}</div>` : "";
      base = `<div class="m-base m-base--big"><span class="m-base__h">baseline</span>
          <div class="m-base__num">${esc(m.baselineNum)}</div>${unit}${asof}${foot}</div>`;
    } else if (m.baseline) {
      base = `<div class="m-base"><span class="m-base__h">baseline</span> ${esc(m.baseline)}</div>`;
    } else {
      base = `<div class="m-base m-base--need">baseline нужен</div>`;
    }
    const note = m.note ? `<div class="m-note">${esc(m.note)}</div>` : "";
    // Слой реализуемости (из «Инструментовки метрик»): откуда данные, как часто, какая волна, текст тикета.
    let instr = "";
    if (m.instr) {
      const wv = m.instr.wave
        ? `<a class="m-instr__wave" href="#instr" title="порядок запуска">волна ${esc(m.instr.wave)}</a>`
        : (m.instr.refine ? `<span class="m-instr__wave m-instr__wave--has">цифра уже есть</span>` : "");
      const t0 = m.instr.blockedByT0 ? `<a class="m-instr__t0" href="#instr-t0" title="разблокируется логом транзакций">из тикета №0</a>` : "";
      const refine = m.instr.refine ? `<p class="m-instr__refine"><span class="m-instr__rh">что доуточнить</span> ${esc(m.instr.refine)}</p>` : "";
      instr = `<div class="m-instr">
        <div class="m-instr__src"><span class="m-instr__h">источник данных</span> ${esc(m.instr.source)}</div>
        <div class="m-instr__bar">${readyChip(m.instr.readiness)}<span class="m-instr__freq">частота: ${esc(m.instr.freq)}</span>${wv}${t0}</div>
        <details class="m-instr__ticket"><summary>тикет аналитику ↓</summary><div class="m-instr__tbody"><p>${esc(m.instr.ticket)}</p>${refine}</div></details>
      </div>`;
    }
    // План vs факт (ТЗ 09): дельта после релиза + статус гипотезы каноном .ev-chip.
    let fact = "";
    if (m.factDelta) {
      const ev = m.factStatus ? evChip(m.factStatus) : null;
      const chip = ev ? ` <span class="ev-chip ${ev.cls}" aria-label="гипотеза ${esc(ev.label)}">${ev.sign} ${esc(ev.label)}</span>` : "";
      fact = `<div class="m-fact"><span class="m-fact__h">факт${m.checkedAt ? ` · ${esc(m.checkedAt)}` : ""}</span>${esc(m.factDelta)}${chip}</div>`;
    }
    const mid = mSlug(m.code);
    // Компактная формула в карточке; подробности «как считается и почему» — в секции ниже.
    const formula = m.formula ? `<div class="m-formula"><span class="m-formula__h">формула</span> <code>${esc(m.formula)}</code></div>` : "";
    const calcLink = (m.howCalc || (m.why && m.why.length)) ? `<a class="m-calc-link" href="#calc-${mid}">как считается ↓</a>` : "";
    // На лице карточки — суть (число + к чему привязано). Полная инструментовка и оговорка —
    // в один fold «подробнее» внизу (паттерн support-ratio: не грузить карточку сразу всем).
    const more = (note || instr)
      ? `<details class="m-more"><summary>подробнее ↓</summary><div class="m-more__body">${note}${instr}</div></details>`
      : "";
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
        ${base}${formula}${fact}${more}
        <div class="m-links">
          <a class="m-link" href="backlog.html?q=${encodeURIComponent(m.code)}">итерации с метрикой →</a>
          ${calcLink}
        </div>
      </article>`;
  }

  // ── One-pager «Как +20 агентств растят NSM» — смысловой мост над карточками ──
  function nsmHero(n) {
    if (!n) return "";
    // Цвет ступени воронки — по канону этапов (1=--cat-1, 2A/2B=--cat-3); вход/исход — нейтраль/золото.
    const stepFill = { input: "var(--panel-2)", "1": "var(--cat-1)", "2A": "var(--cat-3)", "2B": "var(--cat-3)", nsm: "var(--gold)" };
    const stepInk  = { input: "var(--cream)", "1": "var(--bg)", "2A": "var(--bg)", "2B": "var(--bg)", nsm: "var(--bg)" };
    const steps = n.funnel || [];
    // Геометрия воронки (сужающиеся ступени) — это представление, держим в JS, тексты из JSON.
    const geo = [
      { w: 400, h: 84 }, { w: 344, h: 78 }, { w: 288, h: 78 }, { w: 232, h: 78 }, { w: 190, h: 96 },
    ];
    let y = 14; const VBW = 430; const svgRows = []; const arrows = [];
    steps.forEach((s, i) => {
      const g = geo[i] || geo[geo.length - 1];
      const x = Math.round((VBW - g.w) / 2);
      const key = s.key === "nsm" ? "nsm" : s.key === "input" ? "input" : (s.stage || "input");
      const fill = stepFill[key] || "var(--panel-2)";
      const ink = stepInk[key] || "var(--cream)";
      const cx = VBW / 2;
      const big = s.key === "nsm";
      const titleY = y + (big ? 38 : 30);
      const subY = y + (big ? 60 : 50);
      svgRows.push(
        `<rect x="${x}" y="${y}" width="${g.w}" height="${g.h}" rx="10" fill="${fill}"/>` +
        `<text x="${cx}" y="${titleY}" text-anchor="middle" fill="${ink}" font-size="${big ? 19 : 15}" font-weight="700">${esc(s.title)}</text>` +
        (s.sub ? `<text x="${cx}" y="${subY}" text-anchor="middle" fill="${ink}" font-size="10.5" opacity=".88">${esc(s.sub)}</text>` : "")
      );
      const nextY = y + g.h;
      if (i < steps.length - 1) arrows.push(`M${cx} ${nextY} L${cx} ${nextY + 16}`);
      y = nextY + 16;
    });
    const svg = `<svg viewBox="0 0 ${VBW} ${y}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Воронка: от +20 агентств к NSM" class="nsm-svg">
        <defs><marker id="nsm-ar" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="var(--muted)"/></marker></defs>
        ${svgRows.join("\n        ")}
        <path d="${arrows.join(" ")}" stroke="var(--line-soft)" stroke-width="2" fill="none" marker-end="url(#nsm-ar)"/>
      </svg>`;

    // Правая колонка: те же ступени с кликабельными чипами метрик (→ карточки ниже).
    const ownLabel = (k) => k === "sales" ? "Продажи" : k === "outcome" ? "Бизнес" : "Продукт";
    // Подсказка на чипе: полное русское название метрики + пояснение цели/предохранителя.
    const mByCode = {};
    metrics.forEach((m) => { mByCode[m.code] = m; });
    const stepCard = (s) => {
      const head = s.stageLabel ? `${esc(s.title)} · ${esc(s.stageLabel)}` : esc(s.title);
      const chips = (s.metrics || []).map((c) => {
        const cls = "nsm-chip" + (c.target ? " nsm-chip--tgt" : "");
        const full = (mByCode[c.code] && mByCode[c.code].name) || c.name;
        let tip = full;
        if (c.guard) tip += " · предохранитель: следим, чтобы транзакция не ушла от консультанта к клиенту";
        else if (c.target) tip += " · целевая (косвенная) метрика";
        return `<a class="${cls}" href="#m-${mSlug(c.code)}" title="${esc(tip)}"><span class="nsm-chip__d">${esc(c.dir)}</span> ${esc(c.name)}</a>`;
      }).join("");
      const chipWrap = chips ? `<div class="nsm-chips">${chips}</div>` : "";
      return `<div class="nsm-stage nsm-stage--${esc(s.ownKind)}">
          <div class="nsm-stage__top"><span class="nsm-stage__name">${head}</span><span class="nsm-own nsm-own--${esc(s.ownKind)}">${esc(ownLabel(s.ownKind))}</span></div>
          ${s.desc ? `<p class="nsm-stage__desc">${esc(s.desc)}</p>` : ""}${chipWrap}
        </div>`;
    };

    const stats = (n.stats || []).map((st) =>
      `<div class="nsm-stat nsm-stat--${esc(st.tone || "plain")}"><div class="nsm-stat__num">${esc(st.num)}</div><div class="nsm-stat__lab">${esc(st.lab)}</div></div>`).join("");

    const eq = n.equation ? `<div class="nsm-eq"><b>${esc(n.equation.formula)}</b>${n.equation.note ? `<span>${esc(n.equation.note)}</span>` : ""}</div>` : "";

    // «Где этапы 3–5» — лестница ведёт к двум вершинам; этапы 3–5 кормят маржу/выручку, не NSM.
    let ladder = "";
    const ld = n.ladder;
    if (ld && (ld.stages || []).length) {
      const outName = {}; (ld.outcomes || []).forEach((o) => { outName[o.key] = o.label; });
      const legend = (ld.outcomes || []).map((o) =>
        `<span class="nsm-out nsm-out--${esc(o.key)}">${esc(o.label)}</span><span class="nsm-lg__d">${esc(o.desc)}</span>`).join("");
      const rows = ld.stages.map((s) => {
        const sc = s.n === "1" ? "s1" : s.n === "2" ? "s2" : "s345";
        const q2 = s.q2
          ? `<span class="nsm-lq is-yes">фокус Q2</span>`
          : `<span class="nsm-lq is-no">вне Q2</span>`;
        return `<div class="nsm-lstage nsm-lstage--${sc}">
            <div class="nsm-lstage__top">
              <span class="nsm-lstage__n">Этап ${esc(s.n)}</span>
              <span class="nsm-lstage__name">${esc(s.name)}</span>
              <span class="nsm-out nsm-out--${esc(s.outcome)}">→ ${esc(outName[s.outcome] || s.outcome)}</span>
              ${q2}
            </div>
            <div class="nsm-lstage__meta">${esc(s.meta)}</div>
            <p class="nsm-lstage__bridge">${esc(s.bridge)}</p>
          </div>`;
      }).join("");
      ladder = `<details class="nsm-ladder nsm-fold">
        <summary class="nsm-fold__sum">${esc(ld.title)}</summary>
        ${ld.intro ? `<p class="nsm-tk__sub">${esc(ld.intro)}</p>` : ""}
        ${legend ? `<div class="nsm-lg">${legend}</div>` : ""}
        <div class="nsm-lstages">${rows}</div>
        ${ld.note ? `<p class="nsm-guardnote">${esc(ld.note)}</p>` : ""}
      </details>`;
    }

    // «Что из этого следует» — практические выводы из пирамиды метрик (акцент-карточки).
    let takeaways = "";
    const tk = n.takeaways;
    if (tk && (tk.items || []).length) {
      const cards = tk.items.map((it) =>
        `<div class="nsm-tk__card">${it.tag ? `<span class="nsm-tk__tag">${esc(it.tag)}</span>` : ""}<div class="nsm-tk__head">${esc(it.head)}</div><p class="nsm-tk__body">${esc(it.body)}</p></div>`).join("");
      takeaways = `<section class="nsm-tk">
        <div class="nsm-tk__h">${esc(tk.title || "Что из этого следует")}</div>
        ${tk.sub ? `<p class="nsm-tk__sub">${esc(tk.sub)}</p>` : ""}
        <div class="nsm-tk__grid">${cards}</div>
        ${tk.caveat ? `<p class="nsm-guardnote">${esc(tk.caveat)}</p>` : ""}
      </section>`;
    }

    return `<section class="nsm-hero" id="nsm">
      ${n.eyebrow ? `<p class="eyebrow">${esc(n.eyebrow)}</p>` : ""}
      <h2 class="nsm-h2">${esc(n.title)}</h2>
      ${n.lede ? `<p class="lede">${esc(n.lede)}</p>` : ""}
      ${eq}
      <div class="nsm-cols">
        <div class="nsm-funnel"><div class="nsm-colh">Воронка: вход → конверсия → исход</div>${svg}</div>
        <div class="nsm-stages"><div class="nsm-colh">Метрики на каждом этапе воронки</div>${steps.map(stepCard).join("")}</div>
      </div>
      <div class="nsm-stats">${stats}</div>
      <p class="nsm-src">Живые цифры по базе агентств (откуда взяты 51/259, +25, концентрация) — на странице <a href="agencies.html#nsm">«Агентства. Цифры»</a> →</p>
      ${ladder}
      ${n.punch ? `<div class="nsm-punch">${esc(n.punch)}</div>` : ""}
      ${takeaways}
      ${n.sources ? `<p class="nsm-foot">${esc(n.sources)}</p>` : ""}
    </section>`;
  }

  // ── «Как это измерить»: тикет №0 + волны запуска (из «Инструментовки метрик») ──
  function instrHero(ins) {
    if (!ins) return "";
    const t0 = ins.ticket0;
    const fields = t0 && (t0.fields || []).length
      ? `<ol class="instr-t0__fields">${t0.fields.map((f) => `<li>${esc(f)}</li>`).join("")}</ol>` : "";
    const unlocks = t0 && (t0.unlocks || []).length
      ? `<div class="instr-t0__unlocks"><span class="instr-t0__uh">разблокирует</span>${t0.unlocks.map((c) => `<a class="instr-tag" href="#m-${mSlug(c)}">${esc(c)}</a>`).join("")}</div>` : "";
    const ticket0 = t0 ? `<div class="instr-t0" id="instr-t0">
        <div class="instr-t0__head"><span class="instr-t0__badge">тикет №0</span><span class="instr-t0__title">${esc(t0.title)}</span></div>
        <p class="instr-t0__body">${esc(t0.body)}</p>
        ${fields}${unlocks}
        ${t0.punch ? `<p class="instr-t0__punch">${esc(t0.punch)}</p>` : ""}
      </div>` : "";

    const legend = (ins.readinessLegend || []).map((l) =>
      `<div class="instr-lg__row">${readyChip(l.key)}<span class="instr-lg__desc">${esc(l.desc)}</span></div>`).join("");
    const legendBlock = legend
      ? `<div class="instr-lg"><span class="instr-lg__h">Готовность данных</span>${legend}</div>` : "";

    const waves = (ins.waves || []).map((w) => {
      const chips = (w.metrics || []).map((c) => `<a class="instr-tag" href="#m-${mSlug(c)}">${esc(c)}</a>`).join("");
      return `<div class="instr-wave">
          <div class="instr-wave__top"><span class="instr-wave__n">Волна ${esc(w.n)}</span><span class="instr-wave__title">${esc(w.title)}</span></div>
          ${w.desc ? `<p class="instr-wave__desc">${esc(w.desc)}</p>` : ""}
          <div class="instr-wave__chips">${chips}</div>
        </div>`;
    }).join("");
    const wavesBlock = waves
      ? `<div class="instr-waves"><span class="instr-sub__h">Волны запуска</span><div class="instr-waves__grid">${waves}</div></div>` : "";

    const order = (ins.order || []).length
      ? `<div class="instr-order"><span class="instr-sub__h">Порядок запуска — 3 тикета вместо 11</span><ol>${ins.order.map((o) => `<li>${esc(o)}</li>`).join("")}</ol></div>` : "";

    return `<details class="instr-hero nsm-fold" id="instr">
      <summary class="nsm-fold__sum">${ins.eyebrow ? `<span class="nsm-fold__eye">${esc(ins.eyebrow)}</span>` : ""}${esc(ins.title)}</summary>
      ${ins.lede ? `<p class="lede">${esc(ins.lede)}</p>` : ""}
      ${ticket0}
      ${legendBlock}
      ${wavesBlock}
      ${order}
      ${ins.note ? `<p class="nsm-guardnote">${esc(ins.note)}</p>` : ""}
      ${ins.source ? `<p class="nsm-foot">${esc(ins.source)}</p>` : ""}
    </details>`;
  }

  const active = metrics.filter((m) => m.type === "active").sort(byStage);
  const target = metrics.filter((m) => m.type === "target").sort(byStage);

  // Основное визуальное разделение — Активные (что двигаем) и Целевые (куда идём).
  // Активные первыми: сначала то, на что влияем прямо, потом косвенная цель направления.
  const primary = `
    <section class="m-group m-group--primary m-group--act">
      <h2>Активные <span class="m-h-cnt">${active.length}</span></h2>
      <p class="m-group__sub">На них влияем прямо и планируем считать в Q2. По каждой — одна ведущая метрика.</p>
      <div class="m-grid">${active.map(card).join("")}</div>
    </section>
    <section class="m-group m-group--primary m-group--tgt">
      <h2>Целевые <span class="m-h-cnt">${target.length}</span></h2>
      <p class="m-group__sub">Куда хотим прийти. Влияем косвенно — показывают, сдвигается ли цель направления.</p>
      <div class="m-grid">${target.map(card).join("")}</div>
    </section>`;

  const leadHTML = Object.entries(data.leading || {}).map(([blk, arr]) =>
    `<div class="lead-row"><span class="lead-blk">${esc(blk)}</span> ${arr.map((x) => `<span class="lead-chip">${esc(x)}</span>`).join(" ")}</div>`).join("");

  // Остальное — для информации, без яркого выделения.
  const secondary = `
    <section class="m-group m-group--info">
      <h2>Ведущие метрики по блокам <span class="m-h-note">(зеркало Impact в скоринге)</span></h2>
      <div class="lead-wrap">${leadHTML}</div>
    </section>`;

  // «Как считается» — развёрнутая методика по метрикам, где задан howCalc/why. Со временем — по каждой.
  const calcMetrics = metrics.filter((m) => m.howCalc || (m.why && m.why.length));
  const calcItem = (m) => {
    const mid = mSlug(m.code);
    const f = m.formula ? `<div class="m-calc__formula"><code>${esc(m.formula)}</code></div>` : "";
    const how = m.howCalc ? `<p class="m-calc__how">${esc(m.howCalc)}</p>` : "";
    const why = (m.why && m.why.length)
      ? `<div class="m-calc__why"><span class="m-calc__wh">Почему именно так</span><ul>${m.why.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>` : "";
    const src = m.sources ? `<p class="m-calc__src">${esc(m.sources)}</p>` : "";
    return `<details id="calc-${mid}" class="m-calc">
      <summary><span class="m-code">${esc(m.code)}</span> — как считается и почему</summary>
      <div class="m-calc__body">${f}${how}${why}${src}</div>
    </details>`;
  };
  const calc = calcMetrics.length ? `
    <section class="m-group m-group--calc">
      <h2>Как считается</h2>
      <p class="m-group__sub">Формула и логика расчёта по метрикам, где это важно для интерпретации. Раскрывается по клику; со временем — по каждой метрике.</p>
      ${calcMetrics.map(calcItem).join("")}
    </section>` : "";

  const oq = data.openQuestions;
  const openQ = oq ? `
    <section class="m-group m-group--info m-oq">
      <p class="eyebrow">${esc(oq.eyebrow)}</p>
      <h2>${esc(oq.title)}</h2>
      <p class="m-group__sub">${esc(oq.lede)}</p>
      <div class="m-oq__list">
        ${(oq.items || []).map((q) => `
          <div class="m-oq__it">
            <div class="m-oq__h"><span class="m-code">${esc(q.code)}</span> ${esc(q.title)}</div>
            <p>${esc(q.body)}</p>
            <div class="m-oq__st">→ ${esc(q.status)}</div>
          </div>`).join("")}
      </div>
    </section>` : "";

  // Порядок повествования: главная цифра (NSM) → что это за метрики (лид) → сами метрики
  // (активные → целевые) → ведущие по блокам → открытые вопросы → служебное «как» (fold).
  const intro = data.intro
    ? `<div class="m-intro"><p class="lede">${esc(data.intro)}</p></div>`
    : "";
  host.innerHTML = `
    ${nsmHero(data.nsm)}
    ${intro}
    ${primary}
    ${secondary}
    ${openQ}
    ${instrHero(data.instrumentation)}
    ${calc}`;

  // Доскролл к метрике/методике, если пришли по ссылке #m-<код> или #calc-<код> (рендер асинхронный).
  const focusHash = () => {
    if (!location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (!el) return;
    if (el.tagName === "DETAILS") el.open = true;          // раскрыть блок методики
    const det = el.closest("details");                     // якорь внутри свёрнутого блока — раскрыть родителя
    if (det) det.open = true;
    el.scrollIntoView({ block: "center" });
    el.classList.add("is-target");
  };
  focusHash();
  // Клик по «как считается ↓» внутри страницы тоже раскрывает нужный блок.
  window.addEventListener("hashchange", focusHash);
}

// ===================== Легенды (legend.html) =====================
async function mountLegend() {
  const host = document.querySelector("[data-legend]");
  if (!host) return;
  host.innerHTML = `<div class="loading">Загрузка легенды…</div>`;
  let data;
  try { data = await loadJSON("data/legend.json"); }
  catch (e) { host.innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }

  const allSecs = data.sections || [];
  // Вкладка «Легенда» в xlsx содержит строки-changelog (заметки о пересчётах): у них
  // длинный заголовок-абзац или вид «v7 (…)», а в col B пусто — build.py ошибочно парсит
  // их как заголовки секций. Отделяем их от настоящих разделов-определений.
  const isChangelog = (s) =>
    s.title.length > 44 || /^v\d+\s*\(/i.test(s.title) || /патч|пересч[её]т/i.test(s.title);
  const secs = allSecs.filter((s) => !isChangelog(s) && (s.items || []).length);
  const changelog = allSecs.filter(isChangelog);

  const toc = secs.map((s) => `<a class="leg-toc__item" href="#${s.id}">${esc(s.title)}</a>`).join("");
  const body = secs.map((s) => `
    <section class="leg-sect" id="${s.id}">
      <h2>${esc(s.title)}</h2>
      <dl class="leg-list">
        ${s.items.map((it) => `<div class="leg-row" id="${it.id}"><dt>${esc(it.term)}</dt><dd>${esc(it.def)}</dd></div>`).join("")}
      </dl>
    </section>`).join("");

  // changelog → сворачиваемая «История пересчётов скоринга» в конце, а не битые H2.
  const clItems = changelog.flatMap((s) => {
    const its = (s.items || []);
    if (its.length) return its.map((it) => ({ term: it.term, def: it.def }));
    return [{ term: "", def: s.title }];
  });
  const changelogHTML = clItems.length ? `
    <details class="leg-changelog">
      <summary>История пересчётов скоринга (${clItems.length})</summary>
      <dl class="leg-list">
        ${clItems.map((it) => `<div class="leg-row">${it.term ? `<dt>${esc(it.term)}</dt>` : `<dt class="leg-row__nodt"></dt>`}<dd>${esc(it.def)}</dd></div>`).join("")}
      </dl>
    </details>` : "";

  host.innerHTML = `
    <nav class="leg-toc" aria-label="Разделы легенды">${toc}</nav>
    <div class="leg-body">${body}${changelogHTML}</div>`;

  // JSON грузится асинхронно — браузер уже не доскроллит к входящему #якорю сам.
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash) {
    const el = document.getElementById(hash);
    if (el) el.scrollIntoView({ block: "start" });
  }
}

// ===================== Карта соответствия (матрица в vision.html#karta) =====================
// Данные — из concepts.json (matrix/lenses/registry). Карточки концепций переехали в etapy.html.
const Q2_BADGE = {
  focus:   ["q2-focus", "сейчас в фокусе"],
  partial: ["q2-part",  "частично сейчас"],
  out:     ["q2-out",   "позже"],
};
function q2Badge(kind) {
  const b = Q2_BADGE[kind] || Q2_BADGE.out;
  return `<span class="cn-q2 ${b[0]}">${b[1]}</span>`;
}
function valueMatrixHTML(data, l2idx) {
  const mechCat = data.mechCatalog || {};
  l2idx = l2idx || {};
  // Ярлык механизма → ссылка в Каталог задач. Значение mechCatalog: строка (тема L1) или
  // {theme, l2} (подтема L2 — индекс берём по имени из levels.json). Без привязки — текст.
  const mechChip = (m) => {
    const ent = mechCat[m];
    if (!ent) return `<span class="vm-m">${esc(m)}</span>`;
    const theme = typeof ent === "string" ? ent : ent.theme;
    const l2 = typeof ent === "string" ? null : ent.l2;
    let sel = "t:" + theme, tip = theme;
    if (l2 && l2idx[theme] && l2idx[theme][l2] != null) {
      sel = "l:" + theme + ":" + l2idx[theme][l2];
      tip = theme + " › " + l2;
    }
    const href = "levels.html?sel=" + encodeURIComponent(sel);
    return `<a class="vm-m vm-m--link" href="${esc(href)}" title="В Каталог задач: ${esc(tip)}">${esc(m)}</a>`;
  };
  const rows = (data.matrix || []).map((r) => {
    const mech = (r.mechanisms || []).map(mechChip).join(" ");
    const q2 = r.q2 ? `<span class="vm-q2 on">Q2</span>` : `<span class="vm-q2">—</span>`;
    return `
      <tr class="vm-row${r.q2 ? " is-q2" : ""}">
        <td class="vm-stage"><a href="etapy.html#stage-${esc(String(r.stage).replace(/[^0-9]/g, ""))}"><span class="vm-sn" data-stage="${esc(r.stage)}">${esc(r.stage)}</span> ${esc(r.stageName)}</a></td>
        <td class="vm-sub">${esc(r.subgoals)}</td>
        <td class="vm-concept"><a href="etapy.html#c${esc(String(r.concept).replace(/[^0-9].*$/, "").trim() || r.concept)}"><b>${esc(r.concept)}</b> · ${esc(r.conceptName)}</a></td>
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
      <div class="vm-block__h">2 проекции — взгляды на одно направление</div>
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
    встречаются в разных строках. Подробно этапы и гипотезы — на странице
    <a href="etapy.html">«Этапы ценности»</a>.</p>`;
}
// Рендерит только «Карту соответствия» в vision.html#karta. Карточки концепций переехали в etapy.html.
async function mountConcepts() {
  const matrixHost = document.querySelector("[data-value-matrix]");
  if (!matrixHost) return;
  let data;
  try { data = await loadJSON("data/concepts.json"); }
  catch (e) { matrixHost.innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }
  // Индекс L2-подтем Каталога по имени — чтобы ссылки на механизмы вели в подтему, а не зависели от порядка.
  let l2idx = {};
  try {
    const lv = await loadJSON("data/levels.json");
    (lv.branches || []).forEach((b) => (b.themes || []).forEach((t) => {
      (t.editorialL2 || []).forEach((l, i) => {
        if (!l2idx[t.name]) l2idx[t.name] = {};
        if (l && l.name != null) l2idx[t.name][l.name] = i;
      });
    }));
  } catch (e) { /* подтемы необязательны — ссылки упадут до уровня темы */ }
  matrixHost.innerHTML = valueMatrixHTML(data, l2idx);
}

// ===================== Единая шапка проекции (projbar) =====================
// 2 проекции одного направления + 1 реестр. Снимает «почему здесь похожие деревья».
const PROJ = {
  etapy: { kicker: "Проекция · Зачем, когда и что строим", name: "Этапы ценности",
    q: "в каком порядке создаём ценность и что именно строим",
    read: "Путь агентства от входа до зрелости; на каждом этапе — гипотезы и метрики. Концепции — общий язык поверх. В фокусе — ранние этапы." },
  tree: { kicker: "Проекция · Чья работа", name: "Дерево работ (JTBD)",
    q: "чью работу и на каком уровне абстракции закрываем", read: "Big → Core / Micro / Small по ролям (граф NMT)" },
  levels: { kicker: "Реестр работ", name: "Каталог задач",
    q: "где лежат конкретные задачи бэклога", read: "3 ветки → 7 тем → подтемы → итерации" },
};
const PROJ_SIBS = [
  { key: "etapy",  href: "etapy.html",  label: "Этапы ценности" },
  { key: "tree",   href: "tree.html",   label: "Дерево (JTBD)" },
  { key: "levels", href: "levels.html", label: "Каталог задач" },
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
async function mountExec() {
  const host = document.querySelector("[data-exec]");
  if (!host) return;
  let d;
  try { d = await loadJSON("data/exec.json"); }
  catch (e) { host.innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }

  // Дата обновления сводки — из данных, не из HTML (иначе протухает при рассинхроне). ТЗ 09.
  const eb = document.querySelector("[data-exec-date]");
  if (eb && d._updated) eb.textContent = `Направление «Агентства» · обновлено ${d._updated}`;

  const pct = Math.min(100, Math.round((d.progress.done / d.progress.goal) * 100));

  // ── Живые цифры базы из agencies.json → пирамида метрик (не дублируем в exec.json) ──
  let m = {};
  try {
    const ag = await loadJSON("data/agencies.json");
    const ags = ag.agencies || [];
    const nsm = ag.nsm || {};
    const lead = ags.reduce((x, a) => ((a.may || 0) > (x.may || 0) ? a : x), ags[0] || {});
    const totalMay = ags.reduce((s, a) => s + (a.may || 0), 0);
    const mc = ag.monthlyClients || {};
    const tot = mc.total || [];
    const conc = ag.concentration || {};
    const aSeg = ((ag.abcdx && ag.abcdx.segments) || []).find((s) => s.seg === "A");
    m = {
      apex: nsm.activeMo != null ? nsm.activeMo : nsm.now,
      apexMonth: (mc.months || []).slice(-1)[0] || null,
      momDelta: tot.length >= 2 ? tot[tot.length - 1] - tot[tot.length - 2] : null,
      agencies: ags.length || null,
      ibcPct: totalMay ? Math.round((lead.may || 0) / totalMay * 100) : null,
      top3: conc.top3 != null ? Math.round(conc.top3 * 100) : null,
      top5: conc.top5 != null ? Math.round(conc.top5 * 100) : null,
      aClients: aSeg ? Math.round(aSeg.clients) : null,
      aOpsPct: aSeg ? Math.round(aSeg.opsPct) : null,
    };
  } catch (e) { /* agencies.json необязателен — пирамида упростится */ }

  // Пирамида метрик: главная метрика → ширина / глубина → через продукт
  const P = d.pyramid || {};
  const deltaTxt = m.momDelta != null
    ? `<span class="ex-pyr__delta ${m.momDelta < 0 ? "is-down" : m.momDelta > 0 ? "is-up" : ""}">${m.momDelta > 0 ? "+" : m.momDelta < 0 ? "−" : "±"}${Math.abs(m.momDelta)} за месяц</span>` : "";
  const pyramid = `
    <div class="ex-pyr">
      <a class="ex-pyr__apex" href="agencies.html#nsm">
        <span class="ex-pyr__k">Главная метрика · NSM направления</span>
        <span class="ex-pyr__num">${m.apex != null ? fmtInt(m.apex) : "—"}${deltaTxt}</span>
        <span class="ex-pyr__lbl">${esc(P.apexLabel || "активные клиенты-компании через агентства")}</span>
      </a>
      <div class="ex-pyr__split" aria-hidden="true"></div>
      <div class="ex-pyr__pillars">
        <a class="ex-pyr__pillar" href="${esc((P.width && P.width.href) || "agencies.html")}">
          <div class="ex-pyr__ph"><span class="ex-pyr__pk">${esc((P.width && P.width.k) || "Ширина")}</span><span class="ex-pyr__share">${esc((P.width && P.width.share) || "")}</span></div>
          <div class="ex-pyr__pname">${esc((P.width && P.width.name) || "сколько у нас агентств")}</div>
          <div class="ex-pyr__goal"><b>${d.progress.done}</b>/${d.progress.goal} <span>цель «+20» · ${pct}%</span></div>
          <div class="ex-pyr__bar"><div class="ex-pyr__fill" style="width:${pct}%"></div></div>
          <p class="ex-pyr__pt">${gloss(esc((P.width && P.width.t) || ""))}</p>
        </a>
        <a class="ex-pyr__pillar ex-pyr__pillar--accent" href="${esc((P.depth && P.depth.href) || "masshtab.html")}">
          <div class="ex-pyr__ph"><span class="ex-pyr__pk">${esc((P.depth && P.depth.k) || "Глубина")}</span><span class="ex-pyr__share ex-pyr__share--gold">${esc((P.depth && P.depth.share) || "")}</span></div>
          <div class="ex-pyr__pname">${esc((P.depth && P.depth.name) || "клиентов на агентство")}</div>
          <div class="ex-pyr__lever">главный рычаг 2026</div>
          <p class="ex-pyr__pt">${gloss(esc((P.depth && P.depth.t) || ""))}</p>
        </a>
      </div>
      <a class="ex-pyr__base" href="${esc((P.base && P.base.href) || "etapy.html")}">${esc((P.base && P.base.t) || "оба пути идут через продукт — этапы 1 и 2")} →</a>
    </div>`;

  // Числовая полоса-статистика: big-число + короткая подпись (меньше слов, больше цифр)
  const stath = (P.href || "agencies.html");
  const cells = [];
  if (m.agencies != null) cells.push(`<a class="ex-stat" href="agencies.html"><span class="ex-stat__v">${m.agencies}</span><span class="ex-stat__k">активных агентств</span></a>`);
  if (m.ibcPct != null) cells.push(`<a class="ex-stat" href="agencies.html#nsm"><span class="ex-stat__v">${m.ibcPct}<small>%</small></span><span class="ex-stat__k">объёма — у IBC</span></a>`);
  if (m.top3 != null && m.top5 != null) cells.push(`<a class="ex-stat" href="agencies.html#nsm"><span class="ex-stat__v">${m.top3}→${m.top5}<small>%</small></span><span class="ex-stat__k">на топ-3 / топ-5</span></a>`);
  if (m.aClients != null && m.aOpsPct != null) cells.push(`<a class="ex-stat" href="agencies.html"><span class="ex-stat__v">${m.aClients}<small> = ${m.aOpsPct >= 45 && m.aOpsPct <= 55 ? "½" : m.aOpsPct + "%"}</small></span><span class="ex-stat__k">клиентов = ${m.aOpsPct >= 45 && m.aOpsPct <= 55 ? "половина" : m.aOpsPct + "%"} объёма</span></a>`);
  if (P.offlineVal) cells.push(`<a class="ex-stat" href="${esc(stath)}"><span class="ex-stat__v">${esc(P.offlineVal)}</span><span class="ex-stat__k">${esc(P.offlineLabel || "оффлайн-услуги")}</span></a>`);
  const statsRow = cells.length
    ? `<div class="ex-statwrap">${P.statsCaption ? `<span class="ex-stat__cap">${esc(P.statsCaption)}</span>` : ""}<div class="ex-stats">${cells.join("")}</div></div>` : "";

  // Каждое звено цепочки «почему сейчас» ведёт на страницу-доказательство (rynok/strategy).
  const bc = (d.businessCase || []).map((x, i, a) => {
    const inner = `<span class="bc-k">${esc(x.k)}</span>
      <span class="bc-t">${gloss(esc(x.t))}</span>
      ${x.href ? `<span class="bc-link">${esc(x.linkLabel || "подробнее")} →</span>` : ""}`;
    const step = x.href
      ? `<a class="bc-step bc-step--link" href="${esc(x.href)}">${inner}</a>`
      : `<span class="bc-step">${inner}</span>`;
    return `${step}${i < a.length - 1 ? `<span class="bc-arr" aria-hidden="true">→</span>` : ""}`;
  }).join("");

  // Ссылка «провалиться к развёрнутому ответу» — единый вид на всех строках саммари.
  const drill = (href, label) => href
    ? `<a class="ex-drill" href="${esc(href)}">${esc(label || "подробнее")} →</a>` : "";

  // Строка-факт со статусом достоверности (.ev-chip) + провал к подтверждению/гипотезе.
  const factItem = (f) => {
    const ev = f.ev ? evChip(f.ev) : null;
    return `<li class="ex-item">
      ${ev ? `<span class="ev-chip ${ev.cls}" title="${esc(ev.label)}" aria-label="статус: ${esc(ev.label)}">${ev.sign}</span>` : ""}
      <span class="ex-item__body"><span class="ex-item__t">${gloss(esc(f.t))}</span>${drill(f.href, f.linkLabel)}</span>
    </li>`;
  };
  const plainItem = (f) => `<li class="ex-item ex-item--plain">
      <span class="ex-item__body"><span class="ex-item__t">${gloss(esc(f.t))}</span>${drill(f.href, f.linkLabel)}</span>
    </li>`;

  // ── Визуально разделённые панели: факты / сделано / риски / шаги ──
  const factsPanel = (d.facts || []).length ? `
      <details class="ex-panel ex-panel--facts">
        <summary class="ex-panel__h">Ключевые факты <span class="ex-panel__sub">куда провалиться за подтверждением</span></summary>
        <ul class="ex-list">${d.facts.map(factItem).join("")}</ul>
      </details>` : "";
  const donePanel = (d.done || []).length ? `
      <details class="ex-panel ex-panel--done">
        <summary class="ex-panel__h">Сделано за квартал <span class="ex-count">${d.done.length}</span></summary>
        <ul class="ex-list">${d.done.map(plainItem).join("")}</ul>
        ${d.doneNote ? `<p class="ex-note ex-note--emph">${gloss(esc(d.doneNote))}</p>` : ""}
      </details>` : "";
  const risksPanel = (d.risks || []).length ? `
      <details class="ex-panel ex-panel--risk">
        <summary class="ex-panel__h">Главные риски <span class="ex-count">${d.risks.length}</span></summary>
        <ul class="ex-list">${d.risks.map(plainItem).join("")}</ul>
      </details>` : "";
  const stepsPanel = (d.steps || []).length ? `
      <details class="ex-panel ex-panel--step">
        <summary class="ex-panel__h">Следующие шаги — по приоритету <span class="ex-count">${d.steps.length}</span></summary>
        <ol class="ex-list ex-list--step">${d.steps.map(plainItem).join("")}</ol>
        <p class="ex-note"><a class="ex-drill" href="strategy.html#plan">полный порядок проверок — в стратегии →</a></p>
      </details>` : "";

  host.innerHTML = `
    <div class="ex-card">
      ${pyramid}
      ${statsRow}
      ${P.note ? `<p class="ex-note">${gloss(esc(P.note))}</p>` : ""}

      <div class="ex-section">
        <div class="ex-section__h">Почему сейчас — одной цепочкой</div>
        <div class="bc">${bc}</div>
      </div>

      ${d.tracks ? `<div class="ex-section">
        <div class="ex-section__h">${esc(d.tracks.title)}</div>
        <div class="ex-tracks">${(d.tracks.items || []).map((t) => `
          <a class="ex-track${t.focus ? " ex-track--focus" : ""}" href="${esc(t.href)}">
            <span class="ex-track__n">${esc(t.n)}</span>
            <span class="ex-track__b"><span class="ex-track__name">${esc(t.name)}</span>
            <span class="ex-track__owner">${(t.focus || t.owned) ? "✓ " : "⚠ "}${esc(t.owner)}</span></span>
          </a>`).join("")}</div>
        ${d.tracks.note ? `<p class="ex-note">${gloss(esc(d.tracks.note))}</p>` : ""}
      </div>` : ""}

      <div class="ex-panels">
        ${factsPanel}
        ${donePanel}
        ${risksPanel}
        ${stepsPanel}
      </div>
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
    // Ярлыки этапов/ролей для блока «два взгляда». Числа берём из home.json, тут только
    // подписи и привязка к якорям (как PROJ/NAV-конфиг — это навигация, не данные).
    const PROJ_STAGES = [
      { num: "1", name: "Не мешать",          tag: "s-1",  focus: true  },
      { num: "2", name: "Снимать нагрузку",    tag: "s-2a", focus: true  },
      { num: "3", name: "Сохранять экономику", tag: "s-3",  focus: false },
      { num: "4", name: "Увеличить маржу",     tag: "s-4",  focus: false },
      { num: "5", name: "Новые деньги",        tag: "s-5",  focus: false },
    ];
    const PROJ_ROLES = [
      { cls: "r-c", name: "Консультант" },
      { cls: "r-s", name: "Супервизор" },
      { cls: "r-r", name: "Руководитель" },
    ];
    const stageChips = PROJ_STAGES.map((s) =>
      `<a class="proj-stage${s.focus ? " is-focus" : ""}" href="etapy.html#stage-${s.num}">`
      + `<span class="stage-tag ${s.tag}">${s.num}</span>`
      + `<span class="proj-stage__n">${esc(s.name)}</span></a>`
    ).join("");
    const roleChips = PROJ_ROLES.map((r) =>
      `<a class="role-tag ${r.cls}" href="tree.html">${esc(r.name)}</a>`
    ).join("");
    let exBets = [];
    try { exBets = (await loadJSON("data/exec.json")).bets || []; } catch (e) { /* без ставок */ }
    const betCard = (b) => {
      const num = (stageCode(b.stage) || String(b.stage)).replace(/[^\d]/g, "") || "1";
      return `
        <a class="bet" href="etapy.html#stage-${num}">
          <div class="bet__top">
            <span class="bet__name">${esc(b.name)}</span>
            ${stageTag(b.stage, `этап ${esc(b.stage)} ${esc(b.stageName)}`)}
          </div>
          ${b.aim ? `<p class="bet__aim">${esc(b.aim)}</p>` : ""}
          <div class="bet__metric"><span class="bet__mh">Метрики</span> ${gloss(esc(b.metric))}</div>
        </a>`;
    };
    const betsBlock = exBets.length ? `<div class="bets">${exBets.map(betCard).join("")}</div>` : "";
    proj.innerHTML = `
      <div class="dash dash--proj">
        <p class="dash__lead">Одно направление — два взгляда: <b>зачем</b> мы это делаем (этапы ценности) и <b>кто</b> делает работу (роли). Фокус 2026 — две ставки на этапах 1–2.</p>
        ${betsBlock}
        <div class="proj2">
          <div class="proj2-card">
            <div class="proj2-card__head">
              <span class="proj2-card__q">зачем и когда</span>
              <a class="proj2-card__title" href="etapy.html">Этапы ценности →</a>
            </div>
            <div class="proj2-card__chips">${stageChips}</div>
            <div class="proj2-card__sub">${P.stages ?? 5} этапов · фокус ${esc(P.stagesFocus || "1–2")} · ${P.subgoals ?? 7} подцелей</div>
          </div>
          <div class="proj2-card">
            <div class="proj2-card__head">
              <span class="proj2-card__q">чья работа</span>
              <a class="proj2-card__title" href="tree.html">Дерево работ (JTBD) →</a>
            </div>
            <div class="proj2-card__chips">${roleChips}</div>
            <div class="proj2-card__sub">${P.treeRoles ?? 3} роли · работа по задачам (JTBD)</div>
          </div>
        </div>
        ${dlinks([
          { href: "strategy.html", label: "Полная стратегия (v5)" },
          { href: "vision.html", label: "Видение (портал)" },
          { href: "vision.html#karta", label: "Карта связей" },
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
    const legend = order.map(([k, cls]) =>
      `<a class="mleg" href="backlog.html?moscow=${encodeURIComponent(k)}"><span class="mleg__sw mbar__seg--${cls}"></span>${k} ${m[k] || 0}</a>`
    ).join("");
    const themeChips = (W.themes || []).map((t) =>
      `<a class="topic-chip" href="backlog.html?theme=${encodeURIComponent(t.name)}">${esc(t.name)} <b>${fmtInt(t.count)}</b></a>`
    ).join("");
    const topLine = W.topTitle
      ? `<div class="proj2-card__sub">ТОП по приоритету: <a href="backlog.html?q=${encodeURIComponent(W.topTitle)}">${esc(W.topTitle)}</a> · Final ${W.topFinal}</div>`
      : "";
    work.innerHTML = `
      <div class="dash dash--work">
        <p class="dash__lead">Где лежат конкретные задачи: плоский список со скорингом по приоритету и оглавление по темам.</p>
        <div class="proj2">
          <div class="proj2-card">
            <div class="proj2-card__head">
              <span class="proj2-card__q">по приоритету</span>
              <a class="proj2-card__title" href="backlog.html">Бэклог →</a>
            </div>
            <div class="mbar" role="img" aria-label="Распределение по MoSCoW">${bar}</div>
            <div class="mleg-row">${legend}</div>
            <div class="proj2-card__sub">${fmtInt(W.total)} задач · ${fmtInt(W.scored)} со скорингом · ${fmtInt(W.unscored)} без Effort</div>
            ${topLine}
          </div>
          <div class="proj2-card">
            <div class="proj2-card__head">
              <span class="proj2-card__q">по темам</span>
              <a class="proj2-card__title" href="levels.html">Каталог →</a>
            </div>
            <div class="proj2-card__chips">${themeChips}</div>
            <div class="proj2-card__sub">${(W.themes || []).length} тем · ${fmtInt(W.total)} задач</div>
          </div>
        </div>
        ${dlinks([
          { href: "metod.html", label: "Как оцениваем задачи (метод)" },
        ])}
      </div>`;
  }

  // --- Данные ---
  const data = document.querySelector('[data-dash="data"]');
  if (data) {
    const tiles = [
      { href: "agencies.html", k: "Агентства", n: fmtInt(D.agenciesActive),
        sub: `активных · ТОП-3 ${fmtPct(D.top3)} транзакций · ${fmtSigned(D.momPct)} м/м` },
      { href: "research.html", k: "Исследования", n: fmtInt(D.researchTotal),
        sub: `находок · ${D.researchConfirmed ?? "—"} подтверждены · ${D.researchClosed ?? "—"} закрыто` },
      { href: "metrics.html", k: "Метрики", n: `${D.metricsActive ?? "—"} + ${D.metricsTarget ?? "—"}`,
        sub: `активные + целевые · ${D.metricsBaseline ?? "—"} с baseline` },
      { href: "rynok.html", k: "Рынок", n: "БТ РФ 2026", nText: true,
        sub: "рост в ₽, спад в поездках · контр-тренд за рубежом" },
    ];
    data.innerHTML = `
      <div class="dash dash--data">
        <p class="dash__lead">Фактура под направлением — четыре источника: агентства, исследования, метрики и рынок.</p>
        <div class="src-tiles">
          ${tiles.map((t) => `
            <a class="src-tile" href="${t.href}">
              <div class="src-tile__k">${esc(t.k)} →</div>
              <div class="src-tile__n${t.nText ? " is-text" : ""}">${esc(t.n)}</div>
              <div class="src-tile__sub">${esc(t.sub)}</div>
            </a>`).join("")}
        </div>
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

// vision.html — счётчики из бэклога, чтобы не хардкодить (число задач + «дыры в данных»).
// Заполняет [data-bl-count] (всего задач) и [data-bl-holes] (без приоритета, по темам).
async function mountVisionStats() {
  const elCount = document.querySelector("[data-bl-count]");
  const elHoles = document.querySelector("[data-bl-holes]");
  if (!elCount && !elHoles) return;
  let d;
  try { d = await loadJSON("data/backlog.json"); }
  catch (e) { return; }
  const items = d.items || [];
  const total = d.count || items.length;
  if (elCount) elCount.textContent = total;
  if (elHoles) {
    const isHole = (it) => it.finalScore === null || it.finalScore === "" || it.finalScore === "—";
    const holes = items.filter(isHole);
    const byTheme = {};
    holes.forEach((it) => { const t = it.theme || "—"; byTheme[t] = (byTheme[t] || 0) + 1; });
    const parts = Object.entries(byTheme).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${n} «${t}»`);
    elHoles.textContent = `${holes.length} задач из ${total}` + (parts.length ? ` (${parts.join(" + ")})` : "");
  }
}

// JTBD-дерево (tree.html) — глоссарий по узлам/листьям
function mountJtbd() {
  if (!document.querySelector(".tree-cols")) return;
  glossifyDOM(document.getElementById("main"));
}

// Общий план 1+2 (plan-1-2.html) — расшифровка жаргона в готовом DOM (как у дерева)
function mountPlan12() {
  if (!document.querySelector("[data-plan]")) return;
  glossifyDOM(document.getElementById("main"));
}

// Выводы и статус (vyvody.html) — расшифровка жаргона в готовом DOM (как у плана 1+2)
function mountVyvody() {
  if (!document.querySelector("[data-vyvody]")) return;
  glossifyDOM(document.getElementById("main"));
}

// Свод по масштабу (masshtab.html) — та же диагностика по оси масштаба; расшифровка жаргона
function mountMasshtab() {
  if (!document.querySelector("[data-masshtab]")) return;
  glossifyDOM(document.getElementById("main"));
}

document.addEventListener("DOMContentLoaded", () => {
  mountHeader();
  mountFooter();
  mountBacklog();
  mountBacklog(INIT_CFG);       // initiatives.html — та же машина, [data-initiatives]
  mountLevels();
  mountJtbd();
  mountPlan12();
  mountVyvody();
  mountMasshtab();
  mountLegend();
  mountAgencies();
  mountSupportEcon();
  mountMetrics();
  mountResearch();
  mountSootv();
  mountPlanned();
  mountEtapy();
  mountConcepts();
  mountProjbar();
  mountExec();
  mountNow();
  mountDashboards();
  mountGuide();
  mountVisionStats();
});
