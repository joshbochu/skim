import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	DEFAULT_CONFIG,
	getConfigPath,
	loadConfig,
	normalizeMode,
	normalizePrState,
	saveConfig,
} from "../extensions/skim-config.mjs";

async function withTempAgentDir(fn) {
	const dir = await mkdtemp(join(tmpdir(), "skim-config-"));
	const env = { ...process.env, PI_CODING_AGENT_DIR: dir };
	try {
		await fn(env, dir);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

test("normalizePrState accepts off, preview, auto", () => {
	assert.equal(normalizePrState("off"), "off");
	assert.equal(normalizePrState("preview"), "preview");
	assert.equal(normalizePrState("auto"), "auto");
});

test("normalizePrState rejects legacy and unknown values", () => {
	assert.equal(normalizePrState("on"), null);
	assert.equal(normalizePrState("manual"), null);
	assert.equal(normalizePrState(""), null);
	assert.equal(normalizePrState(null), null);
	assert.equal(normalizePrState(undefined), null);
	assert.equal(normalizePrState(true), null);
	assert.equal(normalizePrState({ prState: "auto" }), null);
});

test("normalizeMode is unchanged", () => {
	assert.equal(normalizeMode("on"), "on");
	assert.equal(normalizeMode("off"), "off");
	assert.equal(normalizeMode("preview"), null);
	assert.equal(normalizeMode(null), null);
});

test("DEFAULT_CONFIG is off/off out of the box", () => {
	assert.equal(DEFAULT_CONFIG.defaultMode, "off");
	assert.equal(DEFAULT_CONFIG.prState, "off");
});

test("loadConfig returns defaults when file is missing", async () => {
	await withTempAgentDir(async (env) => {
		const config = await loadConfig(env);
		assert.equal(config.defaultMode, "off");
		assert.equal(config.prState, "off");
	});
});

test("loadConfig returns defaults when file is garbage", async () => {
	await withTempAgentDir(async (env, dir) => {
		await writeFile(join(dir, "skim.json"), "this is not json", "utf8");
		const config = await loadConfig(env);
		assert.equal(config.defaultMode, "off");
		assert.equal(config.prState, "off");
	});
});

test("loadConfig accepts partial config with only prState", async () => {
	await withTempAgentDir(async (env, dir) => {
		await writeFile(
			join(dir, "skim.json"),
			JSON.stringify({ prState: "auto" }),
			"utf8",
		);
		const config = await loadConfig(env);
		assert.equal(config.defaultMode, "off");
		assert.equal(config.prState, "auto");
	});
});

test("loadConfig ignores unknown prState values", async () => {
	await withTempAgentDir(async (env, dir) => {
		await writeFile(
			join(dir, "skim.json"),
			JSON.stringify({ prState: "manual", defaultMode: "on" }),
			"utf8",
		);
		const config = await loadConfig(env);
		assert.equal(config.prState, "off");
		assert.equal(config.defaultMode, "on");
	});
});

test("saveConfig → loadConfig round-trips all three PR states", async () => {
	for (const prState of /** @type {const} */ (["off", "preview", "auto"])) {
		await withTempAgentDir(async (env) => {
			await saveConfig(
				{ defaultMode: "on", prState, rulesPath: "/tmp/rules.md" },
				env,
			);
			const loaded = await loadConfig(env);
			assert.equal(loaded.prState, prState);
			assert.equal(loaded.defaultMode, "on");
			assert.equal(loaded.rulesPath, "/tmp/rules.md");
		});
	}
});

test("saveConfig writes pretty JSON with trailing newline", async () => {
	await withTempAgentDir(async (env) => {
		await saveConfig(
			{ defaultMode: "off", prState: "preview" },
			env,
		);
		const raw = await readFile(getConfigPath(env), "utf8");
		assert.ok(raw.endsWith("\n"), "expected trailing newline");
		assert.match(raw, /"prState": "preview"/);
		assert.deepEqual(JSON.parse(raw), {
			defaultMode: "off",
			prState: "preview",
		});
	});
});

test("saveConfig creates the agent directory if missing", async () => {
	await withTempAgentDir(async (env, dir) => {
		const nested = join(dir, "nested", "deeper");
		const nestedEnv = { ...env, PI_CODING_AGENT_DIR: nested };
		await saveConfig(
			{ defaultMode: "off", prState: "auto" },
			nestedEnv,
		);
		const loaded = await loadConfig(nestedEnv);
		assert.equal(loaded.prState, "auto");
	});
});

test("getConfigPath honors PI_CODING_AGENT_DIR", () => {
	assert.equal(
		getConfigPath({ PI_CODING_AGENT_DIR: "/tmp/pi-agent" }),
		"/tmp/pi-agent/skim.json",
	);
});
