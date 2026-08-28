from ..mcp_commands import submit_command  # noqa: F401 — patched in tests


def _no_args_schema() -> dict:
    return {"type": "object", "properties": {}, "additionalProperties": False}

def _command_payload(args: dict, keys: tuple[str, ...]) -> dict:
    return {k: args[k] for k in keys if args.get(k) is not None}
