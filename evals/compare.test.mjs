import assert from "node:assert/strict";
import test from "node:test";
import {
	adjudicateJudgeResult,
	aggregateComparison,
	escapeEmbeddedJson,
	makeBlindMapping,
	makeGenerationOrder,
	parseJudgeJson,
	parsePiJson,
	stripFrontmatter,
} from "./compare-lib.mjs";
import { judgePrompt, validateConfig } from "./compare.mjs";
import { renderMarkdownReport, renderReviewHtml } from "./review.mjs";

const config = {
	name: "test-suite",
	description: "test",
	profiles: {
		stable: { label: "Stable", skill: "skills/skim/SKILL.md" },
		candidate: { label: "Candidate", skill: "skills/skim-2/SKILL.md" },
	},
	preferenceCriteria: ["Correctness"],
	cases: [
		{
			id: "test-case",
			origin: "stable",
			prompt: "Prompt",
			semanticAssertions: [{ id: "meaning", text: "Meaning preserved" }],
		},
	],
};

function output({ pass, words, bodyLines, durationMs = 100, totalTokens = 10 }) {
	return {
		text: pass ? "Good" : "Bad",
		outputFile: "output.txt",
		provider: "provider",
		model: "model",
		usage: {
			input: totalTokens - 2,
			output: 2,
			totalTokens,
			cost: { total: 0.001 },
		},
		stopReason: "stop",
		parseErrors: [],
		durationMs,
		exitCode: 0,
		lint: {
			pass,
			errors: pass ? [] : ["failed"],
			warnings: [],
			metrics: { words, bodyLines, anchors: 1, orderedItems: 0 },
		},
	};
}

function pair({ stablePass = true, candidatePass = true, winner = "B" } = {}) {
	return {
		caseId: "test-case",
		origin: "stable",
		category: "test",
		prompt: "Prompt",
		semanticAssertions: [{ id: "meaning", text: "Meaning preserved" }],
		run: 1,
		generationOrder: ["stable", "candidate"],
		outputs: {
			stable: output({ pass: stablePass, words: 12, bodyLines: 4 }),
			candidate: output({ pass: candidatePass, words: 8, bodyLines: 3 }),
		},
		judge: {
			mapping: { A: "stable", B: "candidate" },
			result: {
				assertions: {
					A: [{ id: "meaning", pass: true, evidence: "ok" }],
					B: [{ id: "meaning", pass: true, evidence: "ok" }],
				},
				preference: { winner, confidence: "medium", reasons: ["denser"] },
			},
			error: null,
		},
	};
}

function summaryFixture(pairs = [pair()]) {
	const aggregate = aggregateComparison({
		config,
		pairs,
		runs: 1,
		judgeEnabled: true,
	});
	return {
		schemaVersion: 1,
		label: "test",
		timestamp: "2026-07-19T00-00-00-000Z",
		gitHead: "abc123",
		runsPerCase: 1,
		judgeEnabled: true,
		seed: "seed",
		requested: {},
		promptChars: { stable: 100, candidate: 200 },
		actualModels: ["provider/model"],
		actualJudgeModels: ["provider/model"],
		config,
		pairs,
		aggregate,
	};
}

test("strips YAML frontmatter and preserves skill body", () => {
	assert.equal(stripFrontmatter("---\nname: test\n---\n# Body\nText"), "# Body\nText");
	assert.equal(stripFrontmatter("# Body\nText"), "# Body\nText");
});

test("blind mapping and generation order are deterministic", () => {
	assert.deepEqual(
		makeBlindMapping("case", 1, "seed"),
		makeBlindMapping("case", 1, "seed"),
	);
	assert.deepEqual(
		makeGenerationOrder("case", 2, "seed"),
		makeGenerationOrder("case", 2, "seed"),
	);
	assert.deepEqual(new Set(Object.values(makeBlindMapping("case", 1, "seed"))), new Set(["stable", "candidate"]));
});

test("parses Pi JSONL assistant output and exact usage", () => {
	const raw = [
		JSON.stringify({ type: "session", id: "1" }),
		JSON.stringify({
			type: "message_end",
			message: {
				role: "assistant",
				content: [{ type: "text", text: "Answer" }],
				provider: "openai-codex",
				model: "gpt-5.5",
				usage: { input: 20, output: 3, totalTokens: 23 },
				stopReason: "stop",
			},
		}),
	].join("\n");
	const parsed = parsePiJson(raw);
	assert.equal(parsed.text, "Answer");
	assert.equal(parsed.provider, "openai-codex");
	assert.equal(parsed.model, "gpt-5.5");
	assert.equal(parsed.usage.totalTokens, 23);
	assert.deepEqual(parsed.parseErrors, []);
});

test("parses fenced blind judge JSON and normalizes assertions", () => {
	const raw = `\`\`\`json
{
  "assertions": {
    "A": [{"id":"meaning","pass":true,"evidence":"present"}],
    "B": [{"id":"meaning","pass":false,"evidence":"missing"}]
  },
  "preference": {"winner":"A","confidence":"high","reasons":["clearer"]}
}
\`\`\``;
	const parsed = parseJudgeJson(raw, ["meaning"]);
	assert.equal(parsed.assertions.A[0].pass, true);
	assert.equal(parsed.assertions.B[0].pass, false);
	assert.equal(parsed.preference.winner, "A");
});

test("adjudication prioritizes semantic hard gates over raw preference", () => {
	const fixture = pair({ winner: "B" });
	fixture.judge.result.assertions.B[0].pass = false;
	const result = adjudicateJudgeResult({
		result: fixture.judge.result,
		mapping: fixture.judge.mapping,
		outputs: fixture.outputs,
	});
	assert.equal(result.rawPreference.winner, "B");
	assert.equal(result.preference.winner, "A");
	assert.equal(result.preference.adjudicatedBy, "semantic-hard-gate");
});

test("adjudication prioritizes mechanical pass when semantics tie", () => {
	const fixture = pair({ stablePass: true, candidatePass: false, winner: "B" });
	const result = adjudicateJudgeResult({
		result: fixture.judge.result,
		mapping: fixture.judge.mapping,
		outputs: fixture.outputs,
	});
	assert.equal(result.preference.winner, "A");
	assert.equal(result.preference.adjudicatedBy, "mechanical-hard-gate");
});

test("adjudication prefers fewer violations when both outputs fail", () => {
	const fixture = pair({ stablePass: false, candidatePass: false, winner: "A" });
	fixture.outputs.stable.lint.errors = ["one", "two", "three"];
	fixture.outputs.candidate.lint.errors = ["one"];
	const result = adjudicateJudgeResult({
		result: fixture.judge.result,
		mapping: fixture.judge.mapping,
		outputs: fixture.outputs,
	});
	assert.equal(result.preference.winner, "B");
	assert.equal(result.preference.adjudicatedBy, "mechanical-severity");
});

test("judge prompt includes blind hard constraints and observed lint", () => {
	const fixture = pair();
	const testCase = {
		...config.cases[0],
		mechanical: { expectedShape: "markdown", maxBodyLines: 18 },
	};
	const payload = JSON.parse(
		judgePrompt(config, testCase, fixture, fixture.judge.mapping),
	);
	assert.equal(payload.hardConstraints.maxBodyLines, 18);
	assert.equal(payload.hardConstraints.maxChildrenPerParent, 5);
	assert.equal(payload.outputs.A.mechanical.pass, true);
	assert.equal(payload.outputs.B.text, "Good");
});

test("aggregate exposes candidate regression and insufficient variance", () => {
	const pairs = [pair({ stablePass: true, candidatePass: false, winner: "A" })];
	const aggregate = aggregateComparison({ config, pairs, runs: 1, judgeEnabled: true });
	assert.equal(aggregate.comparison.mechanicalRegressions, 1);
	assert.equal(aggregate.profiles.stable.judgeWins, 1);
	assert.equal(aggregate.decision.status, "insufficient-variance");
});

test("aggregate can prefer candidate only with repeated clean evidence", () => {
	const pairs = [1, 2, 3].map((run) => ({ ...pair({ winner: "B" }), run }));
	const aggregate = aggregateComparison({ config, pairs, runs: 3, judgeEnabled: true });
	assert.equal(aggregate.comparison.mechanicalRegressions, 0);
	assert.equal(aggregate.profiles.candidate.judgeWins, 3);
	assert.equal(aggregate.judge.tokens.total, 0);
	assert.equal(aggregate.decision.status, "candidate-preferred");
});

test("embedded JSON escapes script-breaking content", () => {
	const escaped = escapeEmbeddedJson({ output: "</script><script>alert(1)</script>" });
	assert.doesNotMatch(escaped, /<\/script>/);
	assert.match(escaped, /\\u003c/);
});

test("review and Markdown reports include raw comparison evidence", () => {
	const summary = summaryFixture();
	summary.pairs[0].outputs.stable.text = "</script>stable raw";
	const html = renderReviewHtml(summary);
	const markdown = renderMarkdownReport(summary);
	assert.match(html, /Blind human review/);
	assert.doesNotMatch(html, /<\/script>stable raw/);
	assert.match(markdown, /Mechanical pass/);
	assert.match(markdown, /insufficient-variance/);
});

test("validates required profiles, cases, and assertion ids", () => {
	assert.doesNotThrow(() => validateConfig(config));
	assert.throws(
		() => validateConfig({ ...config, cases: [{ id: "Bad ID", prompt: "x" }] }),
		/invalid case id/,
	);
});
