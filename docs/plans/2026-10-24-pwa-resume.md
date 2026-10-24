# PWA resume - 24 October 2026

Scope: finish the existing multi-subject student PWA without a chatbot. Preserve teacher PIN behavior and unrelated work. Reference: 2026-10-24-pwa-implementation.md.

Observed: frontend/hoc has shell, styles, API, DB, DOM and types; app.js, sw.js and teacher entry are missing. Backend has contracts but no PWA router/service/store. Existing API and entry tests are the initial red gate.

Sequence:
1. Read aisgk.md and AGENTS.md; inspect CodeGraph and run isolated PWA baseline.
2. Tooling substitution directly approved by user in this chat: official docs, existing design and independent agent review replace unavailable Context7/Stitch/Sonnet. Do not claim those unavailable tools ran.
3. Backend: transactional persistent SQLite locally; immutable public packages without answer keys; private grading by exact version; authenticated idempotent submissions; account-scoped progress and teacher results; refuse ephemeral production writes. Register router before static mount.
4. Browser: connect existing shell, authenticated drafts/outbox, hash-verified downloads, pinned active version, explicit sync errors, safe SW updates. Separate teacher editor. Keep existing desktop app compatible.
5. Verify red-green API and real HTTP/browser tests, offline restart, account separation, package updates, static/type checks, independent review, accessibility and measured performance. Expand regression coverage for affected existing routes.
6. Record actual evidence and limitations in aisgk.md. Release only after all required checks; do not claim production readiness from local tests.

Gates: no real school-data writes, no private answer keys in public artifacts, no automatic data deletion, no credentials in logs. Missing prerequisites must be recorded rather than treated as PASS.

Review output requested: docs/audits/2026-10-24-pwa-resume-verdict.md. Sonnet review must use this file path, no images/PDFs or long source dumps. This plan is under 3KB.
