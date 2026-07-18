# Skim for PR bodies

Overrides the default PR boundary. Applies terse, structure-first shape
to pull request descriptions the agent generates or reshapes.

Chat replies stay under `skim-core`. This rule governs PR text only.

## Activation

State is tri-valued: `off` → `preview` → `auto`. Only one is active at
a time.

- `/skim pr off` — disabled. PR text follows normal conventions.
  Initial default.
- `/skim pr preview` — enabled. Every PR body the agent generates or
  reshapes follows this rule; the result is printed to the user and
  never written back.
- `/skim pr auto` — enabled. Same shape rules as `preview`. For
  `/skim pr <pr-url>`, the agent also writes the reshaped body back to
  the PR via the available GitHub tool.
- `/skim pr <body>` — one-shot. Reshape the pasted draft. Output only;
  there is nothing to write.
- `/skim pr <pr-url>` — one-shot. Fetch the PR body from GitHub and
  reshape it. `preview` prints; `auto` writes. Accepts full URLs
  (`https://github.com/owner/repo/pull/N`), short refs
  (`owner/repo#N`), or bare `#N` when the working directory resolves to
  a matching repo.
- `/skim pr` — report current state.

Chat-skim state (`/skim on|off`) is independent.
skim-pr does not activate automatically; the user must opt in.

The agent auto-detects the one-shot input: URL- or ref-shaped arguments
are fetched; everything else is treated as a pasted body.

## Persistence

Mode state is scoped by the agent runner. "Persistent" survives only as
long as the runner keeps state on disk.

- **pi** — persisted via `extensions/skim.ts` to
  `$PI_CODING_AGENT_DIR/skim.json` (default `~/.pi/agent/skim.json`).
  `/skim pr preview` and `/skim pr auto` survive shell restarts.
  Delete the file to reset.
- **Other runners** (Claude Code, Cursor, etc.) — no bundled
  extension. State is session-scoped. Put `/skim pr preview` or
  `/skim pr auto` in your runner's startup rules or dotfiles for
  always-on.

Config shape (pi):

- `defaultMode` — chat-skim state (`on` | `off`).
- `prState` — PR body state (`off` | `preview` | `auto`).
- `rulesPath`, `ultraPath`, `prRulesPath` — optional rule-file
  overrides.

## PR link input

When the argument is a PR URL or ref:

- Fetch the body using whatever GitHub tool the agent has available
  (`gh`, REST API, MCP). The rule does not prescribe a mechanism.
- No tool available or fetch fails: prompt the user to paste the body
  instead. Do not guess.
- Resolve the repo's PR template from the current head or base state,
  not from the point-in-time template used when the PR was created.
  Reviewers expect the current shape.
- Output behavior depends on the current state:
  - `preview` — print the reshaped body to the user. Do not write
    until an explicit follow-up says to.
  - `auto` — write the reshaped body via the available GitHub write
    path (`gh pr edit --body`, REST PATCH, MCP equivalent). Print the
    applied body as confirmation.
- On write failure: print the reshaped body, note the failure, do not
  retry silently.
- Skip the write and fall back to preview when the reshape produces an
  empty body or drops content the agent cannot account for.
- Never merge, never bypass branch protection, never touch anything
  beyond the PR body — even under `auto`.
- Reshape body only. Leave the PR title alone; titles are already one
  line and rarely need it.

## Priority

1. Factual correctness and safety.
2. Repository PR template conventions.
3. skim-pr structure below (anchor + indented-fact shape).
4. Terse wording inside facts — drop articles, copulas, filler, but
   keep enough grammar that a cold reviewer can parse each fact
   without session context.
5. Symbols when immediately clear.

Template obligations outrank skim-pr defaults.
Facts drop load-free words but must stand alone for a cold reviewer.
Headline prose stays normal English.

## Repository template

Before generating a body, check for a PR template in this order:

1. `.github/pull_request_template.md`
2. `.github/PULL_REQUEST_TEMPLATE.md`
3. `PULL_REQUEST_TEMPLATE.md`
4. `docs/pull_request_template.md`
5. `.github/PULL_REQUEST_TEMPLATE/*.md` — multi-template directory

Case-insensitive match. First hit wins.

When a template exists:

- Preserve heading structure and order verbatim.
- Preserve `<!-- HTML comments -->` untouched. They do not render.
- Preserve `- [ ]` checklists as checklists. Check or leave unchecked;
  never convert to plain bullets.
- Preserve custom markers (`<!-- TYPE: feat -->`, front-matter) untouched.
- Fill each section with skim-pr bullets and terse content.
- Leave a section empty, or drop it per template convention, when the
  diff has nothing to say there. Never invent content to fill slots.
- Replace placeholder examples (`<!-- e.g. Closes #123 -->`) with real
  values. Never echo the placeholder.

When no template exists, use the default sections below.

## Default sections

Used only when no repo template exists.

- `## What` — bullets describing what changed in plain English.
  Describe the behavior change, not the files; the diff tab already
  lists every file.
- `## Why` — up to 3 bullets, causal only.
- Trailer — `Closes #N` or a linked ticket key, one line, no heading.

Add more only when the PR genuinely has more to say. Do not emit
empty scaffolding:

- `## Test plan` — manual verification steps CI can't cover. Skip
  entirely when CI already runs the same tests you would. Items are
  checkboxes; default to `- [ ]` (pending), since manual test-plan
  items are usually not done at PR open time. Flip to `- [x]` as you
  verify each one.
- Gotchas, follow-ups, and known limitations go inline under `## What`
  with a `⚠` prefix, next to the change they concern.

## Headline

One to three plain sentences at the top of the body, before any section.

- Lead with the outcome or the why, not "This PR...".
- Normal English prose. The terse-bullet rule does not apply here.
- Never restate the PR title verbatim.
- Do not restate the `## What` section. The headline is the elevator
  pitch (outcome + why); What is the concrete detail. If a reviewer
  reading the headline could skip What, the headline is too detailed.

## Anchor + fact grammar

Same shape as chat-skim: bold anchor at the top level, facts indented
two spaces below. Applies inside every `##` section (default or
template-provided).

- **Anchor** — 1–4 words. Optional leading sigil (`✓ ⚠ ✗`). Bolded.
  Names the thing (component, behavior, concern).
- **Facts** — indented 2 spaces below the anchor. One fact per line.
  Terse but self-contained: drop articles, copulas, and filler, but
  keep enough grammar for a cold reviewer to parse without session
  context. Two specific failure modes to avoid:
    - **Missing subject or object**: "toggles reshape" (toggles what?),
      "`off` disables" (`off` is a value, not an actor). Add the
      missing piece: "toggles PR-body reshape mode"; "`off` — mode
      disabled, PR bodies keep normal conventions".
    - **Compressing into coined noun-phrases**: "over-narration",
      "hydration drift" — packing a fact into your own invented
      term forces the reviewer to guess the definition. Spell it
      out: "narrating what the diff already shows".
  When a fact genuinely needs a full sentence to be clear, use one.
  Chat-skim can go extreme because the user shares your session;
  PR reviewers do not.
- Cap each section at 3 anchors. Cap facts at 5 per anchor. When you
  have more, first drop non-essential facts — internal refactor
  detail, persistence mechanics, and other things the diff already
  shows are the first cuts. Merge only when items are semantically the
  same ("same change in file A and file B"); never stitch distinct
  facts into one anchor to fit the cap.
- Max 3 indent levels total (including the `##` heading).
- Plain English at fact level. Standard technical terms (401, retry,
  GraphQL) are fine. Never reference things that exist only in your
  context: coined project shorthand ("the refunds bot"), internal
  metaphors ("hydration drift"), or design alternatives that were
  considered and discarded during development. Name the thing
  literally; never compare to a phantom baseline.
- Describe what changed, not which files. The diff tab already
  enumerates the files.
- Preserve identifiers, paths, and commands byte-exact when you
  genuinely need to mention them (invariants, gotchas, contract
  boundaries).
- Nest only when the child truly refines the parent.

## Symbols

Use the full chat-skim vocabulary (see `skim-core.md`). Symbols are
allowed anywhere inside sections — anchors, facts, checkbox notes.

- Preserve identifiers, paths, and commands byte-exact even when a
  symbol would compress them.
- Never invent new symbols. Never decorate.
- Use only where the meaning is instantly readable to a GitHub
  reviewer; when in doubt, use the word.

## Fenced blocks

Reserve fenced code blocks for actual code, commands, or diffs.
Do not fence the skim-pr structure itself; use native Markdown bullets.

## Never emit

These never appear in the output:

- "This PR introduces…", "I've made the following changes…", any
  ceremonial opener.
- "Please review", "Feel free to reach out", any ceremonial closer.
- Restated commit messages when the diff view already shows them.
- Narration of file paths already visible in the diff summary.
- Restating what CI already reports. If CI runs the test suite,
  the green check is authoritative; do not write `pnpm test — 42/42`
  or equivalent in the body.
- Model attribution trailers such as `🤖 Generated with …` and
  `Co-Authored-By: Claude`.
- Bot or reviewer `@`-mentions.

## Preserve

- Code, commands, URLs, identifiers, error strings — byte-exact.
- Ticket keys, issue references, PR numbers.
- User language.
- Checklist item text from templates.

## Gold examples

Template-driven (`.github/pull_request_template.md` present).

Template:

```markdown
## Summary

<!-- What does this PR do? -->

## Testing

- [ ] Unit tests
- [ ] Manual QA

## Ticket

<!-- e.g. Closes #123 -->
```

Filled:

```markdown
401 retry lets the auth flow refresh expired tokens transparently.

## Summary

- ✓ **retry logic**
  - on a 401 response, silently refresh the token and retry once
  - callers never see the auth error
- ✓ **session expiry**
  - realigned to overlap the refresh-token lifetime
- ✓ **retry wrapper**
  - all outbound requests routed through a single decorator

## Testing

- [x] Unit tests
- [ ] Manual QA
  - force a 401 in dev — retry should fire exactly once
  - mobile client untouched, may need same fix

## Ticket

Closes #1234
```

No template — default sections:

```markdown
401 retry lets the auth flow refresh expired tokens transparently.

## What

- ✓ **retry logic**
  - on a 401 response, silently refresh the token and retry once
  - callers never see the auth error
- ✓ **session expiry**
  - realigned to overlap the refresh-token lifetime
- ⚠ **mobile client**
  - untouched by this change
  - → needs the same fix

## Test plan

- [ ] Force a 401 in dev — retry fires exactly once
- [ ] Repeated 401s don't produce an infinite loop

Closes #1234
```

## Final check

Before emitting a PR body:

- Template detected and preserved, or default sections chosen?
- Headline prose leads with outcome, not ceremony?
- Sections use anchor + indented-fact structure, not flat prose?
- Facts are terse but self-contained for a cold reviewer?
- Never-emit list swept?
- No model attribution trailer in the body?
- Ticket link or `Closes #N` present when applicable?
