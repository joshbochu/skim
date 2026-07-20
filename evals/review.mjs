import { escapeEmbeddedJson } from "./compare-lib.mjs";

function percent(value) {
	return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function metric(value, suffix = "") {
	return value == null ? "—" : `${value}${suffix}`;
}

function escapeMarkdown(value) {
	return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function caseRows(summary) {
	const rows = [];
	for (const testCase of summary.config.cases) {
		const pairs = summary.pairs.filter((pair) => pair.caseId === testCase.id);
		const stablePasses = pairs.filter((pair) => pair.outputs.stable.lint.pass).length;
		const candidatePasses = pairs.filter((pair) => pair.outputs.candidate.lint.pass).length;
		let stableWins = 0;
		let candidateWins = 0;
		let ties = 0;
		for (const pair of pairs) {
			const winner = pair.judge?.result?.preference.winner;
			if (!winner || winner === "tie") {
				if (winner === "tie") ties += 1;
				continue;
			}
			const profile = pair.judge.mapping[winner];
			if (profile === "stable") stableWins += 1;
			if (profile === "candidate") candidateWins += 1;
		}
		rows.push({
			id: testCase.id,
			origin: testCase.origin,
			stablePasses,
			candidatePasses,
			stableWins,
			candidateWins,
			ties,
			runs: pairs.length,
		});
	}
	return rows;
}

export function renderMarkdownReport(summary) {
	const stable = summary.aggregate.profiles.stable;
	const candidate = summary.aggregate.profiles.candidate;
	const judge = summary.aggregate.judge ?? {
		generations: 0,
		averageDurationMs: 0,
		tokens: { input: 0, output: 0, total: 0 },
		cost: 0,
	};
	const lines = [
		`# ${summary.config.name} comparison`,
		"",
		`Decision: **${summary.aggregate.decision.status}**`,
		"",
		"## Setup",
		"",
		`- Cases: ${summary.config.cases.length}`,
		`- Runs per case: ${summary.runsPerCase}`,
		`- Blind semantic judge: ${summary.judgeEnabled ? "enabled" : "disabled"}`,
		`- Seed: \`${summary.seed}\``,
		`- Generated: ${summary.timestamp}`,
		`- Models observed: ${summary.actualModels.length ? summary.actualModels.map((item) => `\`${item}\``).join(", ") : "none"}`,
		`- Judge models observed: ${summary.actualJudgeModels?.length ? summary.actualJudgeModels.map((item) => `\`${item}\``).join(", ") : "none"}`,
		"",
		"## Aggregate",
		"",
		`| Metric | ${escapeMarkdown(stable.label)} | ${escapeMarkdown(candidate.label)} |`,
		"|---|---:|---:|",
		`| Mechanical pass | ${stable.mechanicalPassCount}/${stable.generations} (${percent(stable.mechanicalPassRate)}) | ${candidate.mechanicalPassCount}/${candidate.generations} (${percent(candidate.mechanicalPassRate)}) |`,
		`| Semantic assertion pass | ${stable.semanticPassed}/${stable.semanticTotal || "—"} (${percent(stable.semanticPassRate)}) | ${candidate.semanticPassed}/${candidate.semanticTotal || "—"} (${percent(candidate.semanticPassRate)}) |`,
		`| Blind judge wins | ${stable.judgeWins} | ${candidate.judgeWins} |`,
		`| Average words | ${stable.averageWords} | ${candidate.averageWords} |`,
		`| Average body lines | ${stable.averageBodyLines} | ${candidate.averageBodyLines} |`,
		`| Average duration | ${stable.averageDurationMs} ms | ${candidate.averageDurationMs} ms |`,
		`| Total tokens | ${stable.tokens.total} | ${candidate.tokens.total} |`,
		`| Estimated model cost | $${stable.cost.toFixed(6)} | $${candidate.cost.toFixed(6)} |`,
		"",
		`Judge overhead: ${judge.tokens.total} tokens, $${judge.cost.toFixed(6)}, ${judge.averageDurationMs} ms average.`,
		`Hard-gate adjudications: ${summary.aggregate.comparison.adjudicatedPairs ?? 0}.`,
		"",
		"## Decision evidence",
		"",
		...summary.aggregate.decision.reasons.map((reason) => `- ${reason}`),
		"",
		"## Cases",
		"",
		"| Case | Origin | Stable mechanical | Candidate mechanical | Stable judge wins | Candidate judge wins | Ties |",
		"|---|---|---:|---:|---:|---:|---:|",
		...caseRows(summary).map((row) =>
			`| ${row.id} | ${row.origin} | ${row.stablePasses}/${row.runs} | ${row.candidatePasses}/${row.runs} | ${row.stableWins} | ${row.candidateWins} | ${row.ties} |`,
		),
		"",
		"Open `review.html` for blinded raw-output review and feedback export.",
		"",
	];
	return lines.join("\n");
}

export function renderReviewHtml(summary) {
	const normalizedSummary = {
		...summary,
		aggregate: {
			...summary.aggregate,
			judge: summary.aggregate.judge ?? {
				generations: 0,
				averageDurationMs: 0,
				tokens: { input: 0, output: 0, total: 0 },
				cost: 0,
			},
		},
	};
	const payload = escapeEmbeddedJson({
		...normalizedSummary,
		caseRows: caseRows(normalizedSummary),
	});
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(summary.config.name)} review</title>
<style>
:root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
* { box-sizing: border-box; }
body { margin: 0; background: Canvas; color: CanvasText; }
main { width: min(1180px, 100%); margin: 0 auto; padding: 24px; }
h1, h2, h3 { margin: 0; }
p { margin: 6px 0; }
button, select, textarea, input { font: inherit; }
button, select { padding: 8px 10px; }
button { cursor: pointer; }
textarea { width: 100%; min-height: 100px; padding: 10px; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; font-family: ui-monospace, monospace; }
.toolbar, .controls, .stats, .output-head, .feedback-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.toolbar { justify-content: space-between; margin-bottom: 16px; }
.tabs { display: flex; gap: 8px; }
.tab[aria-selected="true"] { font-weight: 700; }
.panel[hidden] { display: none; }
.card { border: 1px solid color-mix(in srgb, CanvasText 22%, transparent); border-radius: 10px; padding: 16px; }
.stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 14px 0; }
.stat { min-width: 0; }
.stat strong { display: block; font-size: 1.25rem; }
.muted { opacity: .72; }
.controls { margin: 14px 0; }
.controls label { display: grid; gap: 4px; }
.prompt { margin-bottom: 14px; }
.outputs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-items: start; }
.output-head { justify-content: space-between; margin-bottom: 10px; }
.badge { border: 1px solid currentColor; border-radius: 999px; padding: 2px 8px; font-size: .82rem; }
.fail { color: #b42318; }
@media (prefers-color-scheme: dark) { .fail { color: #ff8a80; } }
.details { margin-top: 14px; }
.details ul { margin: 8px 0 0; padding-left: 20px; }
.feedback { margin-top: 16px; display: grid; gap: 10px; }
.feedback-row label { display: flex; gap: 5px; align-items: center; }
table { width: 100%; border-collapse: collapse; margin-top: 14px; }
th, td { border-bottom: 1px solid color-mix(in srgb, CanvasText 20%, transparent); text-align: left; padding: 8px; vertical-align: top; }
th:not(:first-child), td:not(:first-child) { text-align: right; }
.decision { margin-top: 14px; }
@media (max-width: 760px) {
  main { padding: 14px; }
  .outputs { grid-template-columns: 1fr; }
  .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  table { display: block; overflow-x: auto; }
}
</style>
</head>
<body>
<main>
  <div class="toolbar">
    <div>
      <h1 id="title"></h1>
      <p class="muted" id="subtitle"></p>
    </div>
    <div class="tabs" role="tablist" aria-label="Review sections">
      <button class="tab" id="outputs-tab" role="tab" aria-selected="true">Outputs</button>
      <button class="tab" id="benchmark-tab" role="tab" aria-selected="false">Benchmark</button>
    </div>
  </div>

  <section class="panel" id="outputs-panel" role="tabpanel">
    <div class="controls">
      <label>Case<select id="case-select"></select></label>
      <label>Run<select id="run-select"></select></label>
      <label><span>Identity</span><span><input type="checkbox" id="reveal"> Reveal profiles</span></label>
    </div>
    <article class="card prompt">
      <div class="output-head"><strong>Prompt</strong><span class="muted" id="origin"></span></div>
      <pre id="prompt"></pre>
    </article>
    <div class="outputs">
      <article class="card" id="output-a"></article>
      <article class="card" id="output-b"></article>
    </div>
    <section class="card feedback">
      <strong>Blind human review</strong>
      <div class="feedback-row" role="radiogroup" aria-label="Preferred output">
        <label><input type="radio" name="winner" value="A"> A</label>
        <label><input type="radio" name="winner" value="B"> B</label>
        <label><input type="radio" name="winner" value="tie"> Tie</label>
      </div>
      <label>Notes<textarea id="notes" placeholder="What was clearer, denser, missing, or misleading?"></textarea></label>
      <div><button id="export-feedback">Export feedback.json</button></div>
    </section>
  </section>

  <section class="panel" id="benchmark-panel" role="tabpanel" hidden>
    <div class="stats" id="stats"></div>
    <article class="card decision">
      <h2 id="decision"></h2>
      <ul id="decision-reasons"></ul>
    </article>
    <table>
      <thead><tr><th>Case</th><th>Origin</th><th>Stable hard pass</th><th>Candidate hard pass</th><th>Stable judge wins</th><th>Candidate judge wins</th><th>Ties</th></tr></thead>
      <tbody id="case-table"></tbody>
    </table>
  </section>
</main>
<script type="application/json" id="comparison-data">${payload}</script>
<script>
const data = JSON.parse(document.getElementById('comparison-data').textContent);
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const pairKey = (pair) => pair.caseId + '::' + pair.run;
const storageKey = 'skim-compare-feedback::' + data.label + '::' + data.timestamp;
let feedback = {};
let activeFeedbackKey = null;
try { feedback = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch {}

$('title').textContent = data.config.name;
$('subtitle').textContent = data.runsPerCase + ' run(s) per case · ' + (data.judgeEnabled ? 'blind judge enabled' : 'blind judge disabled');

for (const testCase of data.config.cases) {
  const option = document.createElement('option');
  option.value = testCase.id;
  option.textContent = testCase.id;
  $('case-select').append(option);
}

function currentPair() {
  const caseId = $('case-select').value;
  const run = Number($('run-select').value);
  return data.pairs.find((pair) => pair.caseId === caseId && pair.run === run);
}

function refreshRuns() {
  const current = $('run-select').value;
  const runs = data.pairs.filter((pair) => pair.caseId === $('case-select').value).map((pair) => pair.run);
  $('run-select').replaceChildren(...runs.map((run) => {
    const option = document.createElement('option');
    option.value = String(run);
    option.textContent = String(run);
    return option;
  }));
  if (runs.includes(Number(current))) $('run-select').value = current;
}

function gradeList(pair, label) {
  const grades = pair.judge?.result?.assertions?.[label] || [];
  if (!grades.length) return '<p class="muted">Semantic judge not run.</p>';
  return '<ul>' + grades.map((grade) => '<li>' + (grade.pass ? '✓ ' : '✗ ') + esc(grade.id) + (grade.evidence ? ': ' + esc(grade.evidence) : '') + '</li>').join('') + '</ul>';
}

function outputCard(pair, label) {
  const profile = pair.judge.mapping[label];
  const result = pair.outputs[profile];
  const profileLabel = data.config.profiles[profile].label;
  const heading = $('reveal').checked ? label + ' · ' + profileLabel : 'Output ' + label;
  const status = result.lint.pass ? 'PASS' : 'FAIL';
  const errors = result.lint.errors.length
    ? '<ul>' + result.lint.errors.map((error) => '<li>' + esc(error) + '</li>').join('') + '</ul>'
    : '<p class="muted">No mechanical errors.</p>';
  return '<div class="output-head"><strong>' + esc(heading) + '</strong><span class="badge ' + (result.lint.pass ? '' : 'fail') + '">' + status + ' · ' + result.lint.metrics.words + ' words · ' + result.lint.metrics.bodyLines + ' lines</span></div>' +
    '<pre>' + esc(result.text) + '</pre>' +
    '<details class="details"><summary>Mechanical checks</summary>' + errors + '</details>' +
    '<details class="details"><summary>Semantic assertions</summary>' + gradeList(pair, label) + '</details>';
}

function saveFeedback() {
  if (!activeFeedbackKey) return;
  const selected = document.querySelector('input[name="winner"]:checked');
  feedback[activeFeedbackKey] = { winner: selected?.value ?? null, notes: $('notes').value };
  try { localStorage.setItem(storageKey, JSON.stringify(feedback)); } catch {}
}

function renderPair() {
  const pair = currentPair();
  if (!pair) return;
  $('prompt').textContent = pair.prompt;
  $('origin').textContent = 'origin: ' + pair.origin;
  $('output-a').innerHTML = outputCard(pair, 'A');
  $('output-b').innerHTML = outputCard(pair, 'B');
  activeFeedbackKey = pairKey(pair);
  const saved = feedback[activeFeedbackKey] || {};
  document.querySelectorAll('input[name="winner"]').forEach((radio) => { radio.checked = radio.value === saved.winner; });
  $('notes').value = saved.notes || '';
}

function stat(label, stableValue, candidateValue, comparisonLabel = 'stable / candidate') {
  return '<div class="card stat"><span class="muted">' + esc(label) + '</span><strong>' + esc(stableValue) + ' / ' + esc(candidateValue) + '</strong><span class="muted">' + esc(comparisonLabel) + '</span></div>';
}

function renderBenchmark() {
  const stable = data.aggregate.profiles.stable;
  const candidate = data.aggregate.profiles.candidate;
  const pct = (value) => value == null ? '—' : (value * 100).toFixed(1) + '%';
  $('stats').innerHTML = [
    stat('Mechanical pass', pct(stable.mechanicalPassRate), pct(candidate.mechanicalPassRate)),
    stat('Semantic pass', pct(stable.semanticPassRate), pct(candidate.semanticPassRate)),
    stat('Blind judge wins', stable.judgeWins, candidate.judgeWins),
    stat('Average words', stable.averageWords, candidate.averageWords),
    stat('Total tokens', stable.tokens.total, candidate.tokens.total),
    stat('Model cost', '$' + stable.cost.toFixed(6), '$' + candidate.cost.toFixed(6)),
    stat('Average latency', stable.averageDurationMs + ' ms', candidate.averageDurationMs + ' ms'),
    stat('Judge overhead', data.aggregate.judge.tokens.total + ' tokens', '$' + data.aggregate.judge.cost.toFixed(6)),
    stat('Hard-gate adjudication', data.aggregate.comparison.adjudicatedPairs || 0, data.aggregate.comparison.judgedPairs, 'adjudicated / judged')
  ].join('');
  $('decision').textContent = data.aggregate.decision.status;
  $('decision-reasons').innerHTML = data.aggregate.decision.reasons.map((reason) => '<li>' + esc(reason) + '</li>').join('');
  $('case-table').innerHTML = data.caseRows.map((row) => '<tr><td>' + esc(row.id) + '</td><td>' + esc(row.origin) + '</td><td>' + row.stablePasses + '/' + row.runs + '</td><td>' + row.candidatePasses + '/' + row.runs + '</td><td>' + row.stableWins + '</td><td>' + row.candidateWins + '</td><td>' + row.ties + '</td></tr>').join('');
}

$('case-select').addEventListener('change', () => { saveFeedback(); refreshRuns(); renderPair(); });
$('run-select').addEventListener('change', () => { saveFeedback(); renderPair(); });
$('reveal').addEventListener('change', renderPair);
$('notes').addEventListener('input', saveFeedback);
document.querySelectorAll('input[name="winner"]').forEach((radio) => radio.addEventListener('change', saveFeedback));

function selectTab(name) {
  const outputs = name === 'outputs';
  $('outputs-panel').hidden = !outputs;
  $('benchmark-panel').hidden = outputs;
  $('outputs-tab').setAttribute('aria-selected', String(outputs));
  $('benchmark-tab').setAttribute('aria-selected', String(!outputs));
}
$('outputs-tab').addEventListener('click', () => selectTab('outputs'));
$('benchmark-tab').addEventListener('click', () => selectTab('benchmark'));

$('export-feedback').addEventListener('click', () => {
  saveFeedback();
  const reviews = data.pairs.map((pair) => ({
    caseId: pair.caseId,
    run: pair.run,
    blindMapping: pair.judge.mapping,
    winner: feedback[pairKey(pair)]?.winner ?? null,
    notes: feedback[pairKey(pair)]?.notes ?? ''
  }));
  const blob = new Blob([JSON.stringify({ suite: data.config.name, timestamp: new Date().toISOString(), reviews }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'feedback.json';
  link.click();
  URL.revokeObjectURL(url);
});

refreshRuns();
renderPair();
renderBenchmark();
</script>
</body>
</html>`;
}
