# Antigravity: bounded Notebook/REA review for a student PWA

User authorizes analysis and detailed planning, not production changes. Workspace: ..

Read local evidence: docs/audits/2026-10-24-rea-notebook-installation.md.
Review proposed plan: docs/plans/2026-10-24-student-pwa-no-chatbot.md.

Target: installed Chrome web app Gemini Notebook (user calls it NotebookLM), app-id kjfmejlnnfibknebffpdmphoiomckhdb, Chrome Profile 8. Shortcut targets chrome_proxy.exe. Local REA checkout package is 6.6.0 but dist/node_modules are absent; running its doctor reports missing compiled runtime. Antigravity MCP has gemini-notebook-mcp, no REA entry. Do not confuse the Notebook connector with a decompiler.

Tasks:
1. Independently verify target identity and REA readiness with read-only metadata. Use the REA skill in rea/.agents/skills/reverse-engineer-anything/SKILL.md. Report the concrete blocker; do not claim decompilation succeeded.
2. Where available, inspect only install/manifest/SW/cache/update metadata and publicly served client behavior needed for PWA planning. Do not read private notebooks, cookies, passwords, tokens, browser history or authenticated payloads. No injection, TLS bypass, package patching, executable modification or network replay.
3. Distinguish observations, inferences, proposals and unknowns. Do not promise recovery of Google's original server/model source. A Chrome launcher is not the app's business logic.
4. Review the multi-subject PWA plan: lesson reading, questions, exercises, offline drafts, versioned teacher publication, safe updates and account-scoped sync. NO student chatbot or runtime LLM dependency. Keep existing teacher/desktop app compatible.
5. Explain app updates versus content updates, offline grading versus answer secrecy, and limits when phones are closed/offline. Check durable storage and deployed authorization before pilot.

Return a concise evidence-based review in chat. Do not edit app code/data, install packages, run setup, alter MCP/provider configuration, launch private notebooks, commit, push or deploy. If REA setup is needed, describe a scoped dry-run plan with backups; stop before configuration writes. No screenshots, PDFs or large source dumps in prompts.
