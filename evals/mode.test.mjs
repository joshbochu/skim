import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
	ENABLE_VERSION_OPTIONS,
	commandUsage,
	getCommandOptions,
	normalizeMode,
	parseSkimCommand,
	stripFrontmatter,
} from "../extensions/skim-mode.mjs";

test("version options stay hardcoded off for users", () => {
	assert.equal(ENABLE_VERSION_OPTIONS, false);
	assert.deepEqual(
		getCommandOptions().map((item) => item.value),
		["on", "off", "capture", "pr"],
	);
	assert.equal(commandUsage(), "on, off, capture, pr");
});

test("normalizes modes and coerces persisted v2 when version options are off", () => {
	assert.equal(normalizeMode("off"), "off");
	assert.equal(normalizeMode("on"), "on");
	assert.equal(normalizeMode("v2"), "on");
	assert.equal(normalizeMode("v2", { allowV2: true }), "v2");
	assert.equal(normalizeMode("experimental"), null);
});

test("plain skim toggles stable mode only", () => {
	assert.deepEqual(parseSkimCommand("", "off"), {
		kind: "mode",
		mode: "on",
	});
	assert.deepEqual(parseSkimCommand("", "on"), {
		kind: "mode",
		mode: "off",
	});
	assert.deepEqual(parseSkimCommand("", "v2"), {
		kind: "mode",
		mode: "off",
	});
});

test("explicit on v2 is hidden when version options are off", () => {
	assert.deepEqual(parseSkimCommand("on", "on"), {
		kind: "mode",
		mode: "on",
	});
	assert.deepEqual(parseSkimCommand("  ON   V2  ", "on"), {
		kind: "error",
		value: "on v2",
	});
	assert.deepEqual(parseSkimCommand("off", "on"), {
		kind: "mode",
		mode: "off",
	});
});

test("version-option infrastructure still parses on v2 when enabled", () => {
	assert.deepEqual(parseSkimCommand("on v2", "on", { allowV2: true }), {
		kind: "mode",
		mode: "v2",
	});
	assert.deepEqual(
		getCommandOptions({ allowV2: true }).map((item) => item.value),
		["on", "on v2", "off", "capture", "pr"],
	);
	assert.equal(
		commandUsage({ allowV2: true }),
		"on, on v2, off, capture, pr",
	);
});

test("capture preserves note text and obsolete experimental syntax fails", () => {
	assert.deepEqual(parseSkimCommand("capture Too Much Prose", "on"), {
		kind: "capture",
		note: "Too Much Prose",
	});
	assert.deepEqual(parseSkimCommand("on --experimental", "on"), {
		kind: "error",
		value: "on --experimental",
	});
});

test("pr command is one-shot with optional URL target", () => {
	assert.deepEqual(parseSkimCommand("pr", "off"), {
		kind: "pr",
		target: "",
	});
	assert.deepEqual(
		parseSkimCommand("pr https://github.com/joshbochu/skim/pull/2", "on"),
		{
			kind: "pr",
			target: "https://github.com/joshbochu/skim/pull/2",
		},
	);
	assert.deepEqual(parseSkimCommand("PR preview", "v2"), {
		kind: "pr",
		target: "preview",
	});
});

test("strips skill frontmatter before prompt injection", () => {
	assert.equal(
		stripFrontmatter("---\nname: skim-v2\n---\n\n# Skim v2\n"),
		"# Skim v2",
	);
});

test("extension keeps v2 loader infrastructure behind the feature flag", async () => {
	const extension = await readFile("extensions/skim.ts", "utf8");
	const modeHelper = await readFile("extensions/skim-mode.mjs", "utf8");
	assert.ok(extension.includes('new URL("../skills/skim-v2/SKILL.md"'));
	assert.ok(extension.includes('mode === "v2" ? loadV2Rules(config)'));
	assert.ok(extension.includes("ENABLE_VERSION_OPTIONS"));
	assert.ok(modeHelper.includes("ENABLE_VERSION_OPTIONS = false"));
	assert.ok(modeHelper.includes('"on v2"'));
});

test("stable skill carries promoted Caveman-Ultra contract", async () => {
	const skill = await readFile("skills/skim/SKILL.md", "utf8");
	const cues = [
		"name: skim",
		"Caveman-Ultra",
		"Full Explanation Please",
		"parent make",
		"child see",
		"reference stay",
		"1–5 top-level anchors",
		"Layout arithmetic confirmed before wording",
		"Numbered actions never appear at top level",
	];
	for (const cue of cues) {
		assert.ok(skill.includes(cue), `stable skill missing: ${cue}`);
	}
});

test("extension wires one-shot skim-pr command", async () => {
	const extension = await readFile("extensions/skim.ts", "utf8");
	assert.ok(extension.includes('new URL("../rules/skim-pr.md"'));
	assert.ok(extension.includes("buildPrCommand"));
	assert.ok(extension.includes("pendingPrRules"));
	assert.ok(extension.includes("ONE-SHOT SKIM PR COMMAND"));
});
