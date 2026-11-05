from dataclasses import dataclass

COMFY_MCP_ALLOWED_TOOLS = (
    "server_info",
    "nodes",
    "validate_workflow",
    "search_models",
    "search_templates",
    "get_template",
    "list_workflow_slots",
    "list_workflow_notes",
    "workflow_deps",
    "node_dependencies",
    "system_stats",
    "which",
)


@dataclass(frozen=True)
class AgentHost:
    name: str
    label: str
    core_tools: tuple[str, ...]
    codex_instructions: str
    local_llm_prompt: str
    claude_prompt: str = ""
    qwen_guide: str = ""
    wait_tool: str = ""
    settings_location: str = "the agent settings"

    @property
    def local_llm_key_env(self) -> str:
        return f"{self.name.upper()}_LOCAL_LLM_API_KEY"

    @property
    def session_preamble(self) -> str:
        return (
            f"[{self.label}] You are working for the user through a {self.label} chat. Their {self.label} "
            f"canvas and its ComfyUI are reachable only through the `{self.name}` MCP tools attached to "
            f"this session (named mcp__{self.name}__*). They may run on a different machine than you, so "
            f"127.0.0.1, local ComfyUI or {self.label} services, and skills or memories about your own "
            f"machine do not refer to them. Never use the terminal, curl, systemctl or sudo to reach, "
            f"start or stop ComfyUI or {self.label}. Start with server_info and get_canvas; when a task "
            f"matches a {self.label} skill, read it with the {self.name} skill tool."
        )
