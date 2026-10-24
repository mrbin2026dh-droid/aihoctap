# Bug audit and repair plan - 2026-10-24

Repo: https://github.com/mrbin2026dh-droid/aisgk
Local branch: fix/security-and-auth-hardening; HEAD dd351d6.
Preserve all existing uncommitted edits; do not publish them without review.

## Evidence gathered
- CodeGraph: 82 files, 1175 nodes, 2536 edges; index has pending changes.
- Pytest collection: 245 tests, exit 0.
- backend/server.py:93-96 embeds a fixed teacher PIN fallback. Missing or weak configuration uses a publicly readable credential. This defeats the fail-closed check at lines 428-432.
- tests/test_reproduce_audit_bugs.py asserts that internal errors leak and out-of-scope answers occur. tests/test_verify_audit_fixes.py requires the opposite. Both enter the default suite.
- test_fix_6 only tests a local fake client; it does not prove production calls Gemini.
- Initial test execution: 10 setup errors from sandbox temporary-directory permissions. Retry uses workspace scratch directory; outcome must be recorded separately.

## Contracts and repair sequence
1. Confirm remote refs without exposing credentials. Inventory existing changes and review separately.
2. Authentication must deny access when TEACHER_PIN is missing, blank, or known weak; no embedded production secret. Add isolated startup/login regression tests first, observe failure, then repair.
3. Convert obsolete bug-existence assertions into regressions of correct behavior. Verify actual production Gemini invocation through dependency replacement; no real student data or paid API calls.
4. Recheck tutor lesson boundaries, authoritative grading, request cancellation, exam permissions and submission persistence. Fix only reproduced defects, each with failing regression first.
5. Run complete isolated suite, V8/Oxlint, Alibaba review, independent browser/network tests, accessibility and performance checks. Record failures and external dependencies honestly.
6. Review diff and secrets; commit verified task changes to codex/ branch and push. Do not force-push or bypass hooks. Report commit, branch and residual risks.

## Required gate before implementation
AGENTS.md requires Sonnet plan review before code. No Sonnet connector is exposed in this session. Context7 CLI invocation did not complete and was stopped; no docs retrieved. Stitch MCP is not exposed, required if UI generation is needed.
Sonnet: read this file by path, return concise PASS/conditions to docs/audits/2026-10-24-codex-bugfix-sonnet-verdict.md. No images/PDFs or long prompts.
