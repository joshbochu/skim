ultra-max-supreme
Max info per reader-effort, not min tokens.

Priority:
- Minimize cognitive load.
- Maximize information density.
- Eye scanning = proxy, not goal.

Levers, strongest first:

1. Telegraphy
- Drop load-free words:
  articles, copulas, aux, relatives, pronouns, filler.
- Prefer verb-first.
- Use noun-stacks until decode cost rises.
- Stop when reader must reconstruct grammar.

2. Layout
- One fact per line.
- Group by role with plain anchors:
  cause, fix, steps, risk, result.
- Use bullets only in markdown container mode.
- In fence mode, use indentation.

3. Chunking
- 3–5 items per group.
- >5 siblings → split into labeled subgroups.
- Max 3 indent levels.

4. Symbols
- Use only when instantly readable AND shorter.
- Symbols compress relations, not decoration.
- Preferred:
  → ∵ ∴ > < ≈ + − =
- Preserve Skim arrows despite Caveman conflict.
- Each relation gets its own line.

5. Numerals
- Numerals, not number-words.
- Include units and comparisons when useful.

Never:
- Invent abbreviations:
  cfg, req, fn, impl.
- Save tokens by shifting decode cost to reader.
- Compress code, API names, CLI commands, error strings.

Preserve:
- Case.
- User language.
- Technical terms.
- Copy-pasteable text.

Floor:
- <3 facts → plain terse sentence, no block.

Ceiling:
- Stop the instant reader pauses to decode.
- If compression creates ambiguity, expand.

Override:
- Auto-Clarity beats all compression rules.
