"""Layer 5: 윤센이 — weekly WSI/Velocity/Divergence report generation."""
import json
from pathlib import Path

from .models import TaggedEvent, WeeklyMetrics
from .metrics import build_weekly_metrics
from .providers import call_provider

PROMPT_DIR = Path(__file__).parent.parent / "prompts" / "report"
BASE_PROMPT = (PROMPT_DIR / "base.txt").read_text(encoding="utf-8")

TICKERS_POC = ["005930", "000660", "MU"]


def group_by_ticker(events: list[TaggedEvent]) -> dict[str, list[TaggedEvent]]:
    result: dict[str, list[TaggedEvent]] = {t: [] for t in TICKERS_POC}
    for e in events:
        for ticker in e.tickers:
            if ticker in result:
                result[ticker].append(e)
    return result


def compute_all_metrics(events_now: list[TaggedEvent], events_prev: list[TaggedEvent],
                         week_start: str, provider: str) -> list[WeeklyMetrics]:
    now_by_ticker = group_by_ticker(events_now)
    prev_by_ticker = group_by_ticker(events_prev)
    metrics = []
    for ticker in TICKERS_POC:
        m = build_weekly_metrics(
            ticker=ticker,
            week_start=week_start,
            events_now=now_by_ticker.get(ticker, []),
            events_prev=prev_by_ticker.get(ticker, []),
            provider=provider,
        )
        metrics.append(m)
    return metrics


async def generate_report(metrics: list[WeeklyMetrics], provider: str,
                           tier: str = "high") -> str:
    metrics_json = json.dumps(
        [{"ticker": m.ticker, "wsi": m.wsi, "velocity": m.velocity,
          "divergence": m.divergence, "alerts": m.alerts, "event_count": m.event_count}
         for m in metrics],
        ensure_ascii=False, indent=2
    )
    messages = [
        {"role": "user", "content": BASE_PROMPT + "\n\n---\n" + metrics_json}
    ]
    result = await call_provider(provider, tier, messages)
    return result["content"]
