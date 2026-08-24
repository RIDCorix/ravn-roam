---
name: present-spec
description: "Use when Corix gives you a roam-spec file or URL and wants to walk through it out loud — 講一下這份 spec, present this spec, 我們來討論這個規格, design review. Presents it slide by slide over voice, and writes every decision back into the file as it is made."
user-invocable: true
allowed-tools: Bash(git *), Bash(gh *), Bash(rg *), Bash(sed *), Bash(cat *), Bash(python3 -m http.server *), image_gen, computer
---

# Presenting a spec

A `roam-spec` file is the spec itself, not slides about it. You are not summarising a
document for someone who will edit it later — **you edit it during the conversation**, and
what you leave behind is the agreed spec.

Corix's stated reason for wanting this out loud: *「不會因為我懶得看而漏掉細節」*. That is
the job. A presentation he could have skim-read achieves nothing.

## Before you start

**Serve it and open it.** The deck auto-reloads when the file changes, and that only works
over http — from `file://` the reload check is blocked and fails silently, which looks
exactly like a deck that does not update.

```
cd docs/specs && python3 -m http.server 8899
```

Open `http://localhost:8899/<file>` full-screen. He should not have to touch the browser
again for the rest of the session — that is the whole arrangement.

Then read the whole file once, silently, and:

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

**He talks; you do everything else.** He does not click, scroll, or refresh. If he has to
touch anything, the arrangement has failed.

The deck shows one slide at a time. Advance it yourself with `computer` by clicking the
button labelled **下一張** at the bottom right (`#next`); `←` / `→` also work if the deck
has focus. When to advance is your read of the conversation, not a script.

For each `<section data-slide>`:

1. Say what the slide establishes, **in your own words**. Do not read the prose — what is
   on screen is deliberately short, and repeating it out loud wastes the only channel you
   have.
2. `<aside data-narration>` is written for you and is hidden from the screen. It carries
   the emphasis and, more usefully, the parts the author was unsure about. Use it; **never
   read it out** — he would hear you narrating your own stage directions.
3. If the slide has a mockup, describe what he is looking at before discussing it. He may
   be walking.
4. If the slide carries an open decision, **stop and settle it.** Do not advance past an
   open decision — one skipped in the room comes back as a blocked issue days later.
5. When he wants something changed, make the change, let the deck reload itself, and say
   in one sentence what he is now looking at — he needs to know the thing on screen is the
   thing he asked for.

Do not tell him to refresh. The deck watches its own file and reloads on the slide he is
already on; saying "reload to see it" means the reload is broken and you should say *that*
instead.

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

## The mockups

Mockups here are **generated images**, not hand-authored markup. For anything beyond a
single component that is the right call — a picture carries a whole screen faster than
markup does, and leaves room to react to rather than parse.

It also means **the editable surface is the prompt, not the pixels.** When he asks for a
change, edit the `<pre>` inside `data-prompt`, bump the version in the `<summary>`, and
regenerate with `image_gen`. Save to the path the placeholder names, swap the placeholder
`div` for an `<img>`, and say in one sentence what you changed in the prompt — he needs to
know whether the picture he is now looking at is the change he asked for.

Never hand-edit a generated image's surrounding markup to fake a change the image does not
show. A mockup that disagrees with itself is worse than no mockup.

### The two lists beside each image are the point

A generated image contains a thousand decisions nobody made — an exact shade, a corner
radius, a typeface that does not exist in the product. Claude implements from this file. If
the image is the spec, it will chase pixels that were never decided; if the image is
ignored, the design was pointless.

So every mockup carries both:

- `data-normative` — what must be true in the implementation. Hierarchy, what is visible
  without scrolling, what the primary action is. Statements about **behaviour and
  priority**, never about appearance.
- `data-incidental` — what comes from Lume tokens instead of from the picture.

When a discussion changes what the image shows, ask yourself which list moved. Often the
answer is neither — he reacted to something incidental, and the right response is to say
so rather than to promote his taste into a requirement. Sometimes the answer is that a new
normative line exists, and **that line is the actual output of the conversation** — more so
than the regenerated picture.

## The changelog is not a closing step

`<ol data-log>` is **append-only**. Add an entry at the moment of each change, not at the
end — a session that ends abruptly should still have recorded everything up to that point.

Each entry: date, what changed, and **why**. The why is the entire value; the current state
is already visible in the file.

Never edit or remove an existing entry, including your own from earlier in the session. If
a decision is reversed, that is a new entry saying so.

## Before you finish

Check all five, and say the result out loud even when everything passes:

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
4. **Every regenerated image has its prompt version bumped**, and the file on disk matches
   the prompt beside it. An image whose prompt no longer produces it cannot be revised by
   the next person.
5. **The changelog covers every change.** Compare against the diff, not your memory.

Then commit — `docs(spec): R-xxx …` — and tell him the branch. If `multica` is on PATH and
authenticated, post the file back to the issue and set the node's exit; if it is not, say so
plainly and tell him the one command he needs. **Do not end by describing a handoff you did
not perform.** Saying who should act next is not the same as making it happen, and the
difference is invisible from his side until nothing moves.

## What not to do

- Do not read the file aloud, and do not read the narration aloud. Talk about the slide.
- Do not tell him to refresh, scroll, or click anything. If you catch yourself about to,
  something in the setup is broken — say what.
- Do not batch edits to the end. A dropped connection then loses the entire session.
- Do not resolve a decision he did not actually settle. "Sounds fine" is not a decision;
  ask again.
- Do not add scope. A design review that grows the feature has failed at its job.
