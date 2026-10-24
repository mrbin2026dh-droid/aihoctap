# Clear existing exam results

User explicitly chose: remove ALL current exam results, retain exam definitions and accounts. Authorization includes GitHub publication. Do not change PIN, textbook progress, documents or account/profile fields.

Contracts: back up results privately under ignored scratch before any deletion. Firebase: remove exam_submissions and only each student's exams subtree using fresh ETags/conditional DELETE; abort on concurrent change. Compare all exam definitions and student records excluding exams before/after. Keep cloud backup out of Git/public site. Remove tracked operational submission JSON from main and Pages, ignore future submissions. Redeploy resets ephemeral backend submissions. Verify live teacher results are empty without writing scores.

Browser: a one-time release migration clears only AISGK_SUBMISSIONS and aisgk_offline_submissions before startup reads/flushes. A persistent revision marker makes reload idempotent, retaining new submissions after cleanup. Preserve login, teacher sessions, definitions and learning progress. Test these invariants before implementation, including unavailable storage.

Validate with Node regression, browser reload, Python exam/analytics/outbox gates and static checks. Publish main + Pages without force; verify public app hashes and live cloud empty mirrors, exam definitions/accounts unchanged. Sonnet unavailable per prior session; independent Codex reviewer substitutes where available. No UI redesign or component generation needed.
