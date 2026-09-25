# Sync format v2 — sharded + gzip Drive files (2026-09-25, s221)

## Why
Production trace (both PC and iPhone, same home network): every step is sub-second except
`upload bookmarks.json (1.48MB)` which fails after 27–90s per attempt. Measured from the user's PC:
POST 256KB → Cloudflare 0.09s, www.google.com 0.14s, `www.googleapis.com/drive/v3` 0.33s, but
`www.googleapis.com/upload/drive/v3` ≈20KB/s (64KB = 3.1s) and Google drops the connection after
~20–30s. Downloads are fast (1.48MB in 3s). We cannot change Google's upload intake, so each sync
must upload very little. v1 also re-uploads/re-downloads whole files every cycle and hits the 5MB
multipart limit around ~5,000 bookmarks.

Goal: adding/editing one bookmark uploads a few KB; unchanged data is neither uploaded nor
downloaded; latency target ~10s between devices at ¥0.

## Unchanged
- `mergeAll` / per-record merge semantics (lib/sync/merge.ts) — v2 assembles full snapshots from
  shards and merges exactly as today.
- Lock, timeouts, retries, trace, mass-delete guard, vault-conflict logic, license gate.

## Drive layout (folder `AllMarks`)
- `manifest.json` → `{ formatVersion: 2, shardCount: S, updatedAt, migratedFromV1?: { bookmarks?: rev, cards?: rev, tags?: rev, boardConfig?: rev, vault?: rev } }`
- `bookmarks-<k>.json.gz`, `cards-<k>.json.gz` for k = 0..S-1 — rows assigned by
  `fnv1a32(id) % S` (stable; adding a row touches exactly one shard).
- `tags.json.gz`, `board-config.json.gz`, `vault.json.gz` (small single files).
- Content = gzip(JSON array/object), uploaded as `application/gzip` (binary multipart via Blob body;
  resumable path unchanged for >4MB). Compression via `CompressionStream('gzip')`; download via
  `alt=media` → bytes → `DecompressionStream`. If CompressionStream is unavailable, write/read the
  same names without `.gz` as plain JSON (reader accepts both).
- S default 16. Reshard (double S, rewrite all shards, then delete old shard files) only when the
  average rows per shard exceeds 200 — rare.

## Cycle
1. `list` (names + headRevisionId, one call; pageSize must cover all files — paginate).
2. Pull: for each v2 file, if its headRevisionId equals the device-local cache entry, use cached
   text; otherwise download (+ decompress) and update the cache. Assemble remote snapshot.
   Cache = new device-local settings record `sync-remote-cache` `{ [fileName]: { rev, text } }`
   (add to `DEVICE_LOCAL_SETTINGS_KEYS` in lib/storage/backup.ts).
3. merge (unchanged) → apply-local (unchanged).
4. Push: serialize merged snapshot per file/shard; upload only those whose serialized text differs
   from the cache (optimistic lock per file as today); update cache + headRevisions after each
   successful upload. Write manifest only when S or format changes.
5. `skip-check` fast path compares listed revisions against the cache.

## Migration v1 → v2 (automatic, non-destructive)
- If manifest is missing or `formatVersion < 2` and v1 files exist: read v1 files as this cycle's
  remote snapshot, then push writes all v2 files + manifest v2 with `migratedFromV1` = the v1
  revisions read. v1 files are left in place (never deleted by this change).
- Stale clients (old tab not yet reloaded) may still write v1 files. On a v2 folder, if a v1 file's
  current revision differs from `migratedFromV1[...]`, read it and merge it in as an additional
  remote source for that cycle, then record the new revision in the manifest. So nothing written by
  an old tab is lost.

## Timing (after v2)
- Local-write debounce 20s → 3s (`DEFAULT_DEBOUNCE_MS`).
- Visible-page poll 30s → 10s (`POLL_INTERVAL_MS`), skip-if-unchanged path only lists.

## Verification
- Unit: shard assignment stability; gzip round-trip; unchanged shard → no upload/no download;
  one new bookmark → exactly one bookmarks shard uploaded; migration from v1 fixture; stale v1
  write merged after migration; reshard; cache is device-local (excluded from backups).
- Production: user adds one bookmark on each device; sync log shows `upload bookmarks-<k>.json.gz
  (≈KB)` in a few seconds and the other device shows it within ~10s without reload.
