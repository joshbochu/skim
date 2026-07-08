# skim

> max info per reader-effort

Output shaped for density and low cognitive load, not token count.

Skim is a skill for Claude Code, Cursor, Pi, and any agent
that reads a `SKILL.md`.

It rewires how your agent answers: ultra-compressed wording,
one plain headline, then vertical, symbol-dense blocks — one fact
per line, indentation as hierarchy, logic symbols instead of
connective prose, and never more than 3–5 items in a group.

That is about all a human working memory can hold.

Not fewer tokens. Lower reader effort.

## Before / after

**Normal agent:**

> I've updated the authentication flow. I modified three files:
> auth.ts to add token refresh, session.ts to extend expiry handling,
> and api.ts to retry on 401. All 42 tests pass. Note that I didn't
> touch the mobile client, which may need the same fix.

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

Same information. Lower working-memory load, fewer rereads,
and enough left-edge signal to skip what you do not need.

## Caveman lineage

[caveman](https://github.com/juliusbrussee/caveman) shrinks
what the agent *says* — output tokens down 65%.

Skim uses that lineage, but optimizes reader effort instead.
Different objective function:

|  | caveman | skim |
|---|---|---|
| optimizes | output tokens | reader effort |
| primary cost | model output | human cognition |
| unit of design | token | fact line |
| symbols & arrows | usually banned | allowed when load drops |
| layout | mostly horizontal | vertical, grouped |

Both keep code, commands, and error strings byte-exact.
Use caveman when the bill hurts.
Use skim when your brain does.

Skim vendors the upstream Caveman skill as reference material,
then uses `ultra-max-supreme` as its native compression layer.

## The rules

```
objective
  max info per reader-effort
  minimize cognitive load
  eye scanning = proxy, not goal

ultra-max-supreme
  drop load-free words
  verb-first | noun-stack
  stop before decode pause
  never abbreviate

shape
  headline ≤2 plain sentences
  body = fenced single-column blocks
  one fact per line
  indent ⇒ belongs to line above

telegraphy
  numerals not number-words
  code/API/CLI/errors verbatim

scanning
  left edge carries the signal
  symbol | keyword first
  detail after
  line wraps ⇒ split it

line budget
  target 45–65 visible chars
  split before 72 when possible
  80 = hard ceiling
  CJK target ≈40 glyphs
  code · commands · errors stay byte-exact

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

No legend needed at read time — nothing here is exotic past a
math class. The skill forbids inventing new ones.

### Emoji setting

`/skim emoji on|off` sets left-edge status sigils explicitly.
When on, text sigils become colored emoji:
`✅` `❌` `⚠️`, and `🔴` `🟡` `🟢` for severity.

Color is preattentive: your eye sorts red from green before it
reads a single word. In-line logic symbols stay text.
`/skim text` = `/skim emoji off`.
Default is text — terminals render it everywhere.

```
🔴 sql injection in /search
  ∵ raw string concat
🟡 pool=5 < load≈40
  → raise
🟢 tests 42/42
```

## Why it works

```
objective
  density ↑
  working-memory load ↓
  eye scanning = proxy metric

3–5 chunk cap
  working memory holds ~4 items (Cowan, 2001)
  6+ item lists get re-read, not read

one fact per line
  one fixation per fact
  vertical saccades ⇒ no line-wrap regression

45–65 char line target
  line starts arrive often enough to refocus
  72+ chars ⇒ split before wrap
  80 chars = WCAG text-width ceiling

left-edge signal
  readers scan in an F-pattern (Nielsen)
  first token supports skip | read

symbols over connectives
  visible relation beats connective prose
  "∵" lands before "because of the fact that"
```

## Research hooks

- Cowan argues for a working-memory capacity closer to 4 chunks
  than Miller's older 7±2 heuristic.
- W3C WCAG 1.4.8 caps blocks of text at 80 characters, 40 for CJK.
- Baymard's UX research points to roughly 50–75 characters for
  readable body text.
- NN/g eye-tracking research supports strong left-edge signals for
  scanning behavior.

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

**Pi:** works with any extension that toggles skills as config.
`/skim on` persists across sessions until `/skim off`.

## Toggle

```
/skim on        activate · persists across sessions
/skim off       back to normal prose
/skim emoji on  force colored status anchors
/skim emoji off terminal-safe sigils
/skim text      alias for /skim emoji off
/skim fence on  verbatim fenced blocks
/skim fence off native markdown bullets
```

## Escape hatch

Skim drops to full sentences — on its own — for security warnings,
irreversible-action confirmations, and anywhere compression would
make step order ambiguous.

Dense is the default; unambiguous is the law.

## License

MIT
