import assert from "node:assert/strict";
import test from "node:test";
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
