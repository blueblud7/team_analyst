"""Unified async wrapper for 5 LLM providers."""
import asyncio
import os
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

load_dotenv()

_CFG_PATH = Path(__file__).parent.parent / "config" / "providers.yaml"
_cfg: dict = yaml.safe_load(_CFG_PATH.read_text())["providers"]


def _price(provider: str, tier: str) -> tuple[float, float]:
    t = _cfg[provider]["tiers"][tier]
    return t["price_in"], t["price_out"]


def _model(provider: str, tier: str) -> str:
    return _cfg[provider]["tiers"][tier]["model"]


def _cost(provider: str, tier: str, in_tok: int, out_tok: int) -> float:
    pin, pout = _price(provider, tier)
    return (in_tok * pin + out_tok * pout) / 1_000_000


async def _call_openai(model: str, messages: list[dict]) -> dict:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    # gpt-5+ series does not support temperature parameter
    kwargs: dict[str, Any] = dict(model=model, messages=messages,
                                   response_format={"type": "json_object"})
    if not model.startswith("gpt-5"):
        kwargs["temperature"] = 0
    resp = await client.chat.completions.create(**kwargs)
    content = resp.choices[0].message.content
    in_tok = resp.usage.prompt_tokens
    out_tok = resp.usage.completion_tokens
    return {"content": content, "input_tokens": in_tok, "output_tokens": out_tok}


async def _call_anthropic(model: str, messages: list[dict]) -> dict:
    import anthropic
    client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    # convert openai-style messages to anthropic format
    system = None
    anthropic_msgs = []
    for m in messages:
        if m["role"] == "system":
            system = m["content"]
        else:
            anthropic_msgs.append({"role": m["role"], "content": m["content"]})
    kwargs: dict[str, Any] = dict(model=model, max_tokens=2048, messages=anthropic_msgs)
    if system:
        kwargs["system"] = system
    resp = await client.messages.create(**kwargs)
    content = resp.content[0].text
    in_tok = resp.usage.input_tokens
    out_tok = resp.usage.output_tokens
    return {"content": content, "input_tokens": in_tok, "output_tokens": out_tok}


async def _call_openai_compat(base_url: str, api_key_env: str,
                               model: str, messages: list[dict]) -> dict:
    """Works for DeepSeek and Qwen (OpenAI-compatible endpoints)."""
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=os.environ[api_key_env], base_url=base_url)
    resp = await client.chat.completions.create(
        model=model, messages=messages, temperature=0,
    )
    content = resp.choices[0].message.content
    in_tok = resp.usage.prompt_tokens
    out_tok = resp.usage.completion_tokens
    return {"content": content, "input_tokens": in_tok, "output_tokens": out_tok}


async def _call_google(model: str, messages: list[dict]) -> dict:
    import google.generativeai as genai
    genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
    g_model = genai.GenerativeModel(model)
    prompt = "\n".join(m["content"] for m in messages)
    resp = await asyncio.to_thread(g_model.generate_content, prompt)
    content = resp.text
    # google doesn't always expose token counts in the same way
    in_tok = getattr(resp.usage_metadata, "prompt_token_count", 0)
    out_tok = getattr(resp.usage_metadata, "candidates_token_count", 0)
    return {"content": content, "input_tokens": in_tok, "output_tokens": out_tok}


async def call_provider(provider: str, tier: str, messages: list[dict]) -> dict:
    """Returns dict with content, input_tokens, output_tokens, cost_usd."""
    model = _model(provider, tier)
    result: dict

    if provider == "openai":
        result = await _call_openai(model, messages)
    elif provider == "anthropic":
        result = await _call_anthropic(model, messages)
    elif provider == "deepseek":
        base_url = _cfg["deepseek"].get("base_url", "https://api.deepseek.com")
        result = await _call_openai_compat(base_url, "DEEPSEEK_API_KEY", model, messages)
    elif provider == "qwen":
        base_url = _cfg["qwen"].get("base_url", "https://dashscope.aliyuncs.com/compatible-mode/v1")
        result = await _call_openai_compat(base_url, "QWEN_API_KEY", model, messages)
    elif provider == "google":
        result = await _call_google(model, messages)
    else:
        raise ValueError(f"Unknown provider: {provider}")

    result["cost_usd"] = _cost(provider, tier,
                                result.get("input_tokens", 0),
                                result.get("output_tokens", 0))
    return result


def enabled_providers() -> list[str]:
    return [p for p, cfg in _cfg.items() if cfg.get("enabled", True)]
