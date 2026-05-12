import statistics
from .models import TaggedEvent, WeeklyMetrics


def compute_wsi(events: list[TaggedEvent]) -> float:
    """Weighted Sentiment Index: Σ(sentiment × conviction × weight) / Σ(conviction × weight)"""
    valid = [e for e in events if e.sentiment_score is not None and e.conviction is not None]
    if not valid:
        return 0.0
    numerator = sum(e.sentiment_score * e.conviction * e.channel_weight for e in valid)
    denominator = sum(e.conviction * e.channel_weight for e in valid)
    return numerator / denominator if denominator else 0.0


def compute_velocity(wsi_now: float, wsi_prev: float) -> float:
    return wsi_now - wsi_prev


def compute_divergence(events: list[TaggedEvent]) -> float:
    """Std dev of sentiment scores across channels — high = opinion split = inflection signal."""
    scores = [e.sentiment_score for e in events if e.sentiment_score is not None]
    return statistics.stdev(scores) if len(scores) > 1 else 0.0


def check_alerts(velocity: float, divergence: float,
                 claim_cluster_shift: float = 0.0,
                 new_claims_channel_count: int = 0) -> list[str]:
    alerts = []
    if abs(velocity) > 0.3:
        direction = "상승" if velocity > 0 else "하락"
        alerts.append(f"VELOCITY_ALERT: {velocity:+.3f} — 주간 톤 급변({direction})")
    if divergence > 0.5:
        alerts.append(f"DIVERGENCE_ALERT: {divergence:.3f} — 의견 양극화 (변곡점 가능성)")
    if claim_cluster_shift > 0.4:
        alerts.append(f"CLUSTER_SHIFT_ALERT: {claim_cluster_shift:.0%} — narrative 변화")
    if new_claims_channel_count >= 5:
        alerts.append(f"COLLECTIVE_RECOGNITION: {new_claims_channel_count}개 채널 동시 신규 claim 등장")
    return alerts


def build_weekly_metrics(ticker: str, week_start: str,
                          events_now: list[TaggedEvent],
                          events_prev: list[TaggedEvent],
                          provider: str = "") -> WeeklyMetrics:
    wsi_now = compute_wsi(events_now)
    wsi_prev = compute_wsi(events_prev)
    velocity = compute_velocity(wsi_now, wsi_prev)
    divergence = compute_divergence(events_now)
    alerts = check_alerts(velocity, divergence)
    return WeeklyMetrics(
        ticker=ticker,
        week_start=week_start,
        wsi=round(wsi_now, 4),
        velocity=round(velocity, 4),
        divergence=round(divergence, 4),
        event_count=len(events_now),
        alerts=alerts,
        provider=provider,
    )
