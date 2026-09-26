from __future__ import annotations
import json, logging, os, re
from typing import Any, Dict, List
from groq import Groq, NotFoundError

logger = logging.getLogger(__name__)
KNOWN_FALLBACK_MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b']
_resolved_model_cache: Dict[str, str] = {}

def call_groq_chat(client: Groq, messages: List[Dict[str, str]], preferred_model: str, max_tokens: int = 3000, temperature: float = 0.1) -> str:
    fallback_env = os.getenv('GROQ_FALLBACK_MODEL', 'llama-3.1-8b-instant')
    candidates = [preferred_model, fallback_env] + KNOWN_FALLBACK_MODELS
    seen = set()
    models_to_try = [m for m in candidates if m and not (m in seen or seen.add(m))]
    if preferred_model in _resolved_model_cache:
        cached = _resolved_model_cache[preferred_model]
        if cached in models_to_try:
            models_to_try.remove(cached)
            models_to_try.insert(0, cached)
    last_exc = None
    for model_name in models_to_try:
        try:
            resp = client.chat.completions.create(model=model_name, messages=messages, temperature=temperature, max_tokens=max_tokens)
            content = resp.choices[0].message.content or ''
            _resolved_model_cache[preferred_model] = model_name
            return content
        except Exception as e:
            err_str = str(e).lower()
            if 'not found' in err_str or 'does not exist' in err_str or isinstance(e, NotFoundError):
                logger.warning('Groq model %s not available, trying next fallback...', model_name)
                last_exc = e
                continue
            raise e
    raise last_exc or RuntimeError('No available Groq models succeeded.')

def parse_and_validate_json(raw: str) -> Dict[str, Any]:
    raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        fence = chr(96) * 3
        if fence in raw:
            parts = raw.split(fence)
            for part in parts[1::2]:
                cleaned = part.strip()
                if cleaned.startswith('json'):
                    cleaned = cleaned[4:].strip()
                try:
                    return json.loads(cleaned)
                except Exception:
                    pass
        start = raw.find('{')
        end = raw.rfind('}')
        if start != -1 and end != -1 and end > start:
            return json.loads(raw[start : end + 1])
        raise ValueError(f'Could not extract valid JSON from LLM output: {raw[:200]}')

def call_groq_json(client: Groq, messages: List[Dict[str, str]], preferred_model: str, max_tokens: int = 3000, temperature: float = 0.1) -> Dict[str, Any]:
    raw = call_groq_chat(client=client, messages=messages, preferred_model=preferred_model, max_tokens=max_tokens, temperature=temperature)
    try:
        return parse_and_validate_json(raw)
    except Exception as parse_err:
        logger.warning('First JSON parse failed (%s). Retrying once with strict prompt...', parse_err)
        retry_messages = list(messages) + [
            {'role': 'assistant', 'content': raw},
            {'role': 'user', 'content': 'Your previous response was NOT valid JSON. Fix it and return ONLY valid JSON matching the schema. No markdown, no explanations.'},
        ]
        raw_retry = call_groq_chat(client=client, messages=retry_messages, preferred_model=preferred_model, max_tokens=max_tokens, temperature=0.0)
        return parse_and_validate_json(raw_retry)
