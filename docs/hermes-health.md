# Passive Hermes integration health

`GET /comfytv/bot/providers/hermes/health` returns `{enabled, provider}`. When the bot is disabled, `provider` is null and no provider is probed. This endpoint selects only Hermes. The ordinary bot status endpoint retains its all-provider response and adds optional `health` records. One provider exception does not fail the complete list.

Hermes reads the restricted broker's authenticated `GET /v1/comfytv/health`. This is not an inference test. The broker reads protected capabilities and detailed health sequentially, with only its administrator-configured MCP server selected. No client query/body/selection is accepted, and no model picker, credential resolver, tool invocation, session creation, or run submission occurs during health refresh.

## Evidence and compatibility

- API fields distinguish restricted-key acceptance, upstream transport, upstream bearer acceptance, and the Runs contract. `logged_in` means API bearer acceptance, not provider-account login.
- MCP fields describe cached, API-scoped configuration/registry observations. `connected_cached` is not a fresh network check. Reachability stays unknown without a timestamped observation.
- The media gate is a local saved ComfyTV setting. Preview/context/vision capabilities do not prove inference. Video frame sampling and audio metadata/waveform inspection are supported by the media adapter; continuous-video understanding, audio listening/transcription and document parsing are not promised.
- Configured default, administrator-authorized override, and last-served model are separate. Last-served is broker-local historical evidence from an owned successful terminal run with bounded runtime metadata and an upstream completion timestamp. It resets with the broker process and does not predict the next turn. Runs created before selection-mode recording have no historical receipt.
- Both upstream reads send the same encoded administrator-bound `integration_mcp_server` selector. The selected upstream capabilities path uses passive in-memory state; query-less capabilities remains unchanged.
- An entirely absent integration snapshot is legacy-compatible. An explicitly present null, incomplete, wrongly typed or wrong-version integration is `upstream_contract_invalid`; it never advances successful time or becomes fresh cached success. Extra fields are dropped.
- Old main APIs without the optional integration snapshot leave MCP/default model unknown. An old broker returning 404 uses capabilities compatibility and emits `diagnostics_unsupported`; it does not claim upstream health or inference success.
- Saved server/model mismatches are diagnosed. Existing local preflight uses a previously observed policy only for the same configuration fingerprint. The broker remains the authorization authority; health never authorizes a new model.

## Capacity and freshness

The broker retains work capacity 1 (administrator maximum 2), control capacity 2, and status capacity 2. Capabilities and health use status, not work. A single health refresh can hold one status slot; additional refresh callers receive cached/stale information or bounded 429 rather than another upstream refresh. Stop/deny and an owned run status read retain independent capacity even while SSE fills work.

Successful health checks are fresh for 5 seconds. Previous evidence may be displayed stale for at most 30 seconds. Failed refreshes never renew the successful check timestamp or silently retain a green API contract. Configuration changes invalidate the cache. Aggregate health work is bounded by the smaller of 20 seconds and the configured control timeout; no detached refresh tasks are created. Existing 120/7200/600-second run transport budgets remain unchanged.

Identifiers use bounded ASCII provider/model grammar and reject URL/path traversal, case-insensitive credential-like prefixes, JWT/header-shaped identifiers and already-known endpoint credentials. Shape checks cannot detect every arbitrary opaque secret; no additional credentials are loaded for filtering. The same rules cover configured default, authorized override and owned runtime metadata at broker and TV boundaries.

Responses are `Cache-Control: no-store`. Health identifiers and fields are allowlisted; raw errors, URLs, credentials, process details, config dumps and unrelated sessions are not forwarded. Deployment and independent integration/security review are separate from this local implementation.
