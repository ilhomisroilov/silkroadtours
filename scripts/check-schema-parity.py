#!/usr/bin/env python3
"""Checks that drizzle/migrations/*.sql produce exactly the tables, columns, indexes and
CHECK constraints declared in src/db/schema.ts. No dependencies beyond Python 3.

Usage:  python3 scripts/check-schema-parity.py
"""
import glob
import os
import re
import sqlite3
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
schema_src = open(os.path.join(ROOT, "src/db/schema.ts"), encoding="utf-8").read()

# ── Parse schema.ts ────────────────────────────────────────────────────────
ts = {}
for m in re.finditer(r'export const \w+ = sqliteTable\(\s*"(\w+)",\s*\{(.*?)\n\s*\}(?:,\s*\(t\) => \[(.*?)\])?,?\s*\);', schema_src, re.S):
    name, cols_src, extras = m.group(1), m.group(2), m.group(3) or ""
    cols = set(re.findall(r'\b(?:integer|text|real)\("(\w+)"', cols_src))
    # helper factories createdAt()/updatedAt()/localized("x")
    if "createdAt()" in cols_src:
        cols.add("created_at")
    if "updatedAt()" in cols_src:
        cols.add("updated_at")
    cols |= set(re.findall(r'localized\("(\w+)"\)', cols_src))
    idx = set(re.findall(r'(?:uniqueIndex|index)\("(\w+)"\)', extras))
    checks = set(re.findall(r'check\(\s*"(\w+)"', extras))
    ts[name] = (cols, idx, checks)

# ── Apply migrations to an in-memory SQLite ────────────────────────────────
db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys = ON")
for f in sorted(glob.glob(os.path.join(ROOT, "drizzle/migrations/*.sql"))):
    db.executescript(open(f, encoding="utf-8").read())

sql_tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}
errors = []
if set(ts) != sql_tables:
    errors.append(f"tables differ: only in schema.ts={set(ts)-sql_tables}, only in SQL={sql_tables-set(ts)}")

for table, (cols, idx, checks) in ts.items():
    if table not in sql_tables:
        continue
    sql_cols = {r[1] for r in db.execute(f"PRAGMA table_info(`{table}`)")}
    if cols != sql_cols:
        errors.append(f"{table}: columns differ: schema.ts-only={cols-sql_cols}, SQL-only={sql_cols-cols}")
    sql_idx = {r[1] for r in db.execute(f"PRAGMA index_list(`{table}`)") if not r[1].startswith("sqlite_autoindex")}
    if idx != sql_idx:
        errors.append(f"{table}: indexes differ: schema.ts-only={idx-sql_idx}, SQL-only={sql_idx-idx}")
    ddl = db.execute("SELECT sql FROM sqlite_master WHERE name=?", (table,)).fetchone()[0]
    sql_checks = set(re.findall(r'CONSTRAINT "(\w+)" CHECK', ddl))
    if checks != sql_checks:
        errors.append(f"{table}: checks differ: schema.ts-only={checks-sql_checks}, SQL-only={sql_checks-checks}")

if errors:
    print("SCHEMA PARITY FAILED")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print(f"Schema parity OK: {len(ts)} tables, "
      f"{sum(len(v[0]) for v in ts.values())} columns, "
      f"{sum(len(v[1]) for v in ts.values())} indexes, "
      f"{sum(len(v[2]) for v in ts.values())} CHECK constraints.")
