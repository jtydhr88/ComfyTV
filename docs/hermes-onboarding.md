# Hermes Settings onboarding (experimental)

## Operator flow

The Settings connection panel replaces the mandatory custom CMD launcher. It does **not** install Hermes, provision SSH, start a tunnel, or supply a main Hermes API bearer. An existing restricted ComfyTV broker and its bridge/tunnel must already be reachable. HTTPS is supported; unencrypted HTTP is accepted only for loopback. Keep the Linux upstream API credential on Linux. The client credential, SSH identity, and main API bearer are different secrets.

For an existing Windows DPAPI installation, use **Migrate existing Windows credential** first. This explicitly decrypts `%LOCALAPPDATA%\ComfyTV-Hermes\client-key.dpapi` in memory, verifies restricted broker authentication, and saves the same client token with its authoritative endpoint/MCP binding. It does not delete the legacy file, edit a launcher, change process environment, or rotate the broker credential. Do not pair a new credential during development to replace the working production client key.

**Companion dependency:** the broker, pairing CLI and required Hermes API extensions are not included in this ComfyTV PR. They must be published/versioned before this becomes a self-contained installation guide. The command below documents the tested companion contract, not a command supplied by ComfyTV or a released Hermes CLI.

For a new installation with that companion installed, its trusted OS owner issues a one-time code:

```sh
python3 pairing.py create-code --db /path/to/configured/broker.sqlite --ttl 300
```

Run in an intentional interactive terminal as the broker owner; use `--output` with a **new** file in an owner-only directory if protected file delivery is preferred. Use the configured ownership DB, not a new unrelated DB. Confirm the CLI warning: pairing grants the broker installation principal's existing history and configured tool policy; re-pair replaces the one managed active credential. The TV side never creates pairing grants.

Enter endpoint and one-time code in Settings. Python generates the client token and securely persists a single pending record before the claim request. The browser never receives this token. Advanced manual import accepts an existing dedicated client token only and rejects unrestricted/main API contracts. Connection test checks authentication/capabilities/binding, not inference or GPU health.

Ordinary ComfyUI/Desktop startup reads the secure binding dynamically; no custom CMD and no credential restart are required after a successful save. A separately required SSH bridge still needs its existing configured startup mechanism; this feature does not install one.

## Storage and trust

- Windows: CurrentUser DPAPI using Python stdlib ctypes; no additional Windows dependency. The directory and new active record require current-user ownership and a protected DACL with exactly current-user SID and SYSTEM full control. Directory `PAI` is equivalent to `P`: `AI` is bookkeeping, not an access grant. **Legacy-only exception:** the old elevated .NET installer produced `client-key.dpapi` with Builtin Administrators (`BA`) owner and inherited user+SYSTEM full-control ACEs. Explicit migration accepts this file only in the backend's exact protected current-user-owned directory, with no extra principals/rights. This exception never applies to `connection-v1.dpapi`; inherited/unprotected or BA-owned active records still fail closed. Junctions/reparse ancestors, symlinks, non-files, oversized legacy files and multiple hardlinks are rejected. No production ACL is silently repaired; successful migration writes a new strict encrypted record while retaining the old file and ACL. Local account/admin compromise is outside this trust boundary. Public status does not create a directory or probe the broker.
- Linux/macOS: optional `keyring` package with an allowlisted native SecretService, macOS, or KWallet adapter. Chained, null, plaintext and unknown adapters are refused. Physical keyring availability is not claimed by Linux fixture tests. A private nonsecret `keyring-used` marker (content `1`, no credentials) under `~/.local/share/ComfyTV-Hermes` or `~/Library/Application Support/ComfyTV-Hermes` prevents inherited environment fallback if a previously used keyring dependency disappears. It is not a plaintext credential backend.
- Saved secure records win over inherited `COMFYTV_HERMES_API_KEY`. Environment compatibility is only for an initially unconfigured installation; it is displayed as `environment`. Read corruption, unsafe storage, a locked selected native adapter, and disabled tombstones do not fall back to an inherited token.
- Storage namespace/path injection is Python-constructor/test-only. HTTP bodies cannot redirect credential storage. The production path is outside plugin/source/install trees.
- POST pairing/import/migration/test/disconnect use the existing real transport-based `CHANNELS.validate` gate: direct loopback peer, exact Origin/Host, no forwarded headers, HttpOnly cookie, CSRF and current channel lease. LAN GET status is secret-free. Local account/admin compromise is outside this trust boundary.
- Generic settings changes to URL/MCP/model use the same local gate, cannot redirect a saved bearer, and are blocked during setup/active relevant Hermes work. Other providers and unrelated settings remain compatible.

## Recovery and disconnect

`setup_pending` means the remote claim or local commit may have succeeded. Public status carries the reason in `secure_storage.reason`, without adding wire fields or exposing secrets. Re-enter the **same endpoint and same code**: Python reuses the encrypted pending token and first performs read-only credential reconciliation. This also recovers an accepted claim after the code has expired. A different code/endpoint cannot overwrite the unresolved pending registration. If it was not accepted, the same pending claim may be retried; do not blindly generate another credential. A definitive rejection of the first claim restores the previous working secure/environment configuration. Unknown/accepted rotations never restore a potentially invalid old bearer.

Expired codes that were never accepted cannot be revived. Trusted admin review or explicitly local disconnect followed by a fresh owner-issued grant is required. A successful new managed grant replaces the installation's old active token. Only one encrypted pending record exists, not an unbounded spool of secret files.

Disconnect requires explicit UI confirmation:

- **Local disable only** persists a disabled tombstone and forgets local credentials. It does **not** revoke the remote token; the remote credential remains valid.
- **Revoke remotely** persists a pending revoke before sending, requires the exact `revoked` acknowledgement, then persists the disabled tombstone. `revoke_pending` is not a revocation success. The TV never blindly repeats an unknown revoke mutation. An explicit local disable is still possible, but remote revocation needs trusted broker-owner confirmation when acknowledgement was lost.

Revocation prevents future authorization, not automatic termination of model/GPU work already admitted. Do not claim that revoke stops an existing job.

## Native Windows acceptance (mandatory before production)

Copy these two repository files to an isolated test folder:

- `bot/hermes_credentials.py`
- `tests/native_hermes_store.py`

Run under the actual Windows Python 3.13 runtime, **not** under ComfyUI package initialization:

```powershell
python tests/native_hermes_store.py bot/hermes_credentials.py
```

The harness imports the module directly by file path and touches only a fresh `%LOCALAPPDATA%\ComfyTV-Hermes-native-test-<uuid>` namespace, which it deletes in `finally`. It tests actual DPAPI encrypted round-trip/readback, owner+SYSTEM ACL, corruption, Everyone ACL rejection, hardlinks, junction rejection, legacy-file decryption and a disabled tombstone. It never reads the production credential file or sends a network request. Tokens are generated inside Python, not supplied via argv or printed. Linux reports `native_windows_verified:false` and exits 2; that is a platform blocker, not an acceptance pass.

## Historical Windows ACL regression

Also stage `tests/native_hermes_legacy.py` and run under an **elevated same-user** Windows Python context:

```powershell
python tests/native_hermes_legacy.py bot/hermes_credentials.py
python tests/native_hermes_store.py bot/hermes_credentials.py
```

The new harness uses real .NET ACL APIs to reproduce the protected inheritable `PAI` directory and `BA`-owned inherited `AI` legacy file, verifies the exact observed SDDL, and generates a synthetic CurrentUser-DPAPI token. If the execution context cannot set BA ownership or reproduce the exact historical ACL, it **fails**, never skips to PASS. It validates pre-migration `source:none`, `configured:false`, storage available and migration visible; legacy decrypt; strict new encrypted active write; environment-less effective binding; unchanged legacy ciphertext/ACL; and rejection of extra principals, unsafe owners/parents, active inherited/BA ACLs, hardlinks, oversize, wrong namespace and reparse ancestors. No broker calls or production reads. The unique namespace is removed in `finally`; success is printed only after cleanup has been verified. The old native harness remains unchanged and must also pass. Linux exit 2 is not native acceptance.

Backend constructor failure is cached by `get_store()`: fully restart ComfyUI after updating the credential backend before checking status. Successful credential saves are read dynamically and do not themselves require a restart.

## Deployment checklist

1. Verify compatibility of the separate broker and Hermes API contracts. Back up plugin files and protected credential state without exposing their contents.
2. Stop ComfyUI normally before replacing Python files, then start through the ordinary entrypoint.
3. On the same host, use the loopback Settings page to pair or migrate. Keep legacy credentials as rollback material; avoid unnecessary rotation of a working broker identity.
4. Check that status reports `secure_store`, then use **Test current connection** and an actual read-only Bot turn. Authentication/capability checks are not inference tests.
5. Do not restore an old bearer after an accepted remote rotation. Preserve unknown encrypted pending state for reconciliation.

The draft's ordinary-start storage discovery and isolated native Windows harnesses were verified. The final production Settings migration followed by a Bot turn remains unverified at submission. Native Linux/macOS keyrings also require platform acceptance.

## Optional companion integration tests

`tests/test_image_refs_broker.py` and `tests/test_task_context_e2e.py` explicitly skip unless `COMFYTV_TEST_BROKER_SOURCE` points to a separately obtained compatible `broker.py`. Put its directory on `PYTHONPATH` for sibling imports. These tests use a real broker with loopback synthetic upstreams, not a live model. The companion is not shipped here; skips are not acceptance evidence.

## Focused verification

```sh
python -m pytest tests/test_hermes_connection.py tests/test_hermes_credentials.py tests/test_hermes_connection_r1.py tests/test_hermes_legacy_acl.py -q --asyncio-mode=auto
```

The storage tests explicitly distinguish reversible injected crypto, injected OS adapter fixtures and actual filesystem failures from native Windows DPAPI/ACL acceptance. The HTTP fixture really listens on a local aiohttp socket and exercises the actual TV routes, including auth rejection, redirects, unknown delivery, storage failure/retry, strict JSON/trust gate, binding precedence, migration, and disconnect. Broker expiry/replay/concurrency ledger acceptance belongs to the companion broker and cross-layer handoff.
