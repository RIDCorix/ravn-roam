# Stage completion convention

LOAD-BEARING. When you finish substantive work on a Linear issue — drafted the assessment / PoC report / spec / fix and consider it ready for review — do all four before stopping:

1. **Update the issue description** with a `## Conclusion` block at the top:
   - outcome in 2–4 lines (recommendation / verdict / what shipped)
   - links to canonical artifacts you produced or edited
   - any open questions Ray should weigh in on (each as a one-liner)
2. **Post a comment** on the same issue tagging Ray (`@ridcorix`) with a one-line "ready for review" note. Comment, not just description edit — Ray's inbox is mention-driven.
3. **Transition the issue to `In Review`.** Add the `manual-required` label iff Ray's hands-on action is required (manual test, signing, unblocking a missing credential). If the issue just needs a heads-up read, leave the label off — that's the signal he can skim past. Never move to `Testing` (auto-set on PR merge per [TEC-7](https://linear.app/ravn-hub/issue/TEC-7)) or `Done` (Ray's manual call after verification).
4. **Surface blockers explicitly.** If you can't complete the work because something is missing (no codebase, missing creds, ambiguous scope), the blocker IS the conclusion — state it in the description, @-mention Ray, add `manual-required`, move to `In Review`. Don't silently stop in `In Progress`.

## Pre-PoC auto-advance (stages 01 → 02 only)

Stages 01-Assessment and 02-PoC are agent-only — no client involvement, all decisions reversible. They chain automatically:

After agent finishes stage 01 or 02 and the issue sits in `In Review`, when Ray replies on the issue with a short approval — `OK` / `ok` / `go` / `開幹` / `ship` (case-insensitive, optional trailing punctuation) — the agent:

1. Transitions current issue to `Done`
2. Creates the next stage's seed issue in the next stage's project (`02-PoC` or `03-Go-No-Go`), assignee = ravn-agent, with a one-line context: `繼續推進，上一張的結論：<one-liner>`
3. Picks it up in the next polling cycle and starts work

Stage 03 (Go/No-Go) does **NOT** auto-advance — that's Ray's manual decision gate. Any Ray reply other than the approval keywords is feedback; agent reads it, responds in the same issue, and waits.

Don't seed the next-stage issue while the current one is still in `In Progress` — the chaining only fires from `In Review` after Ray's ack.

## What NOT to do

- Don't end a session with the issue still in `In Progress` and no comment. Silent stall — Ray won't know to look.
- Don't put the conclusion only in `docs/*.md`. Markdown isn't notifying anyone.
- Don't @-mention Ray for trivial progress pings. Reserve mentions for "ready for review" or "blocker — need decision".
- Don't edit Drive Docs/Sheets directly for narrative artifacts; edit the canonical markdown and let the renderer push.
