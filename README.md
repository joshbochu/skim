# skim

> read down, not across

Output shaped for the eye, not the tokenizer.

Skim is a skill for Claude Code, Cursor, Pi, and any agent that reads a `SKILL.md`. It rewires how your agent answers: one plain headline, then vertical, symbol-dense blocks — one fact per line, indentation as hierarchy, logic symbols instead of connective prose, and never more than 3–5 items in a group, because that is all a human working memory holds.

Not fewer tokens. Fewer eye movements.

## Before / after

**Normal agent:**

> I've updated the authentication flow. I modified three files: auth.ts to add token refresh, session.ts to extend expiry handling, and api.ts to retry on 401. All 42 tests pass. Note that I didn't touch the mobile client, which may need the same fix.

**Skim:**

Auth flow updated — token refresh added.

```
✓ auth flow updated
  auth.ts
    + refresh logic
  session.ts
    Δ expiry handling
  api.ts
    + retry on 401

✓ tests 42/42
⚠ mobile client
  untouched
  → may need same fix
```

Same information. Your eye makes one fixation per fact, travels one direction, and the left edge tells you which lines you can skip.

## Not caveman

[caveman](https://github.com/juliusbrussee/caveman) shrinks what the agent *says* — output tokens down 65%. Skim shapes what remains for the human *reading* it. Different objective function:

|  | caveman | skim |
|---|---|---|
| optimizes | output tokens | scanning speed |
| unit of design | the token | the line |
| symbols & arrows | banned — zero token savings | core vocabulary — the eye reads shape faster than words |
| layout | horizontal fragments | vertical, indented |
| structure | decorative, dropped | the whole point |

Both keep code, commands, and error strings byte-exact. Use caveman when the bill hurts. Use skim when your eyes do. They compose: caveman decides how little to say, skim decides what shape it lands in.

## The rules

```
shape
  headline ≤2 plain sentences
  body = fenced single-column blocks
  one fact per line
  indent ⇒ belongs to line above

telegraphy
  drop articles · copulas · pronouns · filler
  verb-first | noun-stack
  numerals not number-words
  never abbreviate
    cfg | req | fn ⇒ decode cost on reader

scanning
  left edge carries the signal
  symbol | keyword first
  detail after
  line wraps ⇒ split it

memory
  ≤5 lines per group
  >5 siblings ⇒ regroup under sub-anchors
  ≤3 indent levels

untouchable
  code · commands · errors — byte-exact
  commits · PRs · docs — normal prose

limits
  floor
    <3 facts ⇒ plain sentence · no machinery
  ceiling
    reader pauses to decode ⇒ went too far
```

## Symbol vocabulary

| sym | meaning | sym | meaning |
|-----|---------|-----|---------|
| `→` | leads to, then | `✓` | done, pass |
| `⇒` | implies, rule | `✗` | fail, missing |
| `∵` | because | `⚠` | caution, risk |
| `∴` | therefore | `Δ` | changed |
| `+` `−` | added / removed | `?` | open question |
| `↑` `↓` | increase / decrease | `∅` | none |
| `≈` `<` `>` `≠` | comparisons | `×N` | count |
| `·` | separator | `\|` | or |

No legend needed at read time — nothing here is exotic past a math class. The skill forbids inventing new ones.

### Emoji mode (opt-in)

`/skim emoji` swaps left-edge status sigils for colored emoji — `✅` `❌` `⚠️`, and `🔴` `🟡` `🟢` for severity. Color is preattentive: your eye sorts red from green before it reads a single word. In-line logic symbols stay text. `/skim text` reverts. Default is text — terminals render it everywhere.

```
🔴 sql injection in /search
  ∵ raw string concat
🟡 pool=5 < load≈40
  → raise
🟢 tests 42/42
```

## Why it works

```
3–5 chunk cap
  working memory holds ~4 items (Cowan, 2001)
  6+ item lists get re-read, not read

one fact per line
  one fixation per fact
  vertical saccades ⇒ no line-wrap regression

left-edge signal
  readers scan in an F-pattern (Nielsen)
  first token decides skip | read

symbols over connectives
  shape recognition beats word decoding
  "∵" lands before "because of the fact that"
```

## Install

**Skills registry (Cursor, Claude Code, Cline, 40+ agents):**

```bash
npx skills add joshbochu/skim
```

**Manual — Cursor:**

```bash
git clone https://github.com/joshbochu/skim ~/dev/skim
ln -s ~/dev/skim/skills/skim ~/.cursor/skills/skim
```

**Manual — Claude Code:**

```bash
ln -s ~/dev/skim/skills/skim ~/.claude/skills/skim
```

**Pi:** works with any extension that toggles skills as config — `/skim on` persists across sessions until `/skim off`.

## Toggle

```
/skim on      activate · persists all session
/skim off     back to normal prose
/skim emoji   colored status anchors
/skim text    terminal-safe sigils (default)
```

## Escape hatch

Skim drops to full sentences — on its own — for security warnings, irreversible-action confirmations, and anywhere compression would make step order ambiguous. Dense is the default; unambiguous is the law.

## License

MIT
