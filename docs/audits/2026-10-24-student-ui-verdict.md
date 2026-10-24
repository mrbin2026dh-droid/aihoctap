# Independent student UI / PWA verdict - 24 October 2026

Reviewer: Codex student_ui_review, under approved tooling substitution; not a Sonnet verdict. No application edits or OS installation performed.

**ACCEPT the reviewed local student UI and Chromium installability checks. This does not certify actual installation or completion of the entire production plan.**

## Executed evidence

Final isolated host command: `python -X utf8 -m pytest tests/test_pwa_student_ui_audit.py -q -s --basetemp=scratch/pytest-student-ui-approved-artifact`.

**11 PASS, exit 0, 36.44s.** Synthetic records, unique localhost, separate teacher/student contexts, external HTTPS blocked.

Verified: empty-grade explanation and usable fallback; search; dedicated exercises; authoritative student grade; removal of downloads preserving drafts; result/retry after reload; installation help without native prompt; standalone UI simulation; manifest/CDP; readable metadata, named controls, six widths; deliberately delayed catalog after first paint.

Prior UI/caption/layout failures were reproduced and repaired; initial shift sum0.250252 fell below0.1.

Follow-up counter repair reviewed: locked forms use saved draft answers. Independent submit/reload regression: **1 PASS, exit0, 6.19s** on artifact0285d72c98f13dad1d6c5414. No app edits.

## PWA and lab observations

- CDP Page.getAppManifest: errors[]. Page.getInstallabilityErrors: errors[]. Secure context and controlling SW observed. Manifest standalone mode and192/512 icons verified.
- Actual test display-mode was browser (standalone=false). The separate matchMedia simulation only tests UI; it is not evidence an OS app was installed.
- Final localhost sample: LCP/FCP164ms, TTFB17.1ms; initial shift sum0.004550. Held-catalog case0.004550. Event Timing samples16-40ms are not field INP certification.
- No horizontal overflow at360/390/412/768/1366/1920px. Zero visible unlabelled controls/unnamed buttons in sampled views; meaningful captions>=12px. Focused automation is not full WCAG/screen-reader certification.

Fresh screenshots in `scratch/student-ui-audit/`: catalog-390.png, catalog-1366.png, practice-390.png, downloads-empty-390.png, lesson-reading-390.png, lesson-exercise-390.png. Mobile/desktop and actual lesson screenshots inspected: readable content, reachable lesson/exercise actions, coherent layout. Fixed navigation in full-page captures remains at viewport bottom.

## Scope still pending

Real device installation/Android/iPhone tests; deployment HTTPS/durable storage/auth/backup; legacy public answer-key migration. Content for grades7/8 is absent. PWA login remains school code; desktop Google login is separate. Text answers await teacher review; a full grade-update workflow is outside these UI checks.

References: [MDN installation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [CDP Page](https://chromedevtools.github.io/devtools-protocol/tot/Page/).
