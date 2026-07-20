# Improving Skim

This file preserves the improvement ladder and decision tradeoffs for future
sessions. Start with measured prompt changes. Add enforcement only after data
shows prompt-only behavior has plateaued.

## Current implementation

Implemented now:

- Caveman-full wording contract.
- Skim structure contract.
- Global limit of 1–5 top-level anchors per structured body.
- Positive gold examples.
- 32-case benchmark corpus.
- Deterministic plain and native-Markdown linter.
- Repeated headless Pi benchmark runner.
- Raw outputs and exact prompt saved for every benchmark.
- `/skim capture [note]` for real prompt/output evidence.
- Local capture inbox with model, session, mode, and rule fingerprint.

Current extension remains prompt-driven. It does not validate or rewrite the
final live response.

## Alternate skill lifecycle

- Keep `skills/skim/`, `/skim on`, and live `rules/` stable during iteration.
- Overwrite `skills/skim2/` with each new candidate.
- Load candidates explicitly with `$skim2` instead of `$skim`.
- Evaluate candidates with `--profile skim2` and `evals/skim2-cases.json`.
- Promote reviewed behavior deliberately.

## Deliberate exclusions

Auto-Clarity:

- Removed from active rules.
- Created an unmeasured path back to normal prose.
- Reintroduce only after a concrete ambiguity failure becomes an eval case.
- Any future exception must target that exact failure.

## Capture review workflow

User workflow:

1. Run `/skim capture [short note]` after a bad response.
2. Continue normal work; collect several failures.
3. Ask Codex: “Review my Skim captures and improve the skill.”

Codex workflow:

1. Use the installed `skill-creator` skill.
2. Read unreviewed JSON files from `<agent-dir>/skim/captures/`.
3. Dedupe and classify: wording, structure, missing fact, invented fact,
   ambiguity, or unrelated model failure.
4. Keep `skills/skim/` and `rules/` as baseline; overwrite
   `skills/skim2/` with candidate changes.
5. Select representative captures; do not promote every capture.
6. Draft objective expectations only where behavior is measurable.
7. Run old and candidate versions as independent, context-isolated tests.
8. Run both configurations in the same batch with the same model.
9. Apply `evals/lint.mjs` to every generated output.
10. Compare outputs blindly; reveal version labels only afterward.
11. Ask user to judge subjective Caveman/readability differences.
12. Promote approved rules from `skills/skim2/` to stable
    `skills/skim/`; promote prompts to `evals/cases.json` and preferred outputs
    to `evals/gold/`.
13. Mark capture JSON `status` as `promoted`, `duplicate`, or `discarded`.
14. Run fixed corpus; commit only with no mandatory-gate regression.

Workspace layout:

```text
evals/workspaces/iteration-N/
  skill-snapshot/
  <capture-id>/old_skill/outputs/output.txt
  <capture-id>/candidate/outputs/output.txt
  <capture-id>/eval_metadata.json
  feedback.json
```

Review UI:

- Reuse Anthropic skill-creator’s Apache-2.0 `generate_review.py` and
  `viewer.html`; do not rebuild a generic viewer.
- Source: `anthropics/skills`, `skills/skill-creator/eval-viewer/`.
- Validated source revision: `9d2f1ae187231d8199c64b5b762e1bdf2244733d`.
- Clone to a temporary directory when needed; keep third-party code outside
  this MIT package unless vendoring becomes necessary.
- Static HTML is acceptable when browser-server launch is unavailable.

The Anthropic trigger optimizer calls `claude -p` and does not test Pi.
Do not reuse that executor. Use Skim’s Pi adapter or isolated Codex runs;
reuse only the workflow, schemas, aggregation concepts, and review viewer.

## Improvement ladder

### 1. Prompt plus examples — current

Use when:

- Structural pass rate remains high.
- Wording failures are occasional.
- Lowest latency matters.

Tradeoffs:

- Cheapest and simplest.
- Natural free-form answers.
- Compliance remains probabilistic.

Next changes:

- Review accumulated captures first.
- Add real failures to `evals/cases.json`.
- Add preferred outputs to `evals/gold/`.
- Change one contract concept per experiment.
- Compare same model and sample count.

### 2. Skill-creator A/B review — current

Use when:

- Several related captures accumulate.
- A rule or example change needs validation.
- Human preference matters more than one aggregate number.

Method:

- Snapshot old version.
- Run old and candidate in isolated contexts.
- Apply deterministic Skim checks.
- Blind-compare outputs.
- Collect user feedback before promotion.

Tradeoffs:

- Directly tests skill changes against real failures.
- Human review captures subjective style better than numeric scores.
- Costs model calls only during review, never during capture.

### 3. Structured final-response tool

Use when:

- More than 5 anchors remains common.
- Indentation and Markdown-shape compliance must be deterministic.
- Prompt tuning no longer improves structural pass rate.

Suggested schema:

```json
{
  "headline": "optional terse line",
  "groups": [
    {
      "anchor": "1–4 words",
      "facts": ["1–5 terse facts"]
    }
  ],
  "close": "optional terse line"
}
```

Schema constraints:

- `groups.maxItems = 5`
- `facts.maxItems = 5`
- Recursive children omitted initially.
- Extension renders deterministic Skim text.

Tradeoffs:

- Highest format reliability.
- Clear separation: model supplies facts; renderer supplies layout.
- More extension code and custom rendering.
- Wording still needs Caveman linting.
- Complex nested answers may need richer schema later.

### 4. Second-pass repair

Use when:

- Caveman wording still fails after structured rendering.
- Added latency and model cost are acceptable.
- Semantic-preservation evals already pass.

Possible design:

1. Generate answer.
2. Lint answer.
3. If failed, ask model to rewrite wording only.
4. Require every original fact to remain.
5. Lint repaired answer before display.

Tradeoffs:

- Strongest style compliance.
- Roughly doubles final-answer latency and generation cost on failures.
- Repair can omit or alter facts.
- Streaming may expose original output before replacement.

Do not enable automatic repair until missing-fact and invented-fact judging
exists.

### 5. Fine-tuning — last resort

Consider only after:

- At least 100–300 high-quality prompt/output pairs exist.
- Prompt and structured-output approaches plateau.
- One stable model/provider will remain in use.

Tradeoffs:

- Can make wording style more automatic.
- Costs money and dataset maintenance.
- Couples behavior to one model family.
- Still needs evals; fine-tuning does not guarantee correctness.

## Evaluation gates

Never collapse everything into one weighted score.

Mandatory gates:

- No missing critical fact.
- No invented fact.
- Safety and ordered procedures remain unambiguous.
- Exact code, commands, identifiers, and errors preserved.

Then compare:

- Structural pass rate.
- Top-level anchor count.
- Function-word rate.
- Full-sentence rate inside body.
- Human preference against previous baseline.

## Next-session checklist

1. Read unreviewed files from `<agent-dir>/skim/captures/`.
2. Dedupe and classify captures.
3. Keep stable skill and rules as baseline.
4. Select representative cases; draft expectations.
5. Overwrite `skills/skim2/` with one candidate change.
6. Run old and candidate with same model and sample count.
7. Lint, blind-compare, then collect user preference.
8. Promote only with zero mandatory-gate regressions.

## Deferred tooling

- LLM semantic judge for omissions and inventions.
- Live `/skim score` command.
- Structured final-response tool.
- Conditional repair pass.
- Model-by-model baselines.
