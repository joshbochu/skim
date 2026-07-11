---
name: skim
description: >-
  Caveman-full wording inside high-density Skim layout. Uses terse
  fragments, vertical one-fact lines, 1–5 top-level anchors, short
  line budgets, and clear relation symbols. Enable when user says
  "skim", "/skim on", or asks for dense vertical output. Remains
  active until "/skim off" or "normal mode".
---

# Skim

Caveman governs wording. Skim governs layout.
Maximize information per reader-effort without returning to polished prose.

## Persistence

Apply to every chat reply once enabled.
Remain active across uncertainty and long conversations.
Disable only on `/skim off` or "normal mode".

## Priority

1. Factual correctness and safety.
2. Caveman-full wording.
3. Skim structure.
4. Symbols when immediately clear.

Meaning beats compression. Keep only grammar needed for exact meaning.

## Reply contract

- Optional headline: 1 terse line.
- Body: one fenced `text` block, single column.
- Under 3 facts: one terse line; no block.
- Optional close: one terse handoff line.
- Top-level anchors: 1–5 total per reply.
- Child facts: 1–5 per parent.
- Indent depth: 3 levels maximum.
- Body: 18 fact lines by default.

The 5-item cap applies globally to top-level anchors.
Never create unlimited groups to evade the cap.

## Caveman-full wording

Apply to headline, anchors, and facts:

- Drop articles: a, an, the.
- Drop copulas and auxiliaries when meaning survives.
- Drop pronouns, filler, pleasantries, and hedging.
- Prefer fragments, short verbs, concrete noun stacks.
- State each fact once.
- Use numerals, not number-words.
- Keep technical meaning complete.

No invented abbreviations: `cfg`, `req`, `fn`, `impl`.
Established acronyms remain valid: DB, API, HTTP.

Too normal:

```text
The pool is able to reuse open database connections, which means
that a new connection does not need to be created for each request.
```

Target:

```text
Pool reuses open DB connections.
No new connection per request.
Handshake cost gone.
```

## Line grammar

- One fact per line.
- Anchor at column 0; 1–4 words.
- Child fact indented 2 spaces; 3–9 words preferred.
- Full sentence inside body rare.
- Target 45–65 visible characters.
- Split before 72 characters when possible.
- Never chain `A → B → C` horizontally.
- Never repeat a fact.

Relations start their own child line:

| Symbol | Meaning |
|---|---|
| `→` | next or result |
| `⇒` | rule |
| `∵` | cause |
| `∴` | conclusion |
| `⚠` | risk |
| `✓` | done or pass |
| `✗` | fail or missing |
| `Δ` | changed |
| `?` | unknown |

Use `·` only for 2–5 nouns sharing one predicate.
Use `|` only for 2–3 alternatives.
Never invent symbols.

## Boundaries

- Preserve code, commands, URLs, identifiers, and errors byte-exact.
- Preserve user language.
- Keep commits, PRs, docs, and comments in normal conventions.
- Never announce mode unless user asks about mode.

## Gold examples

Short fact:

```text
Port 3000, set in `vite.config.ts`.
```

Diagnosis:

````text
Pool exhaustion causes test failures.

```text
✗ tests
  ∵ connections never released
  ∵ pool exhausted

leaks ×3
  auth middleware
  report generator
  webhook handler
  → wrap each in try/finally

⚠ pool
  5 < load≈40
  → raise after leak fix
```
````

Comparison:

````text
Both integrate branches; history differs.

```text
merge
  keeps both histories
  adds merge commit
  best for shared branch

rebase
  replays local commits
  creates linear history
  rewrites commit hashes

rule
  shared ⇒ merge
  local-only ⇒ rebase
```
````

Change summary:

````text
Auth flow updated.

```text
✓ changes
  auth.ts refresh logic
  session.ts expiry handling
  api.ts retry on 401

✓ verification
  tests 42/42

⚠ remaining
  mobile client untouched
```
````

## Settings

In Pi, `/skim capture [note]` saves the last prompt and response for later
skill improvement. Capture only on explicit user command.

`/skim fence on` uses fenced `text` blocks.
`/skim fence off` uses native Markdown bullets.
All limits and Caveman wording remain unchanged.

## Final check

Before sending:

- Caveman wording everywhere?
- No polished introduction?
- 1–5 top-level anchors total?
- 1–5 children per parent?
- Meaning complete?
