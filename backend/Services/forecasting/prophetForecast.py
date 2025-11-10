from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List

import sys
try:
    from prophet import Prophet
except ImportError:
    json.dump({"forecast": [], "error": "prophet_not_installed"}, sys.stdout)
    sys.exit(0)


# History windows and smoothing heuristics keyed by Prophet frequency strings.
_HISTORY_WINDOWS_YEARS = {
    "D": 1,
    "W": 2,
    "M": 3,
    "Y": 5,
}
_DEFAULT_HISTORY_YEARS = 3
_MIN_POINTS_REQUIRED = {
    "D": 30,
    "W": 12,
    "M": 6,
    "Y": 4,
}
_CLAMP_MULTIPLIERS = {
    "D": 1.8,
    "W": 1.9,
    "M": 2.0,
    "Y": 2.1,
}
_RECENT_WINDOWS = {
    "D": 45,
    "W": 16,
    "M": 18,
    "Y": 6,
}
_FREQ_ALIGNERS = {
    "D": "D",
    "W": "W-MON",
    "M": "MS",
    "Y": "YS",
}


def _parse_input(payload: Dict[str, Any]):
    history = payload.get("history", [])
    periods = int(payload.get("periods", 0))
    freq = str(payload.get("frequency", "D") or "D").upper()
    if not history:
        raise ValueError("history data is required for forecasting")
    if periods <= 0:
        raise ValueError("periods must be greater than zero")

    dates: List[datetime] = []
    values: List[float] = []
    for point in history:
        ds = point.get("period") or point.get("date")
        y = point.get("value") or point.get("units_sold") or point.get("sales_amount")
        if ds is None or y is None:
            continue
        try:
            dt = datetime.fromisoformat(str(ds))
        except ValueError:
            try:
                dt = datetime.fromisoformat(str(ds).split("T")[0])
            except ValueError:
                continue
        try:
            value = float(y)
        except (TypeError, ValueError):
            continue

        dates.append(dt)
        values.append(value)

    if not dates:
        raise ValueError("no valid historical points found")

    return dates, values, periods, freq


def _align_frequency(series, freq: str):
    try:
        import pandas as pd
    except ImportError:
        json.dump({"forecast": [], "error": "pandas_not_installed"}, sys.stdout)
        sys.exit(0)

    df = pd.DataFrame(series, columns=["ds", "y"]).sort_values("ds")
    df["ds"] = pd.to_datetime(df["ds"], utc=False)

    if freq == "W":
        df["ds"] = df["ds"].dt.to_period("W-MON").dt.start_time
    elif freq == "M":
        df["ds"] = df["ds"].dt.to_period("M").dt.to_timestamp()
    elif freq == "Y":
        df["ds"] = df["ds"].dt.to_period("Y").dt.to_timestamp()

    df = df.groupby("ds", as_index=False)["y"].sum()
    if df.empty:
        return df

    aligner = _FREQ_ALIGNERS.get(freq, "D")
    full_index = pd.date_range(start=df["ds"].min(), end=df["ds"].max(), freq=aligner)
    df = df.set_index("ds").reindex(full_index)
    df["y"] = df["y"].fillna(0.0)
    df = df.reset_index().rename(columns={"index": "ds"})
    return df


def _trim_history(df, freq: str):
    try:
        import pandas as pd
    except ImportError:
        json.dump({"forecast": [], "error": "pandas_not_installed"}, sys.stdout)
        sys.exit(0)

    if df.empty:
        return df

    target_years = _HISTORY_WINDOWS_YEARS.get(freq, _DEFAULT_HISTORY_YEARS)
    min_points = _MIN_POINTS_REQUIRED.get(freq, 6)

    def filter_by_years(years: int):
        if years <= 0:
            return df
        last_ds = df["ds"].max()
        if pd.isna(last_ds):
            return df
        window_start = last_ds - pd.DateOffset(years=years)
        trimmed = df[df["ds"] >= window_start]
        return trimmed

    trimmed = filter_by_years(target_years)
    if len(trimmed) < min_points:
        trimmed = filter_by_years(_DEFAULT_HISTORY_YEARS)
    if len(trimmed) < 2:
        return df.tail(2)
    return trimmed


def _stabilize_predictions(forecast_df, history_df, freq: str):
    try:
        import pandas as pd
    except ImportError:
        json.dump({"forecast": [], "error": "pandas_not_installed"}, sys.stdout)
        sys.exit(0)

    if forecast_df.empty or history_df.empty:
        return forecast_df

    recent_window = _RECENT_WINDOWS.get(freq, 12)
    history_tail = history_df.tail(recent_window) if recent_window > 0 else history_df
    if history_tail.empty:
        history_tail = history_df

    recent_avg = float(history_tail["y"].mean() or 0.0)
    overall_avg = float(history_df["y"].mean() or 0.0)
    base_avg = max(recent_avg, overall_avg)
    if base_avg <= 0:
        base_avg = float(history_df["y"].max() or 0.0)

    recent_peak = float(history_tail["y"].max() or 0.0)
    overall_peak = float(history_df["y"].max() or 0.0)
    multiplier = _CLAMP_MULTIPLIERS.get(freq, 1.9)

    cap_candidates = [recent_peak * 1.5, overall_peak * 1.25, base_avg * multiplier]
    positive_caps = [value for value in cap_candidates if value and value > 0]
    cap_value = max(positive_caps) if positive_caps else 0.0
    if cap_value <= 0:
        return forecast_df.clip(lower=0.0)

    floor_value = 0.0
    forecast_df = forecast_df.copy()
    for column in ("yhat", "yhat_lower", "yhat_upper"):
        forecast_df[column] = forecast_df[column].clip(lower=floor_value, upper=cap_value)

    forecast_df["yhat_lower"] = forecast_df[["yhat_lower", "yhat"]].min(axis=1)
    forecast_df["yhat_upper"] = forecast_df[["yhat_upper", "yhat"]].max(axis=1)
    return forecast_df


def main():
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw or "{}")
    except json.JSONDecodeError:
        json.dump({"forecast": [], "error": "invalid_payload"}, sys.stdout)
        return

    try:
        dates, values, periods, freq = _parse_input(payload)
    except ValueError as exc:
        json.dump({"forecast": [], "error": str(exc)}, sys.stdout)
        return

    history_df = _align_frequency(list(zip(dates, values)), freq)
    if history_df.empty or len(history_df) < 2:
        json.dump({"forecast": [], "error": "insufficient_history"}, sys.stdout)
        return

    history_df = _trim_history(history_df, freq).reset_index(drop=True)
    if history_df.empty or len(history_df) < 2:
        json.dump({"forecast": [], "error": "insufficient_history"}, sys.stdout)
        return

    model_kwargs = {
        "interval_width": 0.8,
        "seasonality_mode": "multiplicative",
        "growth": "linear",
        "changepoint_prior_scale": 0.12,
    }

    if freq in ("W", "M", "Y"):
        model_kwargs["daily_seasonality"] = False
    if freq in ("M", "Y"):
        model_kwargs["weekly_seasonality"] = False
    if freq == "Y":
        model_kwargs["yearly_seasonality"] = False

    try:
        model = Prophet(**model_kwargs)

        if freq in ("M", "Y"):
            # Capture slower demand shifts for aggregated data without overfitting.
            model.add_seasonality(name="quarterly", period=91.25, fourier_order=5)

        model.fit(history_df)

        future = model.make_future_dataframe(
            periods=periods,
            freq=_FREQ_ALIGNERS.get(freq, "D")
        )
        forecast = model.predict(future)
    except Exception as exc:  # Prophet occasionally throws obscure errors; surface them gracefully.
        json.dump({"forecast": [], "error": f"prophet_failure: {exc}"}, sys.stdout)
        return

    forecast_tail = forecast.iloc[len(history_df):].copy()
    forecast_tail = _stabilize_predictions(forecast_tail, history_df, freq)

    if forecast_tail.empty:
        print(json.dumps({"forecast": []}))
        return

    result = []
    for _, row in forecast_tail.iterrows():
        result.append({
            "period": row["ds"].strftime("%Y-%m-%d"),
            "forecast": float(row["yhat"]),
            "forecast_lower": float(row["yhat_lower"]),
            "forecast_upper": float(row["yhat_upper"])
        })

    print(json.dumps({"forecast": result}))


if __name__ == "__main__":
    main()
