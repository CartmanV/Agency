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
from urllib.parse import quote

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
    cl_name2id = {}   # короткое имя из «Клиенты (NSM)» (IBC, ATH…) → id — для клиентских помесячных листов
    nsm_sheet = next((s for s in wb.sheetnames
                      if "клиент" in s.lower() and "(nsm)" in s.lower()), None) \
        or next((s for s in wb.sheetnames if "клиент" in s.lower() and "помесяч" not in s.lower()), None)
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
            aid = clean(r[0])
            if aid is not None:
                cl_name2id[cname] = aid
            rec_cl = by_id.get(aid)
            if rec_cl:
                rec_cl.update(cl)

    # --- помесячные ряды по месяцам (для графиков динамики и спарклайнов) ---
    # Только колонки вида «MM.YYYY» (служебные «Δ …» отбрасываем).
    def parse_monthly(sheet_name, resolve):
        rows_m = list(wb[sheet_name].iter_rows(values_only=True))
        hdr = [clean(x) for x in rows_m[0][1:]]
        keep = [i for i, h in enumerate(hdr) if h and re.match(r"^\d{2}\.\d{4}$", str(h))]
        months_m = [hdr[i] for i in keep]
        by_id_m, total_m = {}, None
        for r in rows_m[1:]:
            nm = clean(r[0])
            if not nm:
                continue
            series = [to_int(r[1 + i]) for i in keep]
            if str(nm).startswith("ИТОГО"):
                total_m = series
                continue
            aid = resolve(nm)
            if aid is not None:
                by_id_m[str(aid)] = series
        return {"months": months_m, "total": total_m, "byId": by_id_m}

    # Операции: лист «Помесячно L13M» (13 точек), имена полные → id агентства.
    name2id_full = {a["name"]: a["id"] for a in agencies}
    mon_ops_sheet = next((s for s in wb.sheetnames if "помесячно l13m" in s.lower()), None)
    monthly = parse_monthly(mon_ops_sheet, name2id_full.get) if mon_ops_sheet else None

    # Клиенты: лист «Клиенты помесячно L12M» (12 точек). Короткие имена расходятся между листами
    # («KazTour» vs «KazTour Corporate»…) — сопоставляем по точной карте, затем по подстроке.
    def resolve_client_id(nm):
        if nm in cl_name2id:
            return cl_name2id[nm]
        low = str(nm).lower()
        for a in agencies:
            full = str(a["name"]).lower()
            if low in full or full in low:
                return a["id"]
        for k, v in cl_name2id.items():
            kl = str(k).lower()
            if low in kl or kl in low:
                return v
        return None
    mon_cl_sheet = next((s for s in wb.sheetnames if "клиент" in s.lower() and "помесяч" in s.lower()), None)
    monthly_clients = parse_monthly(mon_cl_sheet, resolve_client_id) if mon_cl_sheet else None

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
        "monthlyClients": monthly_clients,
        "agencies": agencies,
    }


def find_work_xlsx(needle):
    """Файл *.xlsx, чьё имя (NFC, lower) содержит подстроку needle."""
    for p in WORK_DIR.glob("*.xlsx"):
        if needle in unicodedata.normalize("NFC", p.name).lower():
            return p
    return None


# --- нормализация доказательной базы (ТЗ 13) -----------------------------
# Единый словарь этапов. Любое значение в research/etapy/sootv обязано быть отсюда.
STAGE_VOCAB = ["1", "2A", "2B", "3", "4", "5", "клиент", "вне этапов"]

# Осознанные gap'ы H-кодов (преамбула Синтеза v2.1): гипотезы, под которые
# находок ещё нет намеренно, — линтер не считает их ошибкой, помечает «ожидаемо».
GAP_HCODES = {"H1.5", "H2.1-доп", "H3.1a", "H3.1b", "H3.5-канд", "H4.3-канд"}


def parse_stages(raw):
    """Строка этапа реестра → (массив этапов из словаря, флаг роли|None).
    "1/2B"→["1","2B"]; "3-4"→["3","4"]; "клиент/конс"→(["клиент"],"клиент/конс");
    "—"/пусто→["вне этапов"]."""
    if raw is None or str(raw).strip() in ("—", ""):
        return ["вне этапов"], None
    s = str(raw).strip()
    role = None
    if "конс" in s:                       # «клиент/конс» — клиентский этап, но роль = консультант
        role = "клиент/конс"
        s = re.sub(r"/?\s*конс\.?", "", s).strip(" /")
    parts = [p.strip() for p in re.split(r"[/\-]", s) if p.strip()]
    return (parts or ["вне этапов"]), role


def parse_hcodes(raw):
    """Строка H-кодов реестра → массив. "H1.3/H2.3"→["H1.3","H2.3"];
    "H2.4 (частично)"→["H2.4"]; "—"/«— (…)»→[]."""
    if raw is None or str(raw).strip().startswith("—"):
        return []
    codes, seen = [], set()
    for c in re.findall(r"H\d+\.\d+[a-zа-я]?", str(raw)):
        if c not in seen:
            seen.add(c); codes.append(c)
    return codes


def parse_block(raw):
    """Колонка «Источник» → код блока синтеза. "Синтез A"→"A"; "Блок1 …"→"1";
    "Синтез C / Блок4"→"C"; "Синтез / Боли-статус"→"—"."""
    if raw is None:
        return "—"
    s = str(raw).strip()
    m = re.match(r"Синтез\s+([A-ZА-Я])\b", s)
    if m:
        return m.group(1)
    m = re.match(r"Блок\s*(\d+)", s)
    if m:
        return m.group(1)
    return "—"


def research_anchor(fid):
    """Канон якоря находки: "A1"→"f-a1"; "4.2"→"f-4-2"; "7.1"→"f-7-1"."""
    s = re.sub(r"[./\\]+", "-", str(fid).strip().lower())
    return "f-" + s


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
        stage_raw, src_raw = cell(r, "Этап"), cell(r, "Источник")
        stages, stage_role = parse_stages(stage_raw)
        findings.append({
            "id": fid, "theme": cell(r, "Тема"), "finding": finding,
            "role": cell(r, "Роль"), "reach": reach or None, "reachCount": len(agencies),
            "hypStatus": cell(r, "Статус гипотезы"), "qty": cell(r, "Кол. данные"),
            "stage": stage_raw, "mechanism": cell(r, "Механизм"),
            "hCode": cell(r, "H"), "jtbd": cell(r, "JTBD (кратко)"),
            "status": cell(r, "Статус"), "src": src_raw,
            # --- нормализованные поля (ТЗ 13) ---
            "anchor": research_anchor(fid) if fid else None,
            "stages": stages, "stageRole": stage_role,
            "hCodes": parse_hcodes(cell(r, "H")),
            "block": parse_block(src_raw),
        })

    # --- валидация уникальности якорей ---
    anchors, dup = {}, []
    for f in findings:
        a = f.get("anchor")
        if a is None:
            continue
        if a in anchors:
            dup.append(f"{a} (id {anchors[a]!r} и {f['id']!r})")
        anchors[a] = f["id"]
    if dup:
        print(f"⚠ Реестр: неуникальные якоря находок ({len(dup)}): " + "; ".join(dup))

    return {"source": src.name, "count": len(findings), "findings": findings}


def lint_links(research, sootv=None):
    """Линтер связей доказательной базы (ТЗ 13, п.3). Не валит сборку —
    печатает расхождения: стратегический документ должен видеть свои дыры."""
    print("\n── Линтер связей ──")
    etapy_path = DATA_DIR / "etapy.json"
    if not etapy_path.exists():
        print("  etapy.json не найден — пропуск проверки H-кодов и ссылок.")
        return
    etapy = json.loads(etapy_path.read_text(encoding="utf-8"))
    findings = (research or {}).get("findings", [])

    def base(code):
        """H-код к базовому виду для сверки: «H3.5-канд»→«H3.5», «H3.1a»→«H3.1»."""
        m = re.match(r"(H\d+\.\d+)", str(code))
        return m.group(1) if m else None

    # покрытие гипотез находками
    research_bases = {base(c) for f in findings for c in f.get("hCodes", []) if base(c)}
    missing, gaps = [], []
    for st in etapy.get("stages", []):
        for h in st.get("hypotheses", []):
            code = h.get("code")
            b = base(code)
            if b is None:                              # H-Супервизор и т.п. — без номера
                continue
            if b in research_bases:
                continue
            if h.get("candidate") or code in GAP_HCODES or "канд" in str(code) or "доп" in str(code):
                gaps.append(code)
            else:
                missing.append(code)
    if missing:
        print(f"  ⚠ H-коды без находки в реестре ({len(missing)}): {', '.join(missing)}")
    if gaps:
        print(f"  · осознанные gap (ожидаемо, {len(gaps)}): {', '.join(gaps)}")
    if not missing:
        print("  ✓ все «боевые» H-коды этапов имеют находку (или числятся в gap)")

    # ссылки research:<id> / planned:<id> из etapy.json (появятся в ТЗ 15/17)
    ids = {f["id"] for f in findings if f.get("id")}
    blob = json.dumps(etapy, ensure_ascii=False)
    bad_ref = sorted({m for m in re.findall(r"research:([^\"\s,\]]+)", blob) if m not in ids})
    if bad_ref:
        print(f"  ⚠ ссылки research:<id> на несуществующие находки: {', '.join(bad_ref)}")
    planned_path = DATA_DIR / "planned.json"
    planned_ids = set()
    if planned_path.exists():
        pj = json.loads(planned_path.read_text(encoding="utf-8"))
        planned_ids = {x.get("id") for x in pj.get("items", pj.get("planned", []))}
    bad_pl = sorted({m for m in re.findall(r"planned:([^\"\s,\]]+)", blob)
                     if m not in planned_ids})
    if bad_pl:
        where = "planned.json" if planned_path.exists() else "planned.json (нет файла)"
        print(f"  ⚠ ссылки planned:<id> вне {where}: {', '.join(bad_pl)}")

    # связи-доказательства гипотез (ТЗ 15): evidence[].ref и researchTodo[].planned
    def iter_hyps():
        for st in etapy.get("stages", []):
            yield from st.get("hypotheses", [])
        if etapy.get("crossLayer", {}).get("churn"):
            yield etapy["crossLayer"]["churn"]
    ev_bad_r, ev_bad_p, todo_bad_p = set(), set(), set()
    for h in iter_hyps():
        for e in h.get("evidence", []):
            if e.get("kind") == "research" and e.get("ref") not in ids:
                ev_bad_r.add(e.get("ref"))
            if e.get("kind") == "planned" and e.get("ref") not in planned_ids:
                ev_bad_p.add(e.get("ref"))
    for st in etapy.get("stages", []):
        for t in st.get("researchTodo", []):
            if t.get("planned") and t["planned"] not in planned_ids:
                todo_bad_p.add(t["planned"])
    if ev_bad_r:
        print(f"  ⚠ evidence kind=research на несуществующие находки: {', '.join(sorted(ev_bad_r))}")
    if ev_bad_p or todo_bad_p:
        print(f"  ⚠ evidence/researchTodo kind=planned вне planned.json: {', '.join(sorted(ev_bad_p | todo_bad_p))}")
    if not (ev_bad_r or ev_bad_p or todo_bad_p):
        n_ev = sum(len(h.get("evidence", [])) for h in iter_hyps())
        print(f"  ✓ связи-доказательства этапов: {n_ev} чипов, битых research:/planned: ссылок нет")

    # словарь этапов: research.stages из единого словаря
    bad_stage = sorted({s for f in findings for s in f.get("stages", [])
                        if s not in STAGE_VOCAB})
    if bad_stage:
        print(f"  ⚠ этапы вне словаря {STAGE_VOCAB}: {', '.join(bad_stage)}")

    # словарь этапов в матрице соответствия (sootv): stageNum из единого словаря
    if sootv:
        bad_sn = sorted({r.get("stageNum") for r in sootv.get("rows", [])
                         if r.get("stageNum") not in STAGE_VOCAB})
        if bad_sn:
            print(f"  ⚠ sootv: stageNum вне словаря: {', '.join(bad_sn)}")
        unmatched = sootv["count"] - sootv.get("painMatched", 0)
        print(f"  · sootv: кодов боли без находки в реестре {unmatched} из {sootv['count']} "
              f"(описательные коды вроде «M-блок/паритет» — ожидаемо)")

    # находки «вне этапов» — для дозаполнения Владом в xlsx
    outside = [f["id"] for f in findings if f.get("stages") == ["вне этапов"]]
    if outside:
        print(f"  · находок «вне этапов» ({len(outside)}), этап дозаполнит Влад в реестре:")
        print("    " + ", ".join(outside))


def build_sootv(research):
    """Матрица соответствия (этап→гипотеза→боль→итерация→метрика) → sootv.json (ТЗ 16).
    Цитаты с названиями агентств оставляем; имена людей в реестре уже обезличены.
    painCode мапится на якорь реестра, где находка существует."""
    src = find_work_xlsx("соответствие исследован")
    if not src or "Матрица" not in openpyxl.load_workbook(src, read_only=True).sheetnames:
        return None
    wb = openpyxl.load_workbook(src, data_only=True, read_only=True)
    ws = wb["Матрица"]
    rows = list(ws.iter_rows(values_only=True))
    hdr = [clean(c) or "" for c in rows[0]]
    idx = {h: i for i, h in enumerate(hdr)}

    def cell(r, name):
        i = idx.get(name)
        return clean(r[i]) if i is not None and i < len(r) else None

    version = None
    if "Легенда" in wb.sheetnames:
        for r in wb["Легенда"].iter_rows(values_only=True):
            if r and r[0] and str(r[0]).strip().lower() == "версия":
                version = clean(r[1]); break

    def stage_main(raw):                       # «2A Сокращение…»→«2»; «1/2»→«1»
        m = re.match(r"\d+", str(raw or ""))
        return m.group(0) if m else "—"

    def split_plus(raw):                       # «H1.1+H1.2»→["H1.1","H1.2"]
        return [p.strip() for p in str(raw or "").split("+") if p.strip()] if raw else []

    def split_metrics(raw):                    # «↓ Parity gap; ↑ Adoption»→[…]
        return [p.strip() for p in re.split(r"[;·]", str(raw or "")) if p.strip()] if raw else []

    rids = {f["id"] for f in (research or {}).get("findings", []) if f.get("id")}
    rows_out, matched = [], 0
    for r in rows[1:]:
        if not any(r):
            continue
        pain_code = cell(r, "Код боли")
        anchor = research_anchor(pain_code) if pain_code in rids else None
        if anchor:
            matched += 1
        rows_out.append({
            "stage": cell(r, "Этап"), "stageNum": stage_main(cell(r, "Этап")),
            "block": cell(r, "Блок"), "hyps": split_plus(cell(r, "Гипотеза")),
            "hypStatus": cell(r, "Статус гипотезы"),
            "painCode": pain_code, "painAnchor": anchor,
            "pain": cell(r, "Суть боли"), "quote": cell(r, "Цитата / данные"),
            "mechanism": cell(r, "Механизм"), "iter": cell(r, "Итерация-кандидат"),
            "artifact": cell(r, "Артефакт (файл)"),
            "metricsActive": split_metrics(cell(r, "Активная метрика")),
            "metricsTarget": split_metrics(cell(r, "Целевая метрика")),
            "moscow": cell(r, "MoSCoW-ориентир"), "reach": cell(r, "Reach-сигнал"),
            "status": cell(r, "Статус"), "conflict": cell(r, "Конфликт / примечание"),
        })
    return {"source": src.name, "version": version, "count": len(rows_out),
            "painMatched": matched, "rows": rows_out}


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


def metric_anchor(code):
    """Зеркало slug метрики из app.js: «TTFO»→«m-ttfo», «T-op»→«m-t-op»."""
    s = re.sub(r"[^0-9a-zа-яё]+", "-", str(code).lower(), flags=re.I).strip("-")
    return "m-" + s


def _snippet(text, limit=140):
    t = " ".join(str(text or "").split())
    return t[: limit - 1] + "…" if len(t) > limit else t


def build_search(items, research, tree):
    """Лёгкий индекс для глобального поиска (ТЗ 08): находки · метрики · легенды · темы.
    Агентства не индексируем (приватные имена/выручка). Формат: {title, page, href, snippet, kind}."""
    idx = []

    # Темы направления (из дерева) → карта уровней
    for t in (tree or []):
        theme = t.get("theme")
        if not theme:
            continue
        idx.append({
            "title": theme, "page": "Темы", "kind": "тема",
            "href": f"levels.html?theme={quote(theme)}",
            "snippet": _snippet(f"{t.get('count', 0)} итераций, Must {t.get('mustCount', 0)}"),
        })

    # Находки исследований → research.html#f-<id>
    for f in ((research or {}).get("findings") or []):
        fid = f.get("id")
        if not fid:
            continue
        idx.append({
            "title": f"{fid} · {_snippet(f.get('finding'), 60)}", "page": "Исследования", "kind": "находка",
            "href": f"research.html#{research_anchor(fid)}",
            "snippet": _snippet(f.get("finding")),
        })

    # Метрики → metrics.html#m-<code>
    metrics = _load_data_json("metrics.json", {})
    for m in (metrics.get("metrics") or []):
        code = m.get("code")
        if not code:
            continue
        idx.append({
            "title": f"{code} — {m.get('name', '')}".strip(" —"), "page": "Метрики", "kind": "метрика",
            "href": f"metrics.html#{metric_anchor(code)}",
            "snippet": _snippet(m.get("measures")),
        })

    # Легенда (определения) → legend.html#<section.id>
    legend = _load_data_json("legend.json", {})
    for sec in (legend.get("sections") or []):
        sid = sec.get("id")
        for it in (sec.get("items") or []):
            term = it.get("term")
            if not term:
                continue
            anchor = it.get("id") or sid
            idx.append({
                "title": term, "page": "Легенды", "kind": "термин",
                "href": f"legend.html#{anchor}" if anchor else "legend.html",
                "snippet": _snippet(it.get("def")),
            })

    return idx


def _load_data_json(name, default):
    p = DATA_DIR / name
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return default


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

    # sootv.json — матрица соответствия (доказательная база, ТЗ 16)
    sootv = build_sootv(research)
    if sootv:
        s_out = DATA_DIR / "sootv.json"
        s_out.write_text(json.dumps(sootv, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Соответствие: {sootv['count']} строк матрицы · кодов боли с находкой "
              f"{sootv['painMatched']} → {s_out.relative_to(SITE_DIR)}")

    if research:
        lint_links(research, sootv)

    # home.json — сводка дашбордов главной
    home = build_home(items, agencies, research)
    home_out = DATA_DIR / "home.json"
    home_out.write_text(json.dumps(home, ensure_ascii=False, indent=2), encoding="utf-8")
    w, dd = home["work"], home["data"]
    print(f"Главная: бэклог {w['total']} (Must {w['mustCount']}) · агентства {dd['agenciesActive']} · находки {dd['researchTotal']} → {home_out.relative_to(SITE_DIR)}")

    # search.json — лёгкий индекс глобального поиска (ТЗ 08)
    search = build_search(items, research, tree)
    search_out = DATA_DIR / "search.json"
    search_out.write_text(json.dumps({"count": len(search), "index": search}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Поиск: индекс {len(search)} записей → {search_out.relative_to(SITE_DIR)}")

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
