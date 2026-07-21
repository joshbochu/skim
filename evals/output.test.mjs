import assert from "node:assert/strict";
import test from "node:test";
import { unwrapTextFences } from "../extensions/skim-output.mjs";

test("unwraps a fenced text response", () => {
	const output = "```text\n- **result**\n  - tests pass\n```";
	assert.equal(unwrapTextFences(output), "- **result**\n  - tests pass");
});

test("preserves headline and trailing close", () => {
	const output = [
		"Result ready.",
		"",
		"```text",
		"- **proof**",
		"  - tests pass",
		"```",
		"Ready for review.",
	].join("\n");
	assert.equal(
		unwrapTextFences(output),
		[
			"Result ready.",
			"",
			"- **proof**",
			"  - tests pass",
			"Ready for review.",
		].join("\n"),
	);
});

test("unwraps multiple text fences", () => {
	const output = "```text\nfirst\n```\n\n```text\nsecond\n```";
	assert.equal(unwrapTextFences(output), "first\n\nsecond");
});

test("preserves actual code fences", () => {
	const output = "```sh\nnpm test\n```\n\n```typescript\nconst ok = true;\n```";
	assert.equal(unwrapTextFences(output), output);
});

test("preserves nested code fences inside a longer text fence", () => {
	const output = "````text\n```sh\nnpm test\n```\n````";
	assert.equal(unwrapTextFences(output), "```sh\nnpm test\n```");
});

test("leaves ordinary Markdown unchanged", () => {
	const output = "Result ready.\n\n- **proof**\n  - tests pass";
	assert.equal(unwrapTextFences(output), output);
});
