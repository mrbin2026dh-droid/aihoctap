# Independent review - Grade 9 tutor - 2026-10-24
Reviewer: separate Codex review agent, read-only final review; not Claude Sonnet.
Scope: backend tutor generation/guardrails and frontend learning/retry context. PIN behavior excluded.
Verdict: acceptable within tested scope; no additional blocking regression found.

Confirmed: known answer/forbidden terms, ordinal selection and option elimination are checked; exact pasted exercises retain question guards in theory; missing lesson source prevents generation; model receives actual question/options without answer-key field; client correctness is not trusted; retry/network/context behavior is corrected.

Evidence supplied: 328 focused pytest tests, 9 Node behavior tests, real HTTP/browser learning flow. Viewports 1920,1366,390 all have matching scrollWidth/clientWidth. Local LCP 1048ms; CLS 0.064 with external services isolated. These are lab figures, not production field metrics. INP was not established.

Limits: matching and output checks are heuristic, not proof against every paraphrase, encoding or prompt injection. One live Gemini smoke test using wholly synthetic content succeeded in 4094ms; project curriculum was not exported. This does not establish overall live model quality. Full-project unrelated tests must be reported separately; this review does not approve all other features or deployment.
