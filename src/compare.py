"""
Run all 5 providers concurrently on the same 50 samples.
Usage: python -m src.compare --task tagger --samples data/samples/
"""
import asyncio
import json
import sys
from dataclasses import asdict
from pathlib import Path

import yaml

from .models import TaggedEvent
from .providers import enabled_providers
from .tagger import tag_event
from .analyzer import analyze_sentiment

CHANNELS_CFG = yaml.safe_load(
    (Path(__file__).parent.parent / "config" / "channels.yaml").read_text()
)
CHANNEL_MAP: dict[str, dict] = {
    ch["name"]: ch for ch in CHANNELS_CFG["channels"]
}


def load_samples(samples_dir: str) -> list[dict]:
    """Load .json or .txt sample files from directory."""
    p = Path(samples_dir)
    samples = []
    for f in sorted(p.iterdir()):
        if f.suffix == ".json":
            samples.append(json.loads(f.read_text(encoding="utf-8")))
        elif f.suffix == ".txt":
            samples.append({"raw_summary": f.read_text(encoding="utf-8"),
                             "source_channel": f.stem, "source_url": ""})
    return samples


async def run_tagger_all(samples: list[dict]) -> dict[str, list[TaggedEvent]]:
    providers = enabled_providers()

    async def tag_one(provider: str, s: dict) -> TaggedEvent:
        ch = CHANNEL_MAP.get(s.get("source_channel", ""), {})
        return await tag_event(
            raw_summary=s["raw_summary"],
            source_channel=s.get("source_channel", "unknown"),
            channel_tier=ch.get("tier", 4),
            channel_weight=ch.get("weight", 0.2),
            provider=provider,
            tier="low",
            source_url=s.get("source_url", ""),
        )

    tasks = [(p, s) for p in providers for s in samples]
    results_flat = await asyncio.gather(
        *[tag_one(p, s) for p, s in tasks], return_exceptions=True
    )

    results: dict[str, list[TaggedEvent]] = {p: [] for p in providers}
    for (p, _), r in zip(tasks, results_flat):
        if isinstance(r, Exception):
            print(f"[ERROR] {p}: {r}", file=sys.stderr)
        else:
            results[p].append(r)
    return results


async def run_sentiment_all(tagged: dict[str, list[TaggedEvent]]) -> dict[str, list[TaggedEvent]]:
    providers = list(tagged.keys())

    async def analyze_one(provider: str, event: TaggedEvent) -> TaggedEvent:
        return await analyze_sentiment(event, provider=provider, tier="mid")

    tasks = [(p, e) for p in providers for e in tagged[p]]
    results_flat = await asyncio.gather(
        *[analyze_one(p, e) for p, e in tasks], return_exceptions=True
    )

    results: dict[str, list[TaggedEvent]] = {p: [] for p in providers}
    for (p, _), r in zip(tasks, results_flat):
        if isinstance(r, Exception):
            print(f"[ERROR] {p}: {r}", file=sys.stderr)
        else:
            results[p].append(r)
    return results


def save_results(results: dict[str, list[TaggedEvent]], out_dir: str, task: str) -> None:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for provider, events in results.items():
        path = out / f"{task}_{provider}.json"
        path.write_text(
            json.dumps([asdict(e) for e in events], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"Saved {len(events)} events → {path}")


async def main(task: str, samples_dir: str, out_dir: str = "scoring/results") -> None:
    samples = load_samples(samples_dir)
    print(f"Loaded {len(samples)} samples. Running {task} on {len(enabled_providers())} providers...")

    if task == "tagger":
        results = await run_tagger_all(samples)
        save_results(results, out_dir, "tagger")
    elif task == "sentiment":
        tagged = await run_tagger_all(samples)
        results = await run_sentiment_all(tagged)
        save_results(results, out_dir, "sentiment")
    else:
        print(f"Unknown task: {task}", file=sys.stderr)
        sys.exit(1)

    # cost summary
    print("\n=== Cost Summary ===")
    for provider, events in results.items():
        valid = [e for e in events if e.cost_usd is not None]
        total = sum(e.cost_usd for e in valid)
        ok = sum(1 for e in events if not e.parse_error)
        fail = len(events) - ok
        print(f"  {provider:12s} ${total:.4f}  (ok={ok}, fail={fail})")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--task", choices=["tagger", "sentiment"], required=True)
    parser.add_argument("--samples", default="data/samples")
    parser.add_argument("--out", default="scoring/results")
    args = parser.parse_args()
    asyncio.run(main(args.task, args.samples, args.out))
