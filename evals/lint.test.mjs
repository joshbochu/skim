import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolve } from "node:path";
import { lintOutput } from "./lint.mjs";

test("accepts terse floor response", () => {
	const report = lintOutput("Port 3000, set in `vite.config.ts`.", {
		expectedShape: "plain",
		requiredTerms: ["3000", "vite.config.ts"],
	});
	assert.equal(report.pass, true);
});

test("accepts two plain fact lines without anchors", () => {
	const output = "Cached data remains stale.\nInvalidation arrives 30 seconds late.";
	const report = lintOutput(output, {
		expectedShape: "plain",
		requiredTerms: ["cached data", "invalidation", "30 seconds"],
	});
	assert.equal(report.pass, true, report.errors.join("\n"));
	assert.equal(report.metrics.headlineLines, 2);
	assert.equal(report.metrics.anchors, 0);
});

test("rejects more than two plain fact lines", () => {
	const report = lintOutput("fact one\nfact two\nfact three", {
		expectedShape: "plain",
	});
	assert.equal(report.pass, false);
	assert.match(report.errors.join("\n"), /headline lines 3 > 2/);
});

test("rejects more than 5 top-level anchors", () => {
	const output = "Result.\n\n- a\n- b\n- c\n- d\n- e\n- f";
	const report = lintOutput(output, { expectedShape: "markdown" });
	assert.equal(report.pass, false);
	assert.match(report.errors.join("\n"), /top-level anchors 6 > 5/);
});

test("rejects more than 5 children", () => {
	const output = "Result.\n\n- root\n  - a\n  - b\n  - c\n  - d\n  - e\n  - f";
	const report = lintOutput(output, { expectedShape: "markdown" });
	assert.equal(report.pass, false);
	assert.match(report.errors.join("\n"), /parent has >5 children/);
});

test("rejects polished introduction", () => {
	const report = lintOutput("Sure! Here is the answer.", {
		expectedShape: "plain",
	});
	assert.equal(report.pass, false);
	assert.match(report.errors.join("\n"), /polished introduction/);
});

test("strict wording rejects polished grammar inside preserved Skim layout", () => {
	const output = [
		"The parent creates a new object on every render.",
		"",
		"- **cause**",
		"  - the child sees that the reference has changed.",
		"  - the component therefore rerenders.",
		"- **fix**",
		"  - wrap the object in `useMemo`.",
		"  - the reference will remain stable.",
	].join("\n");
	const report = lintOutput(output, {
		expectedShape: "markdown",
		strictWording: true,
	});
	assert.equal(report.pass, false);
	assert.match(report.errors.join("\n"), /function-word rate/);
	assert.match(report.errors.join("\n"), /body sentence rate/);
});

test("strict wording accepts liked voice inside same Skim layout", () => {
	const output = [
		"Parent make new object each render.",
		"",
		"- **cause**",
		"  - child see changed reference",
		"  - component rerender",
		"- **fix**",
		"  - wrap object in `useMemo`",
		"  - reference stay stable",
		"  - needless rerender stop",
	].join("\n");
	const report = lintOutput(output, {
		expectedShape: "markdown",
		strictWording: true,
	});
	assert.equal(report.pass, true, report.errors.join("\n"));
	assert.equal(report.metrics.anchors, 2);
	assert.equal(report.metrics.maxDepth, 1);
});

test("skim-v2 keeps liked voice plus original Skim layout cues", async () => {
	const skill = await readFile("skills/skim-v2/SKILL.md", "utf8");
	const cues = [
		"parent make",
		"child see",
		"reference stay",
		"1–5 top-level anchors",
		"2 spaces",
		"`→` | next or result",
		"`∵` | cause",
		"Layout arithmetic confirmed before wording",
		"Numbered actions never appear at top level",
		"Continue global numbering",
		"No supplied status strengthened",
	];
	for (const cue of cues) {
		assert.ok(skill.includes(cue), `skim-v2 skill missing: ${cue}`);
	}
});

test("rejects missing required term", () => {
	const report = lintOutput("Pool exhausted.", {
		expectedShape: "plain",
		requiredTerms: ["try/finally"],
	});
	assert.equal(report.pass, false);
	assert.match(report.errors.join("\n"), /missing required term: try\/finally/);
});

test("accepts native markdown container", () => {
	const output = [
		"Build quality verified.",
		"",
		"- ✓ **proof**",
		"  - tests 42/42",
		"  - release build clean",
		"- ⚠ **risk**",
		"  - layout monolith",
	].join("\n");
	const report = lintOutput(output, { expectedShape: "markdown" });
	assert.equal(report.pass, true, report.errors.join("\n"));
	assert.equal(report.metrics.bodyKind, "markdown");
	assert.equal(report.metrics.anchors, 2);
});

test("accepts ordered actions nested under phase anchors", () => {
	const output = [
		"Restore order fixed.",
		"",
		"- **prepare**",
		"  1. stop writers",
		"  2. snapshot current DB",
		"- **restore**",
		"  1. restore backup",
		"  2. run migrations",
	].join("\n");
	const report = lintOutput(output, {
		expectedShape: "markdown",
		minOrderedItems: 4,
	});
	assert.equal(report.pass, true, report.errors.join("\n"));
	assert.equal(report.metrics.orderedItems, 4);
});

test("rejects unordered actions when ordered sequence required", () => {
	const output = [
		"Restore order fixed.",
		"",
		"- **prepare**",
		"  - stop writers",
		"  - snapshot current DB",
	].join("\n");
	const report = lintOutput(output, {
		expectedShape: "markdown",
		minOrderedItems: 2,
	});
	assert.equal(report.pass, false);
	assert.match(report.errors.join("\n"), /ordered items 0 < 2/);
});

test("rejects Roman numerals when decimal steps required", () => {
	const output = [
		"Restore order fixed.",
		"",
		"- **prepare**",
		"  i. stop writers",
		"  ii. snapshot current DB",
	].join("\n");
	const report = lintOutput(output, {
		expectedShape: "markdown",
		minOrderedItems: 2,
	});
	assert.equal(report.pass, false);
	assert.match(report.errors.join("\n"), /ordered items 0 < 2/);
});

test("rejects parenthesized numbers when decimal-period steps required", () => {
	const output = [
		"Restore order fixed.",
		"",
		"- **prepare**",
		"  1) stop writers",
		"  2) snapshot current DB",
	].join("\n");
	const report = lintOutput(output, {
		expectedShape: "markdown",
		minOrderedItems: 2,
	});
	assert.equal(report.pass, false);
	assert.match(report.errors.join("\n"), /ordered items 0 < 2/);
});

test("rejects fenced output when markdown container required", () => {
	const output = "Result.\n\n```text\nproof\n  tests pass\n```";
	const report = lintOutput(output, { expectedShape: "markdown" });
	assert.equal(report.pass, false);
	assert.match(report.errors.join("\n"), /markdown container required/);
});

test("rejects non-terse close and invented abbreviation", () => {
	const output = [
		"Result.",
		"",
		"- risk",
		"  - one large fn",
		"This is a polished closing paragraph that repeats the result and explains everything all over again.",
	].join("\n");
	const report = lintOutput(output, { expectedShape: "markdown" });
	assert.equal(report.pass, false);
	assert.match(report.errors.join("\n"), /close not terse/);
	assert.match(report.errors.join("\n"), /invented abbreviation: fn/);
});

test("fenced regression remains rejected", async () => {
	const path = resolve("evals/fixtures/review-rust-quality-bad.txt");
	const output = await readFile(path, "utf8");
	const report = lintOutput(output, {
		expectedShape: "markdown",
	});
	assert.equal(report.pass, false);
	assert.match(report.errors.join("\n"), /markdown container required/);
	assert.match(report.errors.join("\n"), /parent has >5 children/);
	assert.match(report.errors.join("\n"), /close exceeds 1 line/);
	assert.match(report.errors.join("\n"), /invented abbreviation: fn/);
});

test("rejects repeated horizontal packing from artifact capture", async () => {
	const path = resolve("evals/fixtures/artifact-explanation-packed.txt");
	const output = await readFile(path, "utf8");
	const report = lintOutput(output, {
		expectedShape: "markdown",
		maxBodyLines: 42,
	});
	assert.equal(report.pass, false);
	assert.match(report.errors.join("\n"), /prose length \d+ > 100/);
	assert.match(report.errors.join("\n"), /overlong prose lines \d+ > 2/);
});

test("accepts semantically nested artifact handoff", async () => {
	const path = resolve("evals/gold/artifact-explanation.txt");
	const output = await readFile(path, "utf8");
	const report = lintOutput(output, {
		expectedShape: "markdown",
		maxBodyLines: 42,
	});
	assert.equal(report.pass, true, report.errors.join("\n"));
	assert.equal(report.metrics.bodyLines, 42);
	assert.equal(report.metrics.maxDepth, 3);
	assert.equal(report.metrics.longProseLines, 0);
});
