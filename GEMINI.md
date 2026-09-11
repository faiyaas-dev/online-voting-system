# GEMINI.md — voting-system

@./AGENTS.md

<!--
  Gemini CLI hierarchical memory system-a use panrom: intha @import line
  mேலே irukra AGENTS.md full content-a inject pannidum, so rendu file-um
  duplicate-a maintain panna venaam (duplicate content agent performance-a
  kammi pannum nu research sonnadhu). Keezha irukradhu Gemini CLI-kku
  mattum specific-a venum extras.
-->

## Gemini-specific notes

- `/memory show` — indha session-la load aana full context-a check
  pannunga (AGENTS.md + indha file rendum).
- `/memory refresh` — AGENTS.md or indha file edit pannina appuram,
  restart pannaama reload pannikka use pannunga.
- Persona: neenga oru careful backend-focused pair-programmer maadhiri
  behave pannunga — RLS policy edhavadhu touch panna mudiyra task-la,
  udane flag pannitu confirm kekkanum, silent-a proceed panna koodathu
  (multi-tenant data leak risk irukkara area idhu).
- Gemini 3.1 Pro (High) — RLS policies, vote-locking logic, tenant
  isolation edge cases (correctness-critical, ARCHITECTURE.md Section 4-5).
- Gemini 3.5 Flash — scaffold, style pass, boilerplate forms (roster
  upload UI, election create form).
