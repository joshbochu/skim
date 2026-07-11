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

test("rejects more than 5 top-level anchors", () => {
	const output = "Result.\n\n```text\na\nb\nc\nd\ne\nf\n```";
	const report = lintOutput(output, { expectedShape: "block" });
	assert.equal(report.pass, false);
	assert.match(report.errors.join("\n"), /top-level anchors 6 > 5/);
});

test("rejects more than 5 children", () => {
	const output = "Result.\n\n```text\nroot\n  a\n  b\n  c\n  d\n  e\n  f\n```";
	const report = lintOutput(output, { expectedShape: "block" });
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
		"```text",
		"risk",
		"  one large fn",
		"```",
		"This is a polished closing paragraph that repeats the result and explains everything all over again.",
	].join("\n");
	const report = lintOutput(output, { expectedShape: "block" });
	assert.equal(report.pass, false);
	assert.match(report.errors.join("\n"), /close not terse/);
	assert.match(report.errors.join("\n"), /invented abbreviation: fn/);
});

test("real fence-off failure remains rejected", async () => {
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
