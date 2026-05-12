"""
Streamlit blind scoring dashboard for AIA PoC.
Usage: streamlit run scoring/dashboard.py
"""
import json
import random
from pathlib import Path

import pandas as pd
import plotly.express as px
import streamlit as st

RESULTS_DIR = Path(__file__).parent / "results"
SCORES_FILE = Path(__file__).parent / "scores.csv"

# ── Scoring rubric ──────────────────────────────────────────────────────────
TAGGER_CRITERIA = {
    "ticker_accuracy": ("Ticker 정확도", 1, 5),
    "json_valid": ("JSON 스키마 준수", 1, 5),
    "key_claims_quality": ("Key Claims 추출", 1, 5),
}
SENTIMENT_CRITERIA = {
    "sentiment_accuracy": ("Sentiment 정확도", 1, 5),
    "conviction_nuance": ("Conviction Nuance", 1, 5),
}
REPORT_CRITERIA = {
    "insight": ("인사이트", 1, 10),
    "readability": ("가독성", 1, 10),
    "hallucination_control": ("환각 통제", 1, 10),
}


def load_results(task: str) -> dict[str, list[dict]]:
    """Load all provider results for a given task, masked."""
    data: dict[str, list[dict]] = {}
    for f in sorted(RESULTS_DIR.glob(f"{task}_*.json")):
        provider = f.stem.replace(f"{task}_", "")
        events = json.loads(f.read_text(encoding="utf-8"))
        data[provider] = events
    return data


def mask_providers(data: dict) -> tuple[dict, dict]:
    """Return masked_data (A/B/C/...) and the key mapping."""
    labels = [chr(65 + i) for i in range(len(data))]
    shuffled = list(data.items())
    random.shuffle(shuffled)
    masked = {labels[i]: v for i, (_, v) in enumerate(shuffled)}
    mapping = {labels[i]: k for i, (k, _) in enumerate(shuffled)}
    return masked, mapping


def load_scores() -> pd.DataFrame:
    if SCORES_FILE.exists():
        return pd.read_csv(SCORES_FILE)
    return pd.DataFrame()


def save_score(row: dict) -> None:
    df = load_scores()
    new_row = pd.DataFrame([row])
    df = pd.concat([df, new_row], ignore_index=True)
    df.to_csv(SCORES_FILE, index=False)


# ── UI ──────────────────────────────────────────────────────────────────────
st.set_page_config(page_title="AIA PoC 채점 대시보드", layout="wide")
st.title("AIA PoC — Blind 채점 대시보드")

tab_score, tab_results, tab_matrix = st.tabs(["채점", "결과 조회", "비용/품질 매트릭스"])

with tab_score:
    task = st.selectbox("채점 대상", ["tagger", "sentiment", "report"])
    results = load_results(task)

    if not results:
        st.warning(f"scoring/results/{task}_*.json 파일이 없습니다. 먼저 비교 실험을 실행하세요.")
        st.code(f"python -m src.compare --task {task} --samples data/samples/")
        st.stop()

    if "masked" not in st.session_state or st.session_state.get("task") != task:
        st.session_state.masked, st.session_state.mapping = mask_providers(results)
        st.session_state.task = task
        st.session_state.idx = 0

    masked = st.session_state.masked
    idx = st.session_state.idx
    providers_masked = list(masked.keys())

    label = providers_masked[idx % len(providers_masked)]
    events = masked[label]

    st.subheader(f"Provider: **{label}** (블라인드 채점 중)")
    sample_idx = st.number_input("샘플 번호", 0, max(0, len(events) - 1), 0)

    if events:
        ev = events[sample_idx]
        with st.expander("원문 요약", expanded=True):
            st.text(ev.get("raw_summary", "")[:800])
        with st.expander("LLM 출력"):
            output = {k: ev.get(k) for k in
                      ["tickers", "sectors", "event_type", "key_claims",
                       "sentiment_score", "sentiment_label", "conviction", "parse_error"]}
            st.json(output)

    criteria = {"tagger": TAGGER_CRITERIA, "sentiment": SENTIMENT_CRITERIA,
                 "report": REPORT_CRITERIA}[task]
    st.divider()
    scores: dict[str, int] = {}
    for key, (label_text, lo, hi) in criteria.items():
        scores[key] = st.slider(label_text, lo, hi, (lo + hi) // 2)

    if st.button("채점 저장 → 다음 Provider"):
        row = {"task": task, "provider_masked": label, "sample_idx": sample_idx, **scores}
        save_score(row)
        st.session_state.idx = (idx + 1) % len(providers_masked)
        st.rerun()

    with st.expander("채점 키 (제출 후 확인)"):
        st.json(st.session_state.mapping)


with tab_results:
    df = load_scores()
    if df.empty:
        st.info("아직 채점 데이터가 없습니다.")
    else:
        st.dataframe(df)
        task_filter = st.selectbox("Task 필터", ["all"] + df["task"].unique().tolist())
        filtered = df if task_filter == "all" else df[df["task"] == task_filter]

        numeric_cols = [c for c in filtered.columns if c not in ["task", "provider_masked", "sample_idx"]]
        if numeric_cols:
            summary = filtered.groupby("provider_masked")[numeric_cols].mean().round(2)
            st.subheader("Provider별 평균 점수")
            st.dataframe(summary)


with tab_matrix:
    st.subheader("비용 / 품질 매트릭스")
    cost_data: list[dict] = []
    for task_name in ["tagger", "sentiment"]:
        for f in sorted(RESULTS_DIR.glob(f"{task_name}_*.json")):
            provider = f.stem.replace(f"{task_name}_", "")
            events = json.loads(f.read_text())
            total_cost = sum(e.get("cost_usd") or 0 for e in events)
            ok = sum(1 for e in events if not e.get("parse_error"))
            cost_data.append({"task": task_name, "provider": provider,
                               "total_cost_usd": round(total_cost, 4),
                               "parse_success_rate": ok / len(events) if events else 0})

    if cost_data:
        cost_df = pd.DataFrame(cost_data)
        df_scores = load_scores()

        if not df_scores.empty:
            numeric = [c for c in df_scores.columns if c not in ["task", "provider_masked", "sample_idx"]]
            avg_scores = df_scores.groupby("provider_masked")[numeric].mean().mean(axis=1).reset_index()
            avg_scores.columns = ["provider_masked", "quality_score"]
            mapping_all = st.session_state.get("mapping", {})
            reverse_map = {v: k for k, v in mapping_all.items()}
            cost_df["provider_masked"] = cost_df["provider"].map(reverse_map)
            cost_df = cost_df.merge(avg_scores, on="provider_masked", how="left")
            if "quality_score" in cost_df.columns:
                fig = px.scatter(cost_df, x="total_cost_usd", y="quality_score",
                                 color="task", text="provider_masked", size_max=20,
                                 title="비용(낮을수록 좋음) vs 품질(높을수록 좋음)")
                st.plotly_chart(fig, use_container_width=True)

        st.dataframe(cost_df)
    else:
        st.info("비교 실험 결과 파일이 없습니다.")
