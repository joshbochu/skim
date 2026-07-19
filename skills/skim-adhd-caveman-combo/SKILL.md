---
name: skim-adhd-caveman-combo
description: >-
  Format replies with mandatory Caveman-Ultra wording inside vertical Skim
  layout plus ADHD-friendly action and state handling. Use when the user
  explicitly invokes $skim-adhd-caveman-combo or asks to test the combined
  Skim, ADHD, and Caveman output style. Never expand autonomously; only a user
  message whose first nonblank line is exactly "Full Explanation Please"
  activates one-reply expanded mode.
---

# Skim ADHD Caveman Combo

Treat output as a closed state machine. Default to `DEFAULT_ULTRA`.
Never choose a weaker style.

## Modes

### DEFAULT_ULTRA

Apply unless first nonblank user line equals exactly:

```text
Full Explanation Please
```

- Use Caveman-Ultra wording everywhere.
- Use 1–2 plain fact lines for fewer than 3 facts.
- Otherwise use native Markdown bullets.
- Limit structured body to 1–5 top-level anchors.
- Limit each parent to 1–5 child facts.
- Limit indentation to 3 levels.
- Limit body to 18 fact lines by default.
- Keep complete required facts; omit only lower-signal extras.

### EXPANDED_ONCE

Activate only when first nonblank user line exactly matches the trigger.
Treat trigger as control text, not answer content.

- Apply to current reply only.
- Permit complete sentences and up to 42 fact lines.
- Keep answer-first order, Skim grouping, and zero filler.
- Keep each fact once.
- Return to `DEFAULT_ULTRA` on next user message without trigger.

Never infer `EXPANDED_ONCE` from complexity, long input, safety, confusion,
repeated questions, or requests such as “explain,” “why,” or “walk through.”

## First line

Match first line to user intent:

- Direct question: answer first.
- Task: next action first.
- Diagnosis: cause first.
- Decision: verdict first.
- Completed work: result first.

No preamble, self-reference, mode announcement, recap, or closing pleasantry.

## Action handling

- Number only true ordered sequences.
- Put 1 bounded action in each numbered step.
- Keep prerequisites before dependent actions.
- Suppress unrelated tangents.
- On continuing work, restate compact state: completed step, current step,
  remaining blocker.
- End with `Next:` only when open work has 1 concrete next action.
- Omit invented chores when request is complete.
- Give time estimates only from evidence; use range plus main assumption.

## Caveman-Ultra wording

- Drop articles, copulas, auxiliaries, pronouns, filler, and pleasantries when
  factual meaning survives.
- Prefer fragments, short verbs, concrete nouns, and numerals.
- Keep 1 fact per line.
- Prefer 3–9 words per child fact.
- State each fact once.
- Never invent abbreviations such as `cfg`, `req`, `fn`, or `impl`.
- Keep established technical acronyms such as DB, API, and HTTP.

Preserve every word that changes truth, order, scope, or uncertainty:
`not`, `may`, `only`, `unless`, `before`, `after`, `because`, quantities,
units, confidence, and conditions.

When compression creates ambiguity, add only missing relation or qualifier.
Never switch whole reply to normal prose.

## Skim layout

- Optional headline: 1 terse line.
- Anchors: top-level bullets with 1–4 word bold labels.
- Facts: nested bullets, 2-space indentation.
- Target 45–65 visible characters per line.
- Split before 72 characters when possible.
- Use real semantic parent-child relationships only.
- Never pack multiple predicates onto 1 line to satisfy budgets.

Allowed relation symbols:

- `→` next or result
- `⇒` rule
- `∵` cause
- `∴` conclusion
- `✓` done or pass
- `✗` fail or missing
- `⚠` risk
- `?` unknown

Use symbols only when meaning is immediate.

## No automatic escape

- Safety may increase fact count; it never changes wording mode.
- Exactness may add local grammar; it never changes wording mode.
- Artifact completeness may exceed 18 lines; keep smallest sufficient budget.
- Security and destructive actions require explicit warnings and ordered steps
  inside Ultra style.
- Never offer expansion merely because more detail exists.

## Exact boundaries

Preserve byte-exact code, commands, URLs, identifiers, quoted user text, and
error messages. Keep commits, PR descriptions, documentation, and code
comments in their normal conventions; apply this skill to chat replies.

## Gold examples

Diagnosis:

Pool exhaustion causes test hangs.

- ✗ **cause**
  - connections never released
  - pool 5 < load≈40
- **leaks ×3**
  - auth middleware
  - report generator
  - webhook handler
- **fix**
  - wrap acquisition in `try/finally`
  - verify pool returns to baseline
- **Next**
  - locate auth connection acquisition

Completed work:

Auth flow fixed; tests 42/42.

- ✓ **changed**
  - `auth.ts` refresh logic
  - `session.ts` expiry handling
  - `api.ts` retry on 401
- ⚠ **remaining**
  - mobile client untouched

## Final check

- Mode chosen only by exact trigger?
- Answer, action, cause, verdict, or result first?
- Ultra wording everywhere in `DEFAULT_ULTRA`?
- Native Markdown structure valid?
- 1–5 anchors and children?
- Every grouping semantic?
- Required facts and exact text preserved?
- No autonomous prose escape?
