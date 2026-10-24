# Student UI completion and PWA check - 24 October 2026

User requests a usable student interface and an honest check of installation/PWA readiness. Prior direct approval allows official docs, existing design and independent review instead of unavailable Context7/Stitch/Sonnet.

Design: calm educational workspace, paper surfaces, deep blue navigation, clear lesson list and primary action, compact mobile layout. Keep design tokens, no decorative icon library or invented curriculum.

Deliver:
1. Inspect manifest/SW/offline/installability and OS app inventory. Distinguish installable, installed, and deployment-ready. No claim of actual device installation from a browser tab or synthetic display mode.
2. Catalog shows available grades/counts, useful unavailable-grade state, search, and lessons directly. Logged-in grade remains authoritative. Refresh/search never erase an active draft.
3. Four functional destinations: subjects, dedicated exercise chooser, downloaded lessons (open/remove), progress with pending/submitted/review states. Clear login prompts, resume action, per-question feedback and retry after acknowledged submission/reload.
4. Persistent account/network status, installation help for browsers without a prompt, accessible dialogs, touch targets, keyboard/zoom/overflow checks. No automatic installation or private-data deletion.
5. Preserve UID-scoped drafts/outbox, immutable versions, SW waiting update. Reuse existing API; no changes to PIN or legacy content. Missing grade7/8 content remains explicit.

Acceptance: tests first for empty grades, exercise navigation, search, downloads removal, restored result, install/help states; existing PWA regressions; static/type/auditor checks; independent browser/a11y/perf and screenshots for visual inspection. Stamp/cache ZIP again after final shell edits; update preview safely without clearing IndexedDB. Document remaining full-plan gaps and production gates.

Review verdict: docs/audits/2026-10-24-student-ui-verdict.md. Keep review files under3KB; no images/PDFs to Sonnet.
