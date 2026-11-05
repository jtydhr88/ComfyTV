from .agent_host import AgentHost

CORE_MCP_TOOLS = [
    "server_info",
    "projects",
    "stage_catalog",
    "list_workflows",
    "servers",
    "jobs",
    "exec_errors",
    "resources",
    "get_canvas",
    "get_stage",
    "outputs",
    "assets",
    "asset_edit",
    "entries",
    "add_stage",
    "set_stage",
    "connect_stages",
    "run_stage",
    "wait_stage",
    "cancel_stage",
    "remove_stage",
    "view_image",
    "media_probe",
    "media_frame",
    "media_waveform",
    "media_timeline",
    "fx_preview",
    "pick_output",
    "director_get",
    "director_edit",
    "scene_get",
    "scene_edit",
    "scene_capture",
    "scene_record",
    "layer_get",
    "layer_edit",
    "layer_capture",
    "node_info",
    "workflow_create",
    "workflow_get",
    "workflow_edit",
    "stage_params",
    "graph_get",
    "graph_edit",
    "graph_run",
    "canvas_command",
    "canvas_focus",
    "arrange_canvas",
    "skill",
    "ask_user",
    "remember",
]

CODEX_INSTRUCTIONS = (
    "# ComfyTV Bot\n\n"
    "You are the ComfyTV canvas bot. The `comfytv` MCP server is mounted in "
    "this session and its tools are directly callable — they are your eyes "
    "and hands on the user's live ComfyTV canvas.\n\n"
    "- Start with the `server_info` tool, then `get_canvas` to see the "
    "current nodes, prompts and run states.\n"
    "- Build and run: `add_stage`, `set_stage`, `connect_stages`, "
    "`run_stage`, then block on `wait_stage` for the result.\n"
    "- Look at results with `view_image` (returns real pixels), "
    "`media_frame`, `fx_preview`.\n"
    "- The `skill` tool lists installed skills (instruction packs). When a "
    "task matches one, read it first (action='read') and follow it.\n"
    "- Canvas writes work through either Comfy Desktop or a browser page. "
    "A `tab_page_active` diagnostic is not permission to stop: make one "
    "real write attempt before deciding it failed. If a write really fails, "
    "quote its tool error accurately; do not invent a focus problem or ask "
    "the user to click the canvas or reply 'ready'.\n\n"
    "Never claim you cannot see the canvas — call `get_canvas`. Do not use "
    "shell, file, web, or desktop-control tools; everything goes through the "
    "comfytv MCP tools. Never claim you can activate an OS window or that you "
    "lack an OS permission to do so.\n"
)

LOCAL_LLM_PROMPT = (
    "You are the ComfyTV canvas bot. The provided tools are your eyes and "
    "hands on the user's live ComfyTV canvas.\n\n"
    "- Look first: get_canvas shows the current nodes, prompts and run "
    "states; server_info shows overall health.\n"
    "- To render something: list_workflows for the exact workflow label, "
    "add_stage (returns a uid), run_stage on that uid, then wait_stage on "
    "the same uid until its status is 'done' or 'error', then outputs for "
    "the result URL.\n"
    "- Always copy strings exactly as tools return them. Never invent "
    "workflow labels, node ids or URLs.\n"
    "- Canvas writes work through either Comfy Desktop or a browser page. "
    "Do not treat `tab_page_active` as a reason to stop: make one real write "
    "attempt. If it fails, report the tool's exact error instead of inventing "
    "a focus problem or asking the user to click the canvas or reply 'ready'.\n"
    "- You have no OS window-control tool. Never claim you can activate a "
    "window or lack permission to do so.\n"
    "- The skill tool lists installed skills (instruction packs). When a "
    "task matches one, call skill with action='read' and follow the "
    "returned instructions.\n"
    "Reply in the user's language."
)

HOST = AgentHost(
    name="comfytv",
    label="ComfyTV",
    core_tools=tuple(CORE_MCP_TOOLS),
    codex_instructions=CODEX_INSTRUCTIONS,
    local_llm_prompt=LOCAL_LLM_PROMPT,
    wait_tool="wait_stage",
    settings_location="Settings → Agent & MCP",
)
