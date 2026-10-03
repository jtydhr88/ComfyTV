# Hermes Agent provider (experimental)

This provider connects the ComfyTV Bot panel to a **Hermes Agent runtime**, not to an LLM endpoint or the Hermes subscription proxy. ComfyTV sends a turn once; Hermes owns the reasoning/tool loop and calls its configured ComfyTV MCP server. ComfyTV renders the resulting progress and reply.

```text
Bot panel -> HermesProvider -> restricted ownership broker -> Hermes Runs API
                                  |
                         Hermes agent + configured tools
                                  |
                       ComfyTV HTTP MCP -> open canvas
```

## Prerequisites and trust boundary

- A compatible Hermes Agent API server plus a restricted ComfyTV ownership broker. **This draft contains the ComfyTV side only. The companion broker and required Hermes API extensions are not distributed by this PR and are not asserted to be available in a released Hermes version.** Publishing/versioning those dependencies is a release prerequisite. The provider feature-detects capabilities; do not point it at an arbitrary OpenAI-compatible or subscription-proxy endpoint.
- A ComfyTV HTTP MCP connection already configured **on the Hermes host**, pointing back to this ComfyUI instance. The existing `bot-enable-comfy-mcp` option does not configure Hermes.
- An open ComfyTV page connected to that ComfyUI instance for canvas operations.
- Client authentication through [Settings onboarding](hermes-onboarding.md). Pair with the restricted broker, import a dedicated client token, or migrate an existing credential. **Never enter the main Hermes API/admin bearer in ComfyTV.** Secure saved credentials take precedence over `COMFYTV_HERMES_API_KEY`, which remains an advanced compatibility source for initially unconfigured installations. No custom startup script is needed after a successful secure save.
- Restrict Hermes' available tools and MCP permissions on the Hermes side. The integration prompt is guidance, **not a sandbox**. Do not give an untrusted ComfyUI frontend access to an unrestricted personal agent.

Keep Hermes bound to loopback. For separate machines, use an SSH tunnel terminating at loopback on the ComfyUI host, or an authenticated HTTPS deployment with a valid certificate. Non-loopback plain HTTP, credentials embedded in URLs and redirected API requests are not supported. Do not disable TLS verification.

Enable MCP and Bot, then open Settings → Hermes connection from a browser on the ComfyUI host using its loopback address. LAN access is read-only. The connection panel manages credentials and bindings; the old ordinary URL/MCP/model editing rows are hidden. Configuration concepts:

| Setting | Value |
| --- | --- |
| Enable MCP / Bot | Enabled |
| Hermes Agent endpoint | Restricted broker root, e.g. `http://127.0.0.1:8791` (no `/v1` suffix) |
| Hermes ComfyTV MCP name | Server name in Hermes, e.g. `comfytv` |
| Hermes model override | Normally blank; inherited from the runtime. A user-facing model picker is deferred. |

Then select **Hermes** in the Bot provider picker. The endpoint is contacted by the ComfyUI server, not by the browser. Therefore `127.0.0.1` means the ComfyUI host. No browser CORS exception or browser-visible API key is needed.

See the [official Hermes API documentation](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server) for API activation, authentication, capabilities and deployment.

## Session and event ownership

The fixed ComfyTV task instructions travel separately from the user message. User input is never promoted into system instructions. Hermes' core personality, memory and skills are not replaced by a second local-LLM loop.

Each Bot chat retains its Hermes session identifier via ComfyTV's existing resume token. New chats do not share the current desktop conversation. Model state and tool history stay on Hermes; ComfyTV stores the display transcript. A message has a stable request identity to prevent duplicate Runs submissions. This does not guarantee exactly-once ComfyUI generation: uncertain side effects still require inspection before retry.

Hermes events are translated to ComfyTV `BotEvent` records. The current Runs tool events have no invocation IDs, so starts and completions are shown as **uncorrelated progress notices**, not fabricated paired tool-call cards. Tool previews may be truncated/redacted by Hermes and are not a replacement for reading actual outputs. Lost SSE connections fall back to run-status reconciliation; a disconnected stream must never cause a new generation run. If tool telemetry is incomplete, the reply warns that tools may have executed and changes require inspection; missing events do not prove the canvas is unchanged.

Stopping the Bot asks Hermes to stop the agent run. It **does not globally interrupt ComfyUI or cancel already queued GPU work**. Inspect the relevant stage/job separately before cancelling it.

## Waiting for slow local models

The provider uses separate time budgets rather than treating a pause in generated tokens as a failed run:

| Budget | Default |
| --- | --- |
| Entire turn, including stream and status polling | 7200 seconds (2 hours) |
| SSE connection without any network bytes | 600 seconds (10 minutes) |
| General HTTP request, including asynchronous Runs admission | 120 seconds |
| Connection establishment | 10 seconds |
| Capability probe, approval denial, or scoped stop control | 20 seconds per operation |

SSE keepalive comments count as network activity even while the model is loading or reasoning without tokens. An SSE timeout falls back to reading the existing run's status within the overall turn budget; it never resubmits the turn. Runs admission is asynchronous: its HTTP request budget is not the model's inference deadline. Stop POST and confirmation GET share one control-operation budget.

If submission times out before a run ID is received, the outcome and stop status remain unknown. The provider reports this explicitly rather than claiming the run was cancelled. These defaults apply only to this adapter; they do not override the model server's or reverse proxy's own limits.

## Image-reference attachments

`bot-hermes-image-attachments` is a strict boolean, default **false**, gating image/video/audio references together. Enable it only after verifying the companion runtime's bounded preview cache and visual inspection path. While false, attachment turns are rejected and inspection tools are hidden. See [media reference support](hermes-media.md) for video/audio limits and behavior.

When enabled, the legacy Bot and native Agent APIs accept
at most six distinct image asset IDs. Native refs must be canonical `asset:7`;
legacy refs are `{ "asset_id": 7 }`. Booleans, floats, unsafe integers, filenames,
URLs, missing/deleted files, animation, and non-images are rejected. The UI uses
the current thread's server capability and labels these **references, not
inspected**. Video/audio support is described in [hermes-media.md](hermes-media.md); documents remain unsupported.
Other providers retain their inline media path.

The provider's Runs request still has only `input`, fixed `instructions`,
`session_id`, and the pre-existing optional `model`. Only attachment turns use a
deterministically serialized JSON **string** for input:

```json
{"schema":"comfytv.task-input.v1","user_text":"original API request text","attachment_manifest":{"version":1,"assets":[]}}
```

The example assets array is schematic; real attachment turns require one to six
server-resolved entries. Entries contain numeric `asset_id`, actual MIME,
width/height, source size, `revision: "sha256:<digest of bounded actual bytes>"`,
and `perception: "not_inspected"`. There are no source paths, URLs, endpoints,
base64, names, EXIF, or arbitrary client metadata. The whole serialized task
input is capped at 8 KiB UTF-8, rejected rather than truncated. API text is not
trimmed, skill-expanded or concatenated with preferences/workflow/ref prose on
this reference path. Nonattachment turns keep existing behavior. Queue entries
and persisted display rows retain the manifest and original text. Existing
startup behavior aborts stale queued turns; this is not durable job recovery.

Submission reads bounded source bytes for validation/hash, but does **not**
render, encode or transfer a preview. The provider revalidates the source and
revision before any upstream request. The MCP `inspect_image_asset` tool accepts
only `asset_id` and optional `revision`; it re-reads the current asset, rejects a
revision mismatch, and emits an in-memory JPEG via real MCP ImageContent. Its
description instructs Hermes to use `vision_analyze` on the returned MEDIA path
before making visual claims. No private vision loop is run here; ImageContent
alone is not evidence that the model has seen pixels.

Bounds: 20 MiB source, 40 million pixels, one nonanimated image, at most 1200 px
preview edge, at most 1 MiB JPEG. Two producer operations per process may be
in flight; additional calls fail busy. Slots release in the worker's finally,
not when a cancelled async waiter returns. No producer cache files are created
or deleted. Originals and normal output files are read-only. Source resolution
uses only managed input/output roots, strict local `/view` records, regular
files, no symlinks/junctions/reparse points. POSIX traversal uses no-follow
directory descriptors. Native Windows filesystem behavior still requires its
own authorized acceptance test; this Linux fixture is not a Windows security
attestation.

IDs are stable **within the existing fixed ComfyTV library instance**; the hash
is byte identity, not a fabricated database version. This does not introduce
per-chat or per-project asset isolation. Existing global assets/URL tools are
unchanged and remain under administrator trust. There are no credentials or
capability grants in the manifest.

Hermes receiving-cache quotas, leases, cleanup and MCP→`vision_analyze` delivery are companion-runtime responsibilities, not a cache implemented by this PR. Validate that deployment separately; metadata or a generated preview alone is not evidence of model inspection.

## Mixed media + workflow context

When the Hermes image gate is enabled, attachment capability also reports
`attachment_mixed_context: true`. This is a source capability, not a statement
about a particular deployment's settings. Both native messages (including new
threads with unsaved temporary graphs) and legacy image sends use the same
capture/admission path. Pure image-only inputs remain `comfytv.task-input.v1`.
Mixed inputs use this JSON **string**, with no new broker top-level fields:

```json
{"schema":"comfytv.task-input.v2","user_text":"exact received API content","attachment_manifest":{"version":1,"assets":[]},"context_ref":{"schema":"comfytv.task-context-ref.v1","id":"opaque capability","revision":"sha256:...","size_bytes":123,"expires_at":1890000000.0}}
```

`expires_at` is absolute UTC Unix seconds. The examples omit real manifest
entries. Actual user text is preserved verbatim, including existing native
workflow-mention markup; it is never replaced by workflow-hint prose. Snapshot
JSON retains arrays, unknown graph fields, widget strings and unsaved changes.
Capture does not save/import/apply the graph. Graph document `id` is not the
saved-file UUID5 identity; they are deliberately not equated.

Supported context:
- Full finite JSON save-format `draft.content` with a nodes array; an omitted
  draft resolves an explicitly supplied saved workflow ID read-only.
- Root selection, including node 0. Optional `node_locators` must match the
  parallel root ID strings. Missing IDs, duplicates, ambiguous numeric/string
  IDs, and nested locators reject explicitly; generic nested selection is **not**
  implemented. Subgraph definitions remain preserved as inert graph data.
- Up to three ordered saved-workflow reference chips, resolved to full content.
- Exact valid stored chat preferences, captured before image preparation.
- Validated `open_tabs` and `current_tab` advisory metadata. A tab is not a
  target, authorization grant, or instruction to read a different workflow.

Explicit ComfyTV skills/known slash skills, request preference overrides,
legacy stage/asset `refs`, draft CAS versions, and unsupported attachment types remain
unsupported on this path. Unknown slash text stays exact. Upstream Hermes
identity/persona/memory/skills, fixed additive instructions and approval-denial
behavior are unchanged. Invalid mixed contexts reject before image decoding,
chat/message creation, queue admission or remote calls. Native admission
rechecks busy/deleted/rebound chats after asynchronous preparation and never
silently queues a native busy send. Local admission failures compensate
provisional cache/message/new-chat records; this is not a distributed crash
transaction or durable turn-recovery protocol.

### Snapshot cache, bounds and lifecycle

Workflow snapshots and private task-input/digest associations live only in a
process-local SQLite `:memory:` database. No snapshot directory, database,
sidecar, temporary file, chmod or ACL operation is performed. A legacy constructor
`root` argument is ignored, not inspected or used to select storage. There is no
migration or removal of old caches. Original image bytes/workflow files and the
separate image managed cache are untouched. Existing Bot chat/session/display
records remain in their existing storage; they are not moved into memory.
Tokens do not enter public receipts; Hermes output/previews redact the current
capability.

Limits are rejecting, not truncating: 2 MiB/workflow, 4 MiB aggregate, 2,000
nodes/workflow, 100 selections, JSON depth 64 / 100,000 values, 16 stored
preference strings / 4,096 UTF-8 bytes, 64 advisory tabs / 16 KiB metadata.
Cache admission is bounded at 32 MiB / 32 records globally, 8 MiB / four
records per chat, and four concurrent preparation reservations. Admission
reserves 64 KiB fixed and 32 KiB per record for metadata/page overhead,
so usable payload capacity is conservatively below the 32 MiB total. SQLite
page allocation is also capped at 32 MiB; rollback journal and temporary storage
are explicitly in memory, not an unbounded WAL or filesystem temp store.
These are logical/storage-page limits, **not a total Python process RSS cap**:
bounded decoding, serialization, SQLite and read workers have transient overhead.
Active records are never evicted to admit another turn.

A fixed three-hour lease starts at acceptance/reservation, with at most
30 minutes before first dispatch and at least two hours remaining when
starting a run. Reads do not renew leases. Completion, terminal failures,
confirmed cancellation and chat deletion release snapshots; ambiguous upstream
outcomes retain them in the same process until terminal confirmation or expiry.
60-second periodic and admission sweeps clean expiry. Shutdown/restart loses all
snapshots and private submissions: a fresh store has zero records; old tokens
and submissions explicitly fail unavailable. No current-graph rehydration,
orphan recovery or automatic resubmission is performed. Durable crash/restart
recovery remains a follow-up, not a capability of this store. Queue inputs/models are frozen; changed endpoint/key/MCP
configuration fails closed rather than silently rebinding a queued turn.

### Read-only MCP and wire budgets

The administrator-configured fixed ComfyTV MCP endpoint exposes
`task_context_read(token, revision, operation, selector?, cursor?)`.
`summary` lists snapshot sections; `node` resolves one root node; `value` uses
a bounded JSON pointer; `page` returns deterministic `json-text` chunks.
Follow the returned selector/cursor, concatenate chunks, then JSON-decode once.
Oversized values explicitly require pagination, including individual widget
strings. Whole-document paging reconstructs all content; results include
revision, offset and completeness. Two concurrent reads and a conservative
16 KiB serialized MCP-result budget are enforced. Selectors are bounded to
1,024 UTF-8 bytes; use whole-document paging for unusually long keys.
There is no list-all, arbitrary filesystem path/URL, write, or renewal operation.
Token possession under the existing fixed-instance administrative MCP trust
boundary grants access until revocation/expiry; no per-chat MCP authentication
is invented.

Inner task input remains capped at 8 KiB. The complete outer Runs request is
serialized once, measured against **61,440 bytes (60 KiB)** and those exact
bytes are sent as `application/json`. Preflight uses a maximum-length session
placeholder before remote session creation, and the actual session is checked
again before POST. This stays below the unchanged broker's 65,536-byte cap,
including Unicode escaping and fixed instructions. Reconnecting an existing
run never re-POSTs or rereads/replaces images/context; changed immutable attempt
identity is rejected.

Local acceptance includes real native/legacy HTTP, real compiler/store/turn
handoff/Hermes provider, the unchanged broker, and real HTTP MCP context reads
against an explicitly synthetic loopback upstream. This proves transport and
snapshot preservation, **not** model inspection, live pixel delivery, canvas
application, production deployment, or Windows runtime acceptance.

## Initial scope and known limits

- Text turns, session continuity, progress, final replies and stop control.
- Conversation branching remains unsupported. Media references are experimental and disabled by default.
- Interactive approval/question cards use the compatible `requests_v1` contract. Responses require a valid same-host loopback channel, cookie, CSRF proof and lease. LAN clients are read-only. Missing, stale or unsupported contracts fail closed; the provider must not auto-approve. This contract also requires companion Hermes/broker support.
- The provider uses a preconfigured MCP connection. It does not dynamically inject the local `?bot_chat=` endpoint into Hermes, and does not promise ComfyTV's chat-scoped `ask_user` or its run-approval card will work for external MCP calls. ComfyTV's “Always allow bot runs” switch is not an authorization boundary for Hermes.
- Runtime tool restriction must be enforced on Hermes. The MCP-name setting only tells the agent which configured server to use; it cannot prevent another tool from being called if that tool is exposed by the runtime.
- Frontend tool-preview rendering is not an authoritative generation receipt. Verify the resulting stage and output.

## Verification before enabling production writes

1. Confirm the provider is unavailable without an endpoint or key, and a wrong key fails cleanly.
2. With a read-only Hermes tool allowlist, ask for `server_info` and `get_canvas`. Verify actual MCP results rather than a prose claim.
3. Send a follow-up in the same chat and verify continuity; start another chat and verify isolation.
4. Interrupt/reconnect the event stream and confirm only one run was submitted.
5. Exercise stop and a denied approval. No unapproved tool should execute.
6. Only after explicit authorization, test a reversible canvas edit and then a low-cost generation; read back both stage state and output.

Unit/contract tests with an in-process HTTP server are not live-model or GPU-generation verification. Record these levels separately in a PR's test report.
