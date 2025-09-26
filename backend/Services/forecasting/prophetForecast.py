from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict

import sys
try:
    from prophet import Prophet
except ImportError:
    json.dump({"forecast": [], "error": "prophet_not_installed"}, sys.stdout)
    sys.exit(0)


def _parse_input(payload: Dict[str, Any]):
    history = payload.get("history", [])
    periods = int(payload.get("periods", 0))
    freq = payload.get("frequency", "D")
    if not history:
        raise ValueError("history data is required for forecasting")
    if periods <= 0:
        raise ValueError("periods must be greater than zero")

    dates = []
    values = []
    for point in history:
        ds = point.get("period") or point.get("date")
        y = point.get("value") or point.get("units_sold") or point.get("sales_amount")
        if ds is None or y is None:
            # skip incomplete records
            continue
        try:
            dt = datetime.fromisoformat(str(ds))
        except ValueError:
            dt = datetime.fromisoformat(str(ds).split("T")[0])
        dates.append(dt)
        values.append(float(y))

    if len(dates) == 0:
        raise ValueError("no valid historical points found")

    return dates, values, periods, freq


def main():
    raw = sys.stdin.read()
    payload = json.loads(raw)
    dates, values, periods, freq = _parse_input(payload)

    # Prepare dataframe
    try:
        from pandas import DataFrame
    except ImportError:
        json.dump({"forecast": [], "error": "pandas_not_installed"}, sys.stdout)
        return

    df = DataFrame({"ds": dates, "y": values})

    model = Prophet(interval_width=0.8)
    model.fit(df)

    future = model.make_future_dataframe(periods=periods, freq=freq)
    forecast = model.predict(future)

    # Only keep new rows (forecast tail)
    result = []
    history_len = len(df)
    for idx, row in forecast.iloc[history_len:].iterrows():
        result.append({
            "period": row["ds"].strftime("%Y-%m-%d"),
            "forecast": float(row["yhat"]),
            "forecast_lower": float(row["yhat_lower"]),
            "forecast_upper": float(row["yhat_upper"])
        })

    print(json.dumps({"forecast": result}))


if __name__ == "__main__":
    main()
