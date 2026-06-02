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
SOURCE_GLOB = "*v5*.xlsx"  # «Единый бэклог направления Агентства v5 (…).xlsx»
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
    matches = sorted(WORK_DIR.glob(SOURCE_GLOB))
    if not matches:
        sys.exit(f"Не найден источник {SOURCE_GLOB!r} в {WORK_DIR}")
    return matches[-1]  # самая свежая ревизия по имени


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
