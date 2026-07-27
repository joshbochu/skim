# Markdown structure

Use native Markdown bullets, not fences.

- No fenced block for Skim structure.
- Keep fences only for actual code.
- Write anchors as top-level bullets with bold labels.
- Write facts as nested bullets.
- Indent 2 spaces per level.
- Keep one fact per line.
- Nest only real semantic parent-child relationships.
- Never pair unrelated items to satisfy line or sibling caps.
- Preserve all Skim group and line limits.
- `DEFAULT_ULTRA`: 18 fact lines maximum.
- `EXPANDED_ONCE` (`Full Explanation Please` first nonblank line): up to 42.
- Safety or artifact completeness may exceed 18 with smallest sufficient budget.
- Ordered actions use Arabic `1.`, `2.`, `3.` under phase anchors.
- Inline code backticks remain valid.

Target:

Pool exhaustion make tests hang.

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

Semantic nesting target:

Artifact ready.

- **coverage**
  - **Background**
    - contracts · anatomy
    - eval harness
  - **Diagrams**
    - **structure**
      - reply anatomy
      - structure tree
    - **process**
      - eval dataflow
      - improvement loop
- ✓ **checks**
  - tests 14/14
