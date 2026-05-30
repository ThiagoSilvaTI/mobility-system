#!/usr/bin/env python3
"""
Script opcional de análise — lê o SQLite e gera relatório de mobilidade.
Uso: python scripts/analytics.py
"""
import sqlite3
import json
from pathlib import Path

DB = Path(__file__).resolve().parent.parent / "database" / "mobilidade.db"


def main():
    if not DB.exists():
        print("Execute primeiro: npm run init-db && npm start")
        return

    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("SELECT SUM(passageiros_dia) as total FROM metricas_regiao")
    passageiros = cur.fetchone()["total"]

    cur.execute("SELECT regiao, demanda FROM metricas_regiao ORDER BY demanda DESC LIMIT 1")
    top = cur.fetchone()

    cur.execute("SELECT SUM(co2_kg) as co2 FROM metricas_regiao")
    co2 = cur.fetchone()["co2"]

    relatorio = {
        "passageiros_dia_total": passageiros,
        "regiao_maior_demanda": dict(top) if top else None,
        "co2_total_kg": co2,
        "recomendacao": f"Priorizar frota na região {top['regiao']}" if top else "Sem dados",
    }

    print(json.dumps(relatorio, indent=2, ensure_ascii=False))
    conn.close()


if __name__ == "__main__":
    main()
