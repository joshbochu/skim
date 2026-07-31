# Skim for PR bodies

Overrides the default PR boundary for the one-shot command. Applies
terse, structure-first shape to the selected pull request description.

Chat replies stay under `skim-core`. This rule governs PR text only.

## Command

`/skim pr` is a one-shot write action. It has no persistent state and
does not affect later agent turns.

- `/skim pr <github-pr-url>` — reshape and update that pull request's
  description.
- `/skim pr` — resolve the pull request for the current Git branch,
  then reshape and update its description.

The explicit command invocation authorizes one body-only update to the
resolved pull request. It never authorizes other repository changes.

For either command:

- Fetch the body using whatever GitHub tool the agent has available
  (`gh`, REST API, MCP). The rule does not prescribe a mechanism.
- When no URL is supplied, resolve the current Git repository and branch,
  then find its open pull request.
- No matching pull request: ask the user for a full GitHub PR URL.
- Multiple matching pull requests: list them and require an explicit URL.
- No tool available or fetch fails: report the failure. Do not guess.
- Ignore repository PR templates. Do not read, preserve, fill, or
  mimic `.github/pull_request_template.md` (or any variant). The goal
  of `/skim pr` is skim shape, not repo-template compliance.
- Write the reshaped body through the available GitHub write path
  (`gh pr edit --body`, REST PATCH, MCP equivalent).
- Print the applied body and PR link as confirmation.
- On write failure: print the reshaped body, note the failure, do not
  retry silently.
- Skip the write when the reshape produces an empty body or drops
  content the agent cannot account for.
- No-op when the existing body already matches the reshaped body.
- Never merge, never bypass branch protection, never touch anything
  beyond the PR body.
- Reshape body only. Leave the PR title alone; titles are already one
  line and rarely need it.

## Priority

1. Factual correctness and safety.
2. skim-pr structure below (anchor + indented-fact shape).
3. Terse wording inside facts — drop articles, copulas, filler, but
   keep enough grammar that a cold reviewer can parse each fact
   without session context.
4. Symbols when immediately clear.

Repo PR templates never outrank skim-pr. Facts drop load-free words but
must stand alone for a cold reviewer. Headline prose stays normal
English.

## Sections

Always use these sections. Never substitute a repository template's
headings, checklists, or HTML comments.

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

When the existing body was filled from a repo template, extract the
facts and rewrite them into the sections above. Drop template
scaffolding: unused headings, HTML comments, placeholder checklists,
and custom markers that only exist for the template.

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
two spaces below. Applies inside every `##` section.

- **Anchor** — 1–4 words. Optional leading sigil (`✓ ⚠ ✗`). Bolded.
  Names the thing (component, behavior, concern).
- **Facts** — indented 2 spaces below the anchor. One fact per line.
  Terse but self-contained: drop articles, copulas, and filler, but
  keep enough grammar for a cold reviewer to parse without session
  context. Two specific failure modes to avoid:
    - **Missing subject or object**: "returns early on error" (returns
      from where? which error?), "hook fires on save" (which hook?).
      Add the missing piece: "the request handler returns early on
      validation failure"; "the `beforeSave` hook runs on every write".
    - **Compressing into coined noun-phrases**: "the sync layer glitch",
      "signal poisoning" — packing an observation into a term you
      coined during your investigation forces reviewers to guess the
      definition. Spell out the observation itself: "connection reset
      events arrive out of order"; "concurrent writes silently
      overwrite each other".
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
- Repository PR template scaffolding: unused template headings, HTML
  comments, placeholder examples, or custom markers kept only to
  match a template.

## Preserve

- Code, commands, URLs, identifiers, error strings — byte-exact.
- Ticket keys, issue references, PR numbers.
- User language.
- Meaningful checklist items that already record real verification
  status — rewrite them under `## Test plan` if kept.

## Gold example

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

## Why

- expired tokens failed every outbound request
- callers should not handle refresh themselves

## Test plan

- [ ] Force a 401 in dev — retry fires exactly once
- [ ] Repeated 401s don't produce an infinite loop

Closes #1234
```

## Final check

Before emitting a PR body:

- skim-pr sections used (`## What`, `## Why`, optional `## Test plan`)?
- Repo PR template ignored — no template-only scaffolding kept?
- Headline prose leads with outcome, not ceremony?
- Sections use anchor + indented-fact structure, not flat prose?
- Facts are terse but self-contained for a cold reviewer?
- Never-emit list swept?
- No model attribution trailer in the body?
- Ticket link or `Closes #N` present when applicable?
