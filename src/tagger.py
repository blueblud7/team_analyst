"""Layer 2: Raw Telegram summary → structured TaggedEvent JSON via LLM."""
import json
import re
import time
from pathlib import Path

from .models import TaggedEvent
from .providers import call_provider

PROMPT_DIR = Path(__file__).parent.parent / "prompts" / "tagger"

BASE_PROMPT = (PROMPT_DIR / "base.txt").read_text(encoding="utf-8")


def _build_messages(raw_summary: str) -> list[dict]:
    return [
        {"role": "user", "content": BASE_PROMPT + "\n\n---\n" + raw_summary}
    ]


def _extract_json(text: str) -> dict:
    """Strip markdown fences if present, then parse JSON."""
    cleaned = re.sub(r"```(?:json)?\s*", "", text).strip().rstrip("`").strip()
    return json.loads(cleaned)


async def tag_event(
    raw_summary: str,
    source_channel: str,
    channel_tier: int,
    channel_weight: float,
    provider: str,
    tier: str = "low",
    source_url: str = "",
) -> TaggedEvent:
    event = TaggedEvent(
        raw_summary=raw_summary,
        source_channel=source_channel,
        channel_tier=channel_tier,
        channel_weight=channel_weight,
        provider=provider,
        source_url=source_url,
    )

    messages = _build_messages(raw_summary)
    t0 = time.monotonic()
    result = await call_provider(provider, tier, messages)
    event.latency_ms = int((time.monotonic() - t0) * 1000)
    event.input_tokens = result.get("input_tokens")
    event.output_tokens = result.get("output_tokens")
    event.cost_usd = result.get("cost_usd")

    try:
        parsed = _extract_json(result["content"])
        event.tickers = parsed.get("tickers", [])
        event.sectors = parsed.get("sectors", [])
        event.event_type = parsed.get("event_type", "news")
        event.key_claims = parsed.get("key_claims", [])
        event.source_url = parsed.get("source_url") or source_url
    except (json.JSONDecodeError, KeyError) as e:
        event.parse_error = str(e)

    return event
