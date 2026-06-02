/* Сайт направления «Агентства» — общий JS каркаса (итерация 0).
   Хедер на всех страницах + загрузка и отрисовка таблицы бэклога. */

const NAV = [
  { href: "index.html",    label: "Направление" },
  { href: "backlog.html",  label: "Бэклог" },
  { href: "must.html",     label: "Must", disabled: true },
  { href: "tree.html",     label: "Дерево", disabled: true },
  { href: "agencies.html", label: "Агентства", disabled: true },
  { href: "metrics.html",  label: "Метрики", disabled: true },
  { href: "legend.html",   label: "Легенды", disabled: true },
];

function currentPage() {
  const p = location.pathname.split("/").pop();
  return p || "index.html";
}

/** Общий хедер. Контейнер: <div data-header></div> */
function mountHeader() {
  const host = document.querySelector("[data-header]");
  if (!host) return;
  const cur = currentPage();
  const links = NAV.map((n) => {
    const active = n.href === cur ? " is-active" : "";
    if (n.disabled) {
      return `<a class="nav__soon" title="будет в следующих итерациях"
                 style="opacity:.4;cursor:not-allowed">${n.label}</a>`;
    }
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

/** Загрузка JSON с понятной ошибкой при открытии через file:// */
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

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

/** Голая таблица бэклога (итерация 0). Контейнер: <div data-backlog></div> */
async function mountBacklog() {
  const host = document.querySelector("[data-backlog]");
  if (!host) return;
  host.innerHTML = `<div class="loading">Загрузка бэклога…</div>`;
  let data;
  try {
    data = await loadJSON("data/backlog.json");
  } catch (e) {
    host.innerHTML = `<div class="error">${esc(e.message)}</div>`;
    return;
  }

  const items = data.items || [];
  const mustCount = items.filter((x) => x.moscow === "Must").length;
  const themes = new Set(items.map((x) => x.theme).filter(Boolean));

  const cols = [
    ["num", "#", "num"],
    ["moscow", "MoSCoW", "badge"],
    ["theme", "Тема", "muted"],
    ["level2", "Уровень 2", "muted"],
    ["iteration", "Итерация", "num"],
    ["title", "Название", "title"],
    ["stage", "Этап", "muted"],
    ["mechanism", "Механизм", "muted"],
    ["subgoal", "Подцель", "muted"],
    ["finalScore", "Final", "score"],
    ["gate", "Gate", "muted"],
  ];

  const thead = cols.map(([, label]) => `<th>${label}</th>`).join("");
  const rows = items.map((it) => {
    const tds = cols.map(([key, , kind]) => {
      if (kind === "badge") {
        const m = it[key];
        return `<td><span class="badge badge--${moscowClass(m)}">${esc(m ?? "—")}</span></td>`;
      }
      const cls = kind === "title" ? "title" : kind === "num" || kind === "score" ? kind : "muted";
      return `<td class="${cls}">${esc(it[key] ?? "—")}</td>`;
    }).join("");
    return `<tr>${tds}</tr>`;
  }).join("");

  host.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="v">${items.length}</div><div class="l">итераций</div></div>
      <div class="stat"><div class="v">${mustCount}</div><div class="l">Must</div></div>
      <div class="stat"><div class="v">${themes.size}</div><div class="l">тем</div></div>
    </div>
    <div class="table-wrap">
      <table class="backlog">
        <thead><tr>${thead}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  mountHeader();
  mountBacklog();
});
