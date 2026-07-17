# Skim evals

Evals are repeatable behavior tests. They do not train a model.
They reveal whether rule or example changes improve the desired output.

Normal users do not run these commands. Use `/skim capture [note]` during
normal Pi work, then ask Codex to review captures and improve Skim.

## What exists

- `cases.json`: 32 prompts across floor, diagnosis, comparison, plan,
  research, safety, exact-text, global-cap, language, container, and
  artifact-handoff cases.
- `gold/`: hand-approved outputs defining current taste.
- `lint.mjs`: deterministic structure, wording, and required-term checks.
- `run.mjs`: repeated headless Pi runs with raw-output preservation.

Captured interactions live outside the repository:

```text
~/.pi/agent/skim/captures/*.json
```

When `PI_CODING_AGENT_DIR` is set, captures live beneath that directory.

## Commands

Validate hand-written gold outputs:

```bash
npm run eval:lint
```

Inspect planned benchmark size without calling a model:

```bash
npm run eval:dry
```

Run all 32 cases 3 times with Pi defaults:

```bash
npm run eval -- --label baseline
```

Target one case or model:

```bash
npm run eval -- --case diagnose-pool --runs 1
npm run eval -- --provider anthropic --model claude-sonnet-4 --label candidate
```

Use an alternate compiled prompt:

```bash
npm run eval -- --prompt-file /tmp/skim-candidate.md --label candidate
```

Results land under `evals/results/<timestamp>-<label>/` with raw outputs,
the exact system prompt, stderr where present, and `summary.json`.

## Baseline TODO

- [ ] Run one successful full-corpus baseline for every model intended for
  support.
- [ ] Record provider, exact model ID, date, skill revision, pass rate, and
  result path.
- [ ] Compare future contract changes against the same models and run count.

## Score interpretation

Hard failures:

- Missing required facts.
- Wrong plain/markdown shape.
- More than 2 lines in a plain reply.
- More than 5 top-level anchors.
- More than 5 children under one parent.
- More than 3 indentation levels.
- More than the case's 18, 24, or 42-line budget.
- More than two prose lines over 72 characters.
- Any prose line over 100 characters.
- Polished introduction.

Warnings:

- Individual lines over 72 characters, including protected exact text.
- High function-word rate.
- High full-sentence rate inside Skim body.

Required terms are a cheap semantic proxy, not a complete judge.
Review raw outputs for omissions, inventions, ambiguity, and usefulness.

## Improvement loop

1. Read unreviewed captures and remove duplicates.
2. Snapshot current skill and rules before editing.
3. Turn representative captures into test prompts and expectations.
4. Run old and candidate versions independently in the same batch.
5. Apply deterministic linting before model or human judgment.
6. Compare outputs blindly and collect user preference.
7. Promote only reviewed cases into `cases.json` and `gold/`.
8. Run fixed corpus before committing the candidate.

Use 3 runs per case because model output varies. Compare models separately.
Never mix model changes with prompt changes in one experiment.
