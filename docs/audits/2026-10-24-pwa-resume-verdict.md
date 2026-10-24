# PWA resume verdict — 24 October 2026

Reviewer: independent Codex agent `pwa_audit`, replacing unavailable Sonnet under the user's explicit approval. This is not a Claude/Sonnet verdict.

**Verdict: ACCEPT the reviewed local implementation. Production release is NOT approved.** The implementation agent must retain the final aggregate test/static-check results for the exact release artifact.

## Resolved review findings

- Private/denied/ACK responses now carry no-store. Independent backend audit previously rechecked 20 PASS.
- Public versions bind an opaque grading revision; answer-only edits preserve historical grading. Course identifiers and metadata are consistent.
- Account-captured drafts/outbox and delayed ACK behavior, teacher editor workflow, corrupted-download recovery, quota errors, navigation cancellation and preservation of all valid option keys were independently checked: 8 browser tests PASS (22.30s). Earlier red results are retained in the browser audit.
- Seed repair accepted: completion is recorded in `settings.curriculum_seed_v1` only after the import pass; partial runs retry missing lessons through `only_if_missing`, preserving teacher changes. Normal teacher publication initializes seeding without recursive seed calls. Both previously failing regressions independently reran **2 PASS, exit 0, 0.47s**: interrupted second import + retry/custom lesson preservation, and teacher-first initialization.
- Static archive uses an explicit allowlist; shell bytes determine its cache stamp. Source changes require restamping/checks. Archive excludes operational data and legacy JSON. Operational documentation accurately describes SQLite/single-instance and offline limits.

## Remaining release conditions

1. Legacy public curriculum/exam JSON still contains answer keys. A separate PWA archive does not close existing URLs; complete a compatible site-wide migration before promising answer secrecy.
2. Verify actual durable cloud disk, authorization, HTTPS, restart persistence, backup/restore and deployment configuration on staging. Environment variable names alone do not prove cloud readiness.
3. Test installation, offline restart, storage pressure and updates on real Android/iPhone devices. Headless localhost metrics are lab observations; field INP and full WCAG conformance are not certified.

No production writes/deployment or application edits were performed by this reviewer. See `2026-10-24-pwa-browser-audit.md` for textual browser/performance evidence. Existing desktop/PIN behavior remains outside this change's implementation scope.
