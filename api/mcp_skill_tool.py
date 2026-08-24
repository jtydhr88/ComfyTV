from .. import skill_store

INDEX_ENTRY_CAP = 200
INDEX_TOTAL_CAP = 4000

BASE_DESCRIPTION = (
    "ComfyTV Agent Skills — instruction packs installed by the user. "
    "action='list' returns all available skills with full descriptions; "
    "action='read' with name returns that skill's complete SKILL.md "
    "instructions; action='read' with name and path returns a bundled "
    "reference file the instructions link to (e.g. "
    "path='references/checklist.md'). When the user's task matches a skill "
    "below, read the skill FIRST and follow its instructions."
)


def _index_lines() -> list[str]:
    lines = []
    total = 0
    skills = skill_store.enabled_skills()
    for entry in skills:
        desc = entry["description"]
        if len(desc) > INDEX_ENTRY_CAP:
            desc = desc[:INDEX_ENTRY_CAP - 1] + "…"
        line = f"- {entry['name']}: {desc}"
        total += len(line)
        if total > INDEX_TOTAL_CAP:
            lines.append(f"- …and {len(skills) - len(lines)} more — "
                         "see action='list'")
            break
        lines.append(line)
    return lines


def describe() -> str:
    lines = _index_lines()
    if not lines:
        return BASE_DESCRIPTION + "\nAvailable skills: (none installed)"
    return BASE_DESCRIPTION + "\nAvailable skills:\n" + "\n".join(lines)


async def _skill(args: dict) -> dict:
    action = args.get("action", "list")
    if action == "list":
        return {"skills": [
            {"name": s["name"], "description": s["description"]}
            for s in skill_store.enabled_skills()
        ]}
    if action == "read":
        name = str(args.get("name") or "")
        if not name:
            raise ValueError("name is required for action='read'")
        if skill_store.find_enabled(name) is None:
            known = ", ".join(
                s["name"] for s in skill_store.enabled_skills()) or "(none)"
            raise ValueError(
                f"unknown or disabled skill {name!r} — available: {known}")
        path = str(args.get("path") or "")
        if path:
            return {"name": name, "path": path,
                    "content": skill_store.read_skill_file(name, path)}
        return {"name": name, "content": skill_store.read_skill(name)}
    raise ValueError(f"unknown action {action!r} (use 'list' or 'read')")


SKILL_TOOL = {
    "description": BASE_DESCRIPTION,
    "describe": describe,
    "inputSchema": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["list", "read"]},
            "name": {"type": "string"},
            "path": {"type": "string"},
        },
        "additionalProperties": False,
    },
    "handler": _skill,
}
