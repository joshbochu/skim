import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

test("release-version chooses unpublished local version without rewriting package.json", () => {
	const before = readFileSync("package.json", "utf8");
	const result = spawnSync("node", ["scripts/release-version.mjs"], {
		encoding: "utf8",
	});
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /^version=\d+\.\d+\.\d+\nchanged=false\n$/);
	assert.equal(readFileSync("package.json", "utf8"), before);
});
