from __future__ import annotations

import logging
import random
import threading
from typing import Any, Optional

from . import comfyui_llm_chat as chat_format

_log = logging.getLogger(__name__)

_CONTEXT_ID = "comfytv-llm"

_loaded: Optional[tuple[str, Any]] = None
_load_lock = threading.Lock()


def _executing_context():
    try:
        from comfy_execution.utils import CurrentNodeContext
        return CurrentNodeContext(prompt_id=_CONTEXT_ID, node_id=_CONTEXT_ID)
    except Exception:
        import contextlib
        return contextlib.nullcontext()


def _normalized(name: str) -> str:
    return name.lower().replace("-", "").replace("_", "")


def is_generation_model(name: str) -> bool:
    return prompt_family(name) is not None


def prompt_family(name: str) -> Optional[str]:
    normalized = _normalized(name)
    if "minimax" in normalized or "h3" in normalized:
        return None
    if "qwen3" in normalized:
        return "chatml"
    if "gemma4" in normalized:
        return None
    if "gemma" in normalized:
        return "gemma3"
    return None


def list_model_files() -> list[str]:
    import folder_paths
    names = [n for n in folder_paths.get_filename_list("text_encoders")
             if is_generation_model(n)]
    return sorted(names, key=lambda n: (prompt_family(n) != "chatml", n))


def _patch_logits(clip: Any) -> None:
    import types

    import torch

    wrapper = clip.cond_stage_model
    inner = getattr(wrapper, getattr(wrapper, "clip", ""), wrapper)
    transformer = getattr(inner, "transformer", None)
    model = getattr(transformer, "model", None)
    if model is None or not callable(getattr(transformer, "logits", None)):
        return

    def logits(self, x):
        module = getattr(self.model, "lm_head", None)
        if module is None:
            module = self.model.embed_tokens
        head_in = x[:, -1:]
        if not module.comfy_cast_weights:
            out = torch.nn.functional.linear(head_in, module.weight.to(x),
                                             None)
        else:
            import comfy.ops
            with comfy.ops.CastBiasWeightContext(
                    module, head_in, offloadable=True) as (weight, _bias):
                out = torch.nn.functional.linear(head_in, weight, None)
        return torch.nan_to_num(out)

    transformer.logits = types.MethodType(logits, transformer)


def _load(name: str) -> Any:
    global _loaded
    with _load_lock:
        if _loaded is not None and _loaded[0] == name:
            return _loaded[1]
        import comfy.sd
        import folder_paths
        import torch
        path = folder_paths.get_full_path_or_raise("text_encoders", name)
        _loaded = None
        _log.info("[ComfyTV/llm] loading text encoder %s", name)
        clip = comfy.sd.load_clip(
            ckpt_paths=[path],
            embedding_directory=folder_paths.get_folder_paths("embeddings"),
            clip_type=comfy.sd.CLIPType.STABLE_DIFFUSION,
            model_options={"dtype": torch.bfloat16},
        )
        _patch_logits(clip)
        _loaded = (name, clip)
        return clip


def generate_chat(model: str, messages: list[dict], tools: list[dict], *,
                  max_tokens: int, temperature: float, top_p: float,
                  seed: Optional[int] = None, thinking: bool = False) -> dict:
    clip = _load(model)
    family = prompt_family(model) or "chatml"
    thinking = thinking and family == "chatml"
    prompt = chat_format.render_prompt(messages, tools, family=family,
                                       thinking=thinking)
    tokens = clip.tokenize(prompt, llama_template="{}", min_length=1)
    batches = next(iter(tokens.values())) if isinstance(tokens, dict) \
        else tokens
    prompt_tokens = sum(len(batch) for batch in batches)
    with _executing_context():
        ids = clip.generate(
            tokens,
            do_sample=temperature > 0,
            max_length=max_tokens,
            temperature=temperature,
            top_k=64,
            top_p=top_p,
            min_p=0.0,
            repetition_penalty=1.0,
            seed=int(seed) if seed is not None else random.getrandbits(32),
        )
    text = clip.decode(ids, skip_special_tokens=False)
    content, tool_calls = chat_format.parse_completion(text)
    finish = "tool_calls" if tool_calls else (
        "length" if len(ids) >= max_tokens else "stop")
    return {
        "content": content,
        "tool_calls": tool_calls,
        "finish_reason": finish,
        "usage": {"prompt_tokens": prompt_tokens,
                  "completion_tokens": len(ids),
                  "total_tokens": prompt_tokens + len(ids)},
    }
