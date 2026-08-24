---
name: present-spec
description: "Use when Corix gives you a roam-spec file or URL and wants to walk through it out loud — 講一下這份 spec, present this spec, 我們來討論這個規格, design review. Presents it slide by slide over voice, and writes every decision back into the file as it is made."
user-invocable: true
allowed-tools: Bash(git *), Bash(gh *), Bash(rg *), Bash(sed *), Bash(cat *)
---

# Presenting a spec

A `roam-spec` file is the spec itself, not slides about it. You are not summarising a
document for someone who will edit it later — **you edit it during the conversation**, and
what you leave behind is the agreed spec.

Corix's stated reason for wanting this out loud: *「不會因為我懶得看而漏掉細節」*. That is
the job. A presentation he could have skim-read achieves nothing.

## Before you start

Read the whole file once, silently. Then:

1. **Check the checkout is current.** `git fetch && git log origin/main -1`. A spec discussed
   against stale code produces agreement about problems that no longer exist. This has
   already happened once here — an entire verification layer was built against a checkout
   four commits behind.
2. Count the `data-decision` blocks with `data-status="open"`. **Say the number out loud
   before slide 1.** He is agreeing to a conversation of a certain size; he should know its
   size at the start, not discover it at slide 4.
3. Note any criterion whose `data-check` is `human`. Those are the ones nothing will catch
   later, and they are worth his attention more than anything else in the file.

## Presenting

**One slide, then stop.** The failure mode is reading the whole document aloud. He can
read. What he cannot do alone is be asked the right question at the right moment.

For each `<section data-slide>`:

- Say what the slide establishes, in your own words, not by reading the prose.
- `<aside data-narration>` is written for you, not for him. It carries the emphasis and,
  more usefully, the parts the author was unsure about. Use it; never read it out.
- If the slide has a mockup, describe what he is looking at before discussing it. He may be
  walking.
- If the slide carries an open decision, **stop there and get an answer.** Do not continue
  to the next slide with a decision still open — a decision skipped in the room is a
  decision that comes back as a blocked issue three days later.

## Decisions

Present the options as written, then say which one you would pick **and what it costs**.
An option presented without its cost is not a real option, and he will notice.

He may reject the framing entirely and describe a fourth option. That is a good outcome,
not a derailment — write it in as a new `<li data-option>` before resolving.

When he settles it, immediately:

```
data-status="open"  →  "agreed"      (or "deferred", with what it is waiting for)
<p data-resolution> →  what was decided, and the reason he gave
```

Write it **in his words where you can**. A resolution paraphrased into spec-prose loses the
reasoning, and the reasoning is what the next reader needs.

## Editing the mockups

Mockups are live HTML with stable ids and their colours hoisted into CSS variables on the
`.phone` scope. When he asks for a change, make it — do not describe what it would look
like.

- Colour, weight, spacing: change the variable, not the rule that uses it.
- Structure: keep the ids (`#mock-card`, `#mock-card-low`); other things anchor to them.
- After each edit, **say what you changed in one sentence** so he can tell whether the
  change he is now looking at is the one he asked for.

If a request cannot be done by editing — it needs a component that does not exist — say so
and record it as a new open decision or a criterion. Do not fake it in the mockup; a mockup
showing something the product cannot do is worse than no mockup.

## The changelog is not a closing step

`<ol data-log>` is **append-only**. Add an entry at the moment of each change, not at the
end — a session that ends abruptly should still have recorded everything up to that point.

Each entry: date, what changed, and **why**. The why is the entire value; the current state
is already visible in the file.

Never edit or remove an existing entry, including your own from earlier in the session. If
a decision is reversed, that is a new entry saying so.

## Before you finish

Check all four, and say the result out loud even when everything passes:

1. **No `data-status="open"` remains.** Anything unresolved is `deferred` with a named
   condition — never left open because you ran out of time.
2. **Every criterion has a `data-check`.** If a decision created a new criterion, it needs
   one. `human` is a legitimate answer; undeclared is not. This is the exact gap that let
   *"Product/plan cards clamp long names"* reach implementation on a card that renders no
   names — it survived spec, build and a review round because nothing forced it to name a
   checker.
3. **Any `human` criterion that just became testable is downgraded.** A decision often does
   this: once the rule is settled, a check exists that did not before. Say which ones you
   moved, and to what.
4. **The changelog covers every change.** Compare against the diff, not your memory.

Then commit — `docs(spec): R-xxx …` — and tell him the branch. If `multica` is on PATH and
authenticated, post the file back to the issue and set the node's exit; if it is not, say so
plainly and tell him the one command he needs. **Do not end by describing a handoff you did
not perform.** Saying who should act next is not the same as making it happen, and the
difference is invisible from his side until nothing moves.

## What not to do

- Do not read the file aloud. Talk about it.
- Do not batch edits to the end. A dropped connection then loses the entire session.
- Do not resolve a decision he did not actually settle. "Sounds fine" is not a decision;
  ask again.
- Do not add scope. A design review that grows the feature has failed at its job.
