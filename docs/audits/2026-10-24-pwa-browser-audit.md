# Independent PWA browser audit — 24/10/2026

Auditor: Codex pwa_audit. Synthetic data, disposable SQLite, unique localhost port, separate teacher/student Chromium contexts; BroadcastChannel removed and external HTTPS aborted.

## Executed evidence

Command: `python -m pytest tests/test_pwa_browser_audit.py -q -s` (approved host).

Initial result: **6 PASS, 1 FAIL**, exit 1, 29.36s.

Final independent rerun after fixes: **8 PASS**, exit 0, 22.30s; basetemp `scratch/pytest-pwa-browser-independent-green-20261024`.

Passed:
- Actual teacher editor login, preview, publish, reload private document, read submitted answers, logout and clear private DOM.
- Drafts stay separate between two accounts and restore to the original account.
- An old account's delayed submission ACK is stored for that account and does not appear in the newly logged-in account's UI/progress.
- Corrupted package fails SHA256 verification while the prior downloaded version remains usable.
- Injected IndexedDB quota failure shows an error, stores no package and does not claim download success.
- Keyboard focus, labels, accessible button names, five viewport widths, no chatbot requests, and student-only service-worker cache.

Initial failure: releasing a held lesson response reopened the lesson after navigation to Progress. Fixed with generation/account guards; regression now PASS.

Additional regression initially FAIL (3.77s): title-only editing reduced eight choices to four. Fixed by preserving actual option keys; now PASS.

## Local performance observation

Headless Chromium, localhost, 390×844, no throttling. One lab sample, not real-phone/field Core Web Vitals.

| Measurement | Observed |
|---|---:|
| LCP | 72 ms |
| FCP | 72 ms |
| TTFB | 12.2 ms |
| Layout-shift sum without recent input | 0 |
| Recorded Event Timing durations | 16 ms |
| Click capture to two animation frames | 24.2–29 ms |
| Resource transfer total | 35,988 bytes |

**INP is not certified.** Interaction samples are local observations, not field INP. One local stylesheet, module scripts, system fonts; no third-party render dependency observed.

## Accessibility and cache checks

Zero visible form controls without labels; zero visible unnamed buttons. Keyboard Tab reaches an element. Document scrollWidth equals viewport width at 360, 390, 412, 1366 and 1920 px. This is a focused automated audit, not a full WCAG conformance assessment or screen-reader test.

Observed shell cache: `/hoc/`, index.html, styles.css, app.js, api.js, db.js, dom.js, manifest, two local icons. No API response or teacher page/module in cache. Future releases must version the shell cache and verify updates while drafts are active.

Backend rerun after cache-header repair: **20 PASS**, exit 0, 2.57s. Legacy public answer-key artifacts remain a separate release limitation.
