import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
	normalizeMode,
	parseSkimCommand,
	stripFrontmatter,
} from "../extensions/skim-mode.mjs";

test("normalizes persistent stable and v2 modes", () => {
	assert.equal(normalizeMode("off"), "off");
	assert.equal(normalizeMode("on"), "on");
	assert.equal(normalizeMode("v2"), "v2");
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

test("explicit commands switch between exclusive stable and v2 modes", () => {
	assert.deepEqual(parseSkimCommand("on", "v2"), {
		kind: "mode",
		mode: "on",
	});
	assert.deepEqual(parseSkimCommand("  ON   V2  ", "on"), {
		kind: "mode",
		mode: "v2",
	});
	assert.deepEqual(parseSkimCommand("off", "v2"), {
		kind: "mode",
		mode: "off",
	});
});

test("capture preserves note text and obsolete experimental syntax fails", () => {
	assert.deepEqual(parseSkimCommand("capture Too Much Prose", "v2"), {
		kind: "capture",
		note: "Too Much Prose",
	});
	assert.deepEqual(parseSkimCommand("on --experimental", "on"), {
		kind: "error",
		value: "on --experimental",
	});
});

test("strips skill frontmatter before prompt injection", () => {
	assert.equal(
		stripFrontmatter("---\nname: skim-v2\n---\n\n# Skim v2\n"),
		"# Skim v2",
	);
});

test("extension loads packaged skim-v2 rules for v2 mode", async () => {
	const extension = await readFile("extensions/skim.ts", "utf8");
	assert.ok(extension.includes('new URL("../skills/skim-v2/SKILL.md"'));
	assert.ok(extension.includes('mode === "v2" ? loadV2Rules(config)'));
	assert.ok(extension.includes('"on v2"'));
});
