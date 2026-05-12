"""Layer 4: TaggedEvent → sentiment_score + conviction via LLM."""
import json
import re
import time
from pathlib import Path

from .models import TaggedEvent
from .providers import call_provider

PROMPT_DIR = Path(__file__).parent.parent / "prompts" / "sentiment"
BASE_PROMPT = (PROMPT_DIR / "base.txt").read_text(encoding="utf-8")


def _build_messages(event: TaggedEvent) -> list[dict]:
    payload = {
        "source_channel": event.source_channel,
        "channel_tier": event.channel_tier,
        "tickers": event.tickers,
        "key_claims": event.key_claims,
        "raw_summary": event.raw_summary,
    }
    return [
        {"role": "user", "content": BASE_PROMPT + "\n\n---\n" + json.dumps(payload, ensure_ascii=False, indent=2)}
    ]


def _extract_json(text: str) -> dict:
    cleaned = re.sub(r"```(?:json)?\s*", "", text).strip().rstrip("`").strip()
    return json.loads(cleaned)


async def analyze_sentiment(event: TaggedEvent, provider: str, tier: str = "mid") -> TaggedEvent:
    messages = _build_messages(event)
    t0 = time.monotonic()
    result = await call_provider(provider, tier, messages)
    latency = int((time.monotonic() - t0) * 1000)

    # accumulate tokens/cost (tagger may have already set these)
    event.latency_ms = (event.latency_ms or 0) + latency
    event.input_tokens = (event.input_tokens or 0) + (result.get("input_tokens") or 0)
    event.output_tokens = (event.output_tokens or 0) + (result.get("output_tokens") or 0)
    event.cost_usd = (event.cost_usd or 0) + (result.get("cost_usd") or 0)

    try:
        parsed = _extract_json(result["content"])
        event.sentiment_score = float(parsed["sentiment_score"])
        event.sentiment_label = parsed.get("sentiment_label", "neutral")
        event.conviction = float(parsed["conviction"])
        if "key_claims" in parsed:
            event.key_claims = parsed["key_claims"]
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        event.parse_error = (event.parse_error or "") + f" | sentiment: {e}"

    return event
