#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build.py — сборка данных сайта направления «Агентства».

Итерация 0: читает единый бэклог v5.xlsx (вкладка «Бэклог», 219 итераций),
пересчитывает RICE и Final Score, валидирует и пишет site/data/backlog.json.

Принцип (см. «Сайт направления — архитектура и план», р. 3.1):
данные отдельно от представления. HTML не хранит чисел — читает data/*.json.

Запуск:  cd site && python build/build.py
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit("Нужен openpyxl:  pip3 install openpyxl")

# --- пути ---------------------------------------------------------------
SITE_DIR = Path(__file__).resolve().parent.parent          # site/
WORK_DIR = SITE_DIR.parent                                 # My work/  (источники)
DATA_DIR = SITE_DIR / "data"
SHEET = "Бэклог"

# Заголовок колонки xlsx -> ключ в JSON
COLUMNS = {
    "#": "num",
    "Статус": "status",
    "MoSCoW": "moscow",
    "Тема": "theme",
    "Уровень 2": "level2",
    "Итерация": "iteration",
    "ID гитлаб": "gitlabId",
    "Название": "title",
    "Проблема (Job Story)": "jobStory",
    "Проблема: источник": "problemSource",
    "Этап": "stage",
    "Блок": "block",
    "Механизм": "mechanism",
    "Подцель": "subgoal",
    "Гипотеза": "hypothesis",
    "Reach": "reach",
    "Impact": "impact",
    "Confidence": "confidence",
    "Effort": "effort",
    "RICE Score": "rice",
    "PV Mult": "pvMult",
    "Final Score": "finalScore",
    "Gate": "gate",
    "Концентрация": "concentration",
    "Цитата / данные": "quote",
    "Агентства (исследования)": "agencies",
    "Обоснование": "rationale",
    "PV Notes": "pvNotes",
    "Активные метрики": "activeMetrics",
    "Целевые метрики": "targetMetrics",
}

NUMERIC = {"num", "reach", "impact", "confidence", "effort", "pvMult"}


def slug(value):
    """Транслитерация в стабильный ascii-slug для id (тема/уровень)."""
    if value is None:
        return ""
    table = {
        "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
        "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
        "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
        "ф": "f", "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sch",
        "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
    }
    s = "".join(table.get(ch, ch) for ch in str(value).lower())
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def clean(value):
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def find_source():
    """Самый свежий файл единого бэклога (по версии vN) в папке My work.
    Устойчиво к ревизиям (v5 → v6 → …) и NFD/NFC-нормализации имён на macOS."""
    cands = []
    for p in WORK_DIR.glob("*.xlsx"):
        name = unicodedata.normalize("NFC", p.name)
        low = name.lower()
        if "бэклог направлени" in low and "соответствие" not in low and "черновик" not in low:
            m = re.search(r"\bv(\d+)\b", name)
            cands.append((int(m.group(1)) if m else 0, name, p))
    if not cands:
        sys.exit(f"Не найден файл единого бэклога (*.xlsx с «бэклог направления») в {WORK_DIR}")
    cands.sort(key=lambda c: (c[0], c[1]))
    return cands[-1][2]  # наивысшая версия


def build_backlog():
    src = find_source()
    print(f"Источник: {src.name}")
    wb = openpyxl.load_workbook(src, data_only=True, read_only=True)
    if SHEET not in wb.sheetnames:
        sys.exit(f"Нет вкладки {SHEET!r}. Есть: {wb.sheetnames}")
    ws = wb[SHEET]
    rows = list(ws.iter_rows(values_only=True))
    header = [clean(h) for h in rows[0]]

    missing = [c for c in COLUMNS if c not in header]
    if missing:
        sys.exit(f"В источнике нет колонок: {missing}")
    idx = {c: header.index(c) for c in COLUMNS}

    items, errors, seen_ids = [], [], set()
    for rnum, row in enumerate(rows[1:], start=2):
        if all(v is None for v in row):
            continue
        rec = {}
        for col, key in COLUMNS.items():
            val = clean(row[idx[col]])
            if key in NUMERIC and val is not None:
                try:
                    val = float(val)
                    if val == int(val):
                        val = int(val)
                except (TypeError, ValueError):
                    pass
            rec[key] = val

        # --- пересчёт RICE и Final (формулы в xlsx не закешированы) ---
        r, i, c, e = rec.get("reach"), rec.get("impact"), rec.get("confidence"), rec.get("effort")
        pv = rec.get("pvMult")
        if None not in (r, i, c, e) and e:
            rec["rice"] = round((r * i * c) / e)
        else:
            rec["rice"] = None
        if rec["rice"] is not None and pv is not None:
            rec["finalScore"] = round(rec["rice"] * pv)
        else:
            rec["finalScore"] = None

        # --- стабильный id: <тема>-<уровень2>-<#> (повтор тема==L2 схлопываем) ---
        parts, prev = [], None
        for p in (slug(rec.get("theme")), slug(rec.get("level2")), str(rec.get("num"))):
            if p and p != prev:
                parts.append(p)
            prev = p
        rec_id = "-".join(parts)
        rec["id"] = rec_id
        rec["cardPath"] = None  # гибрид карточек L3 — позже (итерация 3)

        # --- валидация ---
        if rec_id in seen_ids:
            errors.append(f"строка {rnum}: дубль id {rec_id!r}")
        seen_ids.add(rec_id)
        if not rec.get("subgoal"):
            errors.append(f"строка {rnum} ({rec_id}): пустая подцель")
        if not rec.get("hypothesis"):
            errors.append(f"строка {rnum} ({rec_id}): пустая гипотеза")

        items.append(rec)

    return items, errors


def build_tree(items):
    """Иерархия Тема (L1) → Уровень 2 → Итерация (ссылка на backlog id).
    Лестница и механизмы — оси-бейджи, не ветви (см. план р. 4.2)."""
    from collections import OrderedDict
    themes = OrderedDict()
    for it in items:
        th = it.get("theme") or "—"
        l2 = it.get("level2") or "—"
        themes.setdefault(th, OrderedDict()).setdefault(l2, []).append({
            "id": it["id"], "num": it["num"], "title": it.get("title"),
            "iteration": it.get("iteration"), "moscow": it.get("moscow"),
            "stage": it.get("stage"), "mechanism": it.get("mechanism"),
            "subgoal": it.get("subgoal"), "finalScore": it.get("finalScore"),
            "gate": it.get("gate"),
        })
    tree = []
    for th, l2map in themes.items():
        l2list, tcount, tmust = [], 0, 0
        for l2, arr in l2map.items():
            tcount += len(arr)
            tmust += sum(1 for x in arr if x["moscow"] == "Must")
            l2list.append({"name": l2, "count": len(arr), "items": arr})
        tree.append({"theme": th, "count": tcount, "mustCount": tmust, "level2": l2list})
    tree.sort(key=lambda t: -t["count"])
    return tree


def build_legend(src):
    """Вкладка «Легенда» (термин→определение, секции ВЕРХним регистром) → legend.json."""
    wb = openpyxl.load_workbook(src, data_only=True, read_only=True)
    if "Легенда" not in wb.sheetnames:
        return None
    ws = wb["Легенда"]
    rows = list(ws.iter_rows(values_only=True))

    # чистые id для известных секций (по ключевому слову заголовка)
    def section_id(title):
        t = title.lower()
        for key, sid in (("о файле", "about"), ("как читать", "columns"),
                         ("механизм", "mechanisms"), ("подцель", "subgoals"),
                         ("этап", "stages"), ("скоринг", "scoring"),
                         ("метрик", "metrics"), ("пристыков", "research")):
            if key in t:
                return sid
        return slug(title) or "section"

    sections, cur = [], None
    for r in rows[1:]:  # row0 — общий заголовок файла
        a = clean(r[0])
        b = clean(r[1]) if len(r) > 1 else None
        if a and not b:                       # заголовок секции
            cur = {"id": section_id(a), "title": a, "items": []}
            sections.append(cur)
        elif a and b and cur is not None:     # термин → определение
            cur["items"].append({"id": f"{cur['id']}--{slug(a)}", "term": a, "def": b})
    return {"source": src.name, "sections": sections,
            "count": sum(len(s["items"]) for s in sections)}


def find_agencies_source():
    """Файл «Свод по агентствам …xlsx» (устойчиво к NFD/NFC и дате)."""
    cands = []
    for p in WORK_DIR.glob("*.xlsx"):
        if "свод по агентствам" in unicodedata.normalize("NFC", p.name).lower():
            cands.append(p)
    return sorted(cands)[-1] if cands else None


def build_agencies():
    """Свод по агентствам (срез) → agencies.json: на агентство + агрегаты направления."""
    src = find_agencies_source()
    if not src:
        return None
    wb = openpyxl.load_workbook(src, data_only=True, read_only=True)
    sheet = next((s for s in wb.sheetnames if "свод" in s.lower()), wb.sheetnames[0])
    rows = list(wb[sheet].iter_rows(values_only=True))

    def num(v):
        if v is None or v == "":
            return None
        try:
            return round(float(v), 4)
        except (TypeError, ValueError):
            return None

    agencies, total = [], None
    for r in rows[1:]:
        name = clean(r[1])
        if not name:
            continue
        rec = {
            "name": name, "segment": clean(r[2]),
            "may": num(r[3]), "apr": num(r[4]), "momPct": num(r[5]),
            "l3m": num(r[6]), "l6m": num(r[7]), "may25": num(r[8]), "yoyPct": num(r[9]),
            "sharePct": num(r[10]), "band": clean(r[11]),
        }
        if str(name).startswith("ИТОГО"):
            total = {"may": rec["may"], "apr": rec["apr"], "momPct": rec["momPct"], "count": len(agencies)}
            continue
        rec["id"] = clean(r[0])
        agencies.append(rec)

    # --- лист «Клиенты (NSM)»: число активных клиентов на агентство — прокси North Star Metric ---
    # Колонки: ID · Агентство · Активных L6M · Активных (посл. мес.) · Клиентов 3 мес. назад ·
    #          Клиентов сейчас · Новые · Ушедшие · Чистая дельта (NSM). Сливаем по id в агентство.
    def to_int(v):
        n = num(v)
        return int(round(n)) if n is not None else None

    nsm_total = None
    nsm_sheet = next((s for s in wb.sheetnames if "клиент" in s.lower()), None)
    if nsm_sheet:
        by_id = {a["id"]: a for a in agencies}
        for r in wb[nsm_sheet].iter_rows(min_row=2, values_only=True):
            cname = clean(r[1]) if len(r) > 1 else None
            if not cname:
                continue
            cl = {
                "clL6m": to_int(r[2]), "clActiveMo": to_int(r[3]),
                "clAgo": to_int(r[4]), "clNow": to_int(r[5]),
                "clNew": to_int(r[6]), "clLost": to_int(r[7]), "clNet": to_int(r[8]),
            }
            if str(cname).startswith("ИТОГО"):
                nsm_total = {
                    "l6m": cl["clL6m"], "activeMo": cl["clActiveMo"],
                    "ago": cl["clAgo"], "now": cl["clNow"],
                    "new": cl["clNew"], "lost": cl["clLost"], "net": cl["clNet"],
                }
                continue
            rec_cl = by_id.get(clean(r[0]))
            if rec_cl:
                rec_cl.update(cl)

    # --- лист «Помесячно L13M»: ряд операций по месяцам (13 точек) на агентство + ИТОГО ---
    # Для графика динамики (area по ИТОГО) и спарклайнов в таблице. Сопоставляем по имени.
    monthly = None
    mon_sheet = next((s for s in wb.sheetnames if "помесячно" in s.lower()), None)
    if mon_sheet:
        mrows = list(wb[mon_sheet].iter_rows(values_only=True))
        months = [clean(x) for x in mrows[0][1:] if clean(x)]
        name2id = {a["name"]: a["id"] for a in agencies}
        by_id_mon, mon_total = {}, None
        for r in mrows[1:]:
            nm = clean(r[0])
            if not nm:
                continue
            series = [to_int(v) for v in r[1:1 + len(months)]]
            if str(nm).startswith("ИТОГО"):
                mon_total = series
                continue
            aid = name2id.get(nm)
            if aid is not None:
                by_id_mon[str(aid)] = series
        monthly = {"months": months, "total": mon_total, "byId": by_id_mon}

    shares = sorted((a["sharePct"] or 0) for a in agencies)[::-1]
    top3 = round(sum(shares[:3]), 4)
    top5 = round(sum(shares[:5]), 4)

    # читаем мета-заметку из вкладки «Легенда» свода (если есть)
    note = None
    if "Легенда" in wb.sheetnames:
        for r in wb["Легенда"].iter_rows(values_only=True):
            if r and r[0] and "источник" in str(r[0]).lower():
                note = clean(r[1]); break

    return {
        "source": src.name, "cut": "31.05.2026", "metric": "операции (ops)",
        "note": note, "total": total,
        "concentration": {"top3": top3, "top5": top5},
        "nsm": nsm_total,
        "monthly": monthly,
        "agencies": agencies,
    }


def find_work_xlsx(needle):
    """Файл *.xlsx, чьё имя (NFC, lower) содержит подстроку needle."""
    for p in WORK_DIR.glob("*.xlsx"):
        if needle in unicodedata.normalize("NFC", p.name).lower():
            return p
    return None


def build_research():
    """Реестр исследований (90 строк) → research.json. Имена людей обезличиваем."""
    src = find_work_xlsx("реестр исследован")
    if not src:
        return None
    wb = openpyxl.load_workbook(src, data_only=True, read_only=True)
    sheet = next((s for s in wb.sheetnames if "реестр" in s.lower()), wb.sheetnames[0])
    rows = list(wb[sheet].iter_rows(values_only=True))
    hdr = [clean(c) or "" for c in rows[0]]
    idx = {h: i for i, h in enumerate(hdr)}

    def cell(r, name):
        i = idx.get(name)
        return clean(r[i]) if i is not None and i < len(r) else None

    findings = []
    for r in rows[1:]:
        fid = cell(r, "ID")
        finding = cell(r, "Боль / находка")
        if not fid and not finding:
            continue
        reach_raw = cell(r, "Подтв. агентства (Reach)") or ""
        # обезличиваем: убираем скобки с именами людей
        reach = re.sub(r"\s*\([^)]*\)", "", str(reach_raw)).strip(" ·,")
        agencies = [a.strip() for a in re.split(r"[,/+]| и ", reach) if a.strip() and a.strip() != "—"]
        findings.append({
            "id": fid, "theme": cell(r, "Тема"), "finding": finding,
            "role": cell(r, "Роль"), "reach": reach or None, "reachCount": len(agencies),
            "hypStatus": cell(r, "Статус гипотезы"), "qty": cell(r, "Кол. данные"),
            "stage": cell(r, "Этап"), "mechanism": cell(r, "Механизм"),
            "hCode": cell(r, "H"), "jtbd": cell(r, "JTBD (кратко)"),
            "status": cell(r, "Статус"), "src": cell(r, "Источник"),
        })
    return {"source": src.name, "count": len(findings), "findings": findings}


def build_home(items, agencies, research):
    """Сводка для дашбордов главной (Проекции / Работа / Данные) → home.json.
    Цифры считаем здесь, а не хардкодим в HTML. Авторские слои (lestnica/concepts/
    metrics/exec) читаем из готовых data/*.json — это счётчики, не источник истины."""
    def load(name, default=None):
        p = DATA_DIR / name
        if not p.exists():
            return default
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            return default

    # --- Работа: бэклог ---
    moscow_order = ["Must", "Should", "Could", "Won't"]
    moscow = {k: sum(1 for x in items if x.get("moscow") == k) for k in moscow_order}
    scored = sum(1 for x in items if isinstance(x.get("finalScore"), (int, float)))
    themes = {}
    for x in items:
        t = x.get("theme")
        if t:
            themes[t] = themes.get(t, 0) + 1
    themes_sorted = sorted(themes.items(), key=lambda kv: kv[1], reverse=True)
    top = max(
        (x for x in items if isinstance(x.get("finalScore"), (int, float))),
        key=lambda x: x["finalScore"], default=None,
    )
    work = {
        "total": len(items),
        "moscow": moscow,
        "scored": scored,
        "unscored": len(items) - scored,
        "topTitle": (top or {}).get("title"),
        "topFinal": (top or {}).get("finalScore"),
        "themes": [{"name": n, "count": c} for n, c in themes_sorted],
        "mustCount": moscow.get("Must", 0),
    }

    # --- Данные: агентства + исследования + метрики + рынок ---
    findings = (research or {}).get("findings", [])
    confirmed = sum(1 for f in findings if str(f.get("hypStatus") or "").startswith("подтв"))
    closed = sum(1 for f in findings if str(f.get("hypStatus") or "") == "закрыто")
    metrics = load("metrics.json", {})
    mlist = metrics.get("metrics", []) if isinstance(metrics, dict) else []
    data_block = {
        "agenciesActive": (agencies or {}).get("total", {}).get("count"),
        "opsMay": (agencies or {}).get("total", {}).get("may"),
        "momPct": (agencies or {}).get("total", {}).get("momPct"),
        "top3": (agencies or {}).get("concentration", {}).get("top3"),
        "top5": (agencies or {}).get("concentration", {}).get("top5"),
        "researchTotal": (research or {}).get("count"),
        "researchConfirmed": confirmed,
        "researchClosed": closed,
        "metricsActive": sum(1 for m in mlist if m.get("type") == "active"),
        "metricsTarget": sum(1 for m in mlist if m.get("type") == "target"),
        "metricsBaseline": sum(1 for m in mlist if m.get("baseline")),
    }

    # --- Проекции: видение / лестница / концепции / дерево ---
    exec_data = load("exec.json", {})
    ladder = load("ladder.json", {})
    concepts = load("concepts.json", {})
    clist = concepts.get("concepts", []) if isinstance(concepts, dict) else []
    proj = {
        "goal": (exec_data.get("progress") or {}).get("goal"),
        "stages": len(ladder.get("stages", [])) if isinstance(ladder, dict) else None,
        "stagesFocus": "1–2",
        "subgoals": len(ladder.get("subgoalMap", [])) if isinstance(ladder, dict) else None,
        "concepts": len(clist),
        "conceptsFocus": sum(1 for c in clist if c.get("q2") == "focus"),
        "conceptsPartial": sum(1 for c in clist if c.get("q2") == "partial"),
        "conceptsOut": sum(1 for c in clist if c.get("q2") == "out"),
        "treeRoles": 3,  # JTBD: консультант / супервизор / руководитель (редакторская онтология)
        "betsNames": [b.get("name") for b in exec_data.get("bets", [])],
    }

    return {
        "_meta": "Сводка дашбордов главной. Считается build.py из backlog/agencies/research + авторских JSON.",
        "projections": proj,
        "work": work,
        "data": data_block,
    }


def main():
    items, errors = build_backlog()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    out = DATA_DIR / "backlog.json"
    payload = {
        "source": find_source().name,
        "count": len(items),
        "columns": list(COLUMNS.values()),
        "items": items,
    }
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Записано {len(items)} итераций → {out.relative_to(SITE_DIR)}")

    # tree.json — дерево из того же источника
    tree = build_tree(items)
    tree_out = DATA_DIR / "tree.json"
    tree_out.write_text(json.dumps({
        "source": find_source().name,
        "count": len(items),
        "themes": len(tree),
        "tree": tree,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Дерево: {len(tree)} тем × Уровень 2 × итерации → {tree_out.relative_to(SITE_DIR)}")

    # legend.json — справочник из вкладки «Легенда»
    legend = build_legend(find_source())
    if legend:
        legend_out = DATA_DIR / "legend.json"
        legend_out.write_text(json.dumps(legend, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Легенда: {len(legend['sections'])} секций · {legend['count']} определений → {legend_out.relative_to(SITE_DIR)}")

    # agencies.json — свод по агентствам
    agencies = build_agencies()
    if agencies:
        ag_out = DATA_DIR / "agencies.json"
        ag_out.write_text(json.dumps(agencies, ensure_ascii=False, indent=2), encoding="utf-8")
        c = agencies["concentration"]
        print(f"Агентства: {len(agencies['agencies'])} активных · ТОП-3 {c['top3']:.0%} / ТОП-5 {c['top5']:.0%} → {ag_out.relative_to(SITE_DIR)}")

    # research.json — реестр исследований
    research = build_research()
    if research:
        r_out = DATA_DIR / "research.json"
        r_out.write_text(json.dumps(research, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Исследования: {research['count']} находок → {r_out.relative_to(SITE_DIR)}")

    # home.json — сводка дашбордов главной
    home = build_home(items, agencies, research)
    home_out = DATA_DIR / "home.json"
    home_out.write_text(json.dumps(home, ensure_ascii=False, indent=2), encoding="utf-8")
    w, dd = home["work"], home["data"]
    print(f"Главная: бэклог {w['total']} (Must {w['mustCount']}) · агентства {dd['agenciesActive']} · находки {dd['researchTotal']} → {home_out.relative_to(SITE_DIR)}")

    must = sum(1 for x in items if x.get("moscow") == "Must")
    print(f"  Must: {must}  ·  с Final Score: {sum(1 for x in items if x['finalScore'] is not None)}")

    if errors:
        print(f"\n⚠ Предупреждения валидации ({len(errors)}):")
        for msg in errors[:30]:
            print("  -", msg)
        if len(errors) > 30:
            print(f"  … ещё {len(errors) - 30}")
    else:
        print("Валидация: ошибок нет.")


if __name__ == "__main__":
    main()
