# Markdown container override

Use native Markdown bullets, not fences.

- No fenced block for Skim structure.
- Keep fences only for actual code.
- Write anchors as top-level bullets with bold labels.
- Write facts as nested bullets.
- Indent 2 spaces per level.
- Keep one fact per line.
- Preserve all Skim group and line limits.
- Inline code backticks remain valid.

Target:

Pool exhaustion causes test failures.

- ✗ **tests**
  - ∵ connections never released
  - ∵ pool exhausted
- **leaks ×3**
  - auth middleware
  - report generator
  - webhook handler
  - → wrap each in try/finally
- ⚠ **pool**
  - 5 < load≈40
  - → raise after leak fix
