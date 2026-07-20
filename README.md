# skim

> Your agent wrote 11 paragraphs. You needed 6 facts.

Skim is output discipline for coding agents.

It turns the usual foam into compact, vertical answers: one fact per line,
useful symbols, shallow nesting, no warm-up paragraph, no tiny management
consultant living in your terminal.

```text
before
  "I've updated the authentication flow..."
  1 paragraph
  3 files hiding inside it
  warning bolted onto the end

after
  facts visible at left edge
  files grouped by job
  warning impossible to miss
```

Skim works anywhere that can load a `SKILL.md`, including Claude Code,
Cursor, Pi, and compatible agent runners.

## See it

Normal output:

> I've updated the authentication flow. I modified three files: auth.ts to
> add token refresh, session.ts to extend expiry handling, and api.ts to retry
> on 401. All 42 tests pass. I didn't touch the mobile client, which may need
> the same fix.

Skim output:

```text
Auth flow updated.

✓ changes
  auth.ts refresh logic
  session.ts expiry handling
  api.ts retry on 401

✓ verification
  tests 42/42

⚠ remaining
  mobile client untouched
```

Same payload. Less archaeology.

## Install

Pi installs the complete extension and both profiles from npm:

```bash
pi install npm:@joshbochu/skim
```

Portable skill-only install for compatible runners:

```bash
npx skills add joshbochu/skim
```

Manual install for Cursor:

```bash
git clone https://github.com/joshbochu/skim ~/dev/skim
ln -s ~/dev/skim/skills/skim ~/.cursor/skills/skim
```

Manual install for Claude Code:

```bash
ln -s ~/dev/skim/skills/skim ~/.claude/skills/skim
```

Pi loads the extension from the npm package. Its selected mode persists between
sessions and its packaged rules reload on every turn.

## Use

Use the Pi commands:

```text
/skim on        stable profile · activate and persist
/skim on v2     skim-v2 profile · replace stable and persist
/skim off       disable either profile
/skim capture   save last exchange for review
```

Stable and v2 are mutually exclusive. Running `/skim on` while v2 is active
switches back to stable; running `/skim on v2` while stable is active switches
to v2. The status changes from `ON` to `V2`.

Capture accepts a note:

```bash
/skim capture too much normal prose
```

Captures stay local in `~/.pi/agent/skim/captures/`. They may contain prompts,
responses, code, or other sensitive material. Inspect them before sharing.

### Skim v2

Stable `skim` and `/skim on` behavior remain unchanged.
Pi users activate v2 through the persistent npm extension:

```text
/skim on v2
```

Portable skill runners can invoke `$skim-v2` directly.

Overwrite `skills/skim-v2/` during iteration. Promote reviewed rules
to stable `skills/skim/` only after evaluation and user approval.

## The contract

Skim does not ask the agent to "be concise" and hope for the best. It gives
the output a grammar.

```text
shape
  0-1 terse headline
  1 fact per line
  structured body: 1-5 top-level anchors
  1-5 child facts per anchor
  3 indent levels maximum

wording
  concrete noun stacks
  fragments when meaning survives
  numerals instead of number words
  no invented abbreviations

line budget
  18 default · 24 detail/safety · 42 artifact
  45-65 visible characters preferred
  split before 72 when possible
  code and errors remain exact

escape hatch
  fewer than 3 facts
  use 1-2 plain fact lines
  put the machinery away
```

Hard boundary: code, commands, URLs, identifiers, quoted text, and error
messages stay byte-exact. Compression never gets to "fix" the evidence.

Commits, pull requests, documentation, and code comments keep normal prose.
Skim is a reply format, not permission to write cursed release notes.

## Small symbol cult

The vocabulary is deliberately boring. If a symbol needs a decoder ring, it
does not belong here.

| Symbol | Meaning | Symbol | Meaning |
|---|---|---|---|
| `→` | next, result | `✓` | done, pass |
| `⇒` | rule, implication | `✗` | fail, missing |
| `∵` | cause | `⚠` | caution, risk |
| `∴` | conclusion | `Δ` | changed |
| `?` | unknown | `≈` `<` `>` `≠` | comparison |
| `·` | shared predicate | `\|` | choice |

Relations get their own lines. Horizontal symbol soup is still soup.

```text
bad
  leak → pool fills → tests fail

good
  tests fail
    ∵ pool exhausted
    ∵ connections leaked
```

## Caveman ancestry

[caveman](https://github.com/juliusbrussee/caveman) attacks output-token
count. Skim borrows its telegraphic wording, then aims at a different bill:
reader attention.

| | caveman | skim |
|---|---|---|
| optimizes | output tokens | reader effort |
| design unit | token | fact line |
| layout | mostly horizontal | vertical and grouped |
| symbols | usually avoided | used when immediately clear |

Use Caveman when the token bill hurts. Use Skim when the scrollback hurts.

## Repository anatomy

```text
skills/skim/SKILL.md       stable portable skill contract
skills/skim-v2/            v2 portable and Pi profile contract
extensions/skim.ts         exclusive stable/v2 toggle and persistence
rules/                     stable live-reloaded Pi rules
evals/cases.json           stable behavior corpus
evals/compare-cases.json   balanced stable/v2 A/B corpus
evals/compare.mjs          matched skill comparison
evals/skim-v2-cases.json   v2 behavior corpus
evals/gold/                hand-approved outputs
evals/lint.mjs             deterministic structure checks
```

The skill is the product. The Pi extension is the switchboard. The evals keep
prompt edits from quietly turning "dense" back into "sounds professional."

## Hack on it

```bash
npm test
npm run eval:lint
npm run eval:dry
npm run eval -- --label baseline
npm run eval:skim-v2:dry
npm run eval:skim-v2 -- --label candidate
npm run eval:compare:dry
npm run eval:compare:smoke
```

`eval:lint` checks the gold corpus without calling a model. `eval:dry` shows
the planned benchmark. The full eval stores raw outputs, exact prompts, stderr,
and summaries under `evals/results/`.
The comparison runner also records exact token/cost/timing data, blind semantic
grades, a Markdown report, and a side-by-side feedback reviewer.

See [`evals/README.md`](evals/README.md) for the benchmark loop and
[`IMPROVING.md`](IMPROVING.md) for the backlog.

## npm releases

The package version is the release switch. A merge to `main` runs tests,
checks the packed npm contents, and publishes that version through npm trusted
publishing. Every publishable merge must increase `package.json`'s version.

See [`RELEASING.md`](RELEASING.md) for the one-time npm trusted-publisher setup
and merge behavior.

## Why these numbers

The 3-5 item groups and short lines are engineering defaults, not scripture.
They are informed by working-memory research, readable line-length guidance,
and left-edge scanning behavior. More importantly, they are executable rules
that can be tested instead of an adjective like "concise."

When a rule makes an answer harder to decode, meaning wins.

## License

MIT
