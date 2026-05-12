from dataclasses import dataclass, field
from typing import Optional
import uuid
from datetime import datetime, timezone


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@dataclass
class TaggedEvent:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    ingested_at: str = field(default_factory=_now_iso)
    source_channel: str = ""
    channel_tier: int = 4
    channel_weight: float = 0.2
    tickers: list[str] = field(default_factory=list)
    sectors: list[str] = field(default_factory=list)
    event_type: str = "news"  # report | news | comment | earnings | macro
    sentiment_score: Optional[float] = None   # -1.0 ~ 1.0
    sentiment_label: Optional[str] = None     # very_negative | negative | neutral | positive | very_positive
    conviction: Optional[float] = None        # 0.0 ~ 1.0
    key_claims: list[str] = field(default_factory=list)
    raw_summary: str = ""
    source_url: str = ""
    provider: str = ""   # which LLM produced this
    latency_ms: Optional[int] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    cost_usd: Optional[float] = None
    parse_error: Optional[str] = None  # set if LLM output failed JSON parse


@dataclass
class WeeklyMetrics:
    ticker: str
    week_start: str
    wsi: float
    velocity: float
    divergence: float
    event_count: int
    alerts: list[str] = field(default_factory=list)
    provider: str = ""
