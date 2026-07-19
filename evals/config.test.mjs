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

test("normalizeMode accepts only on and off", () => {
	assert.equal(normalizeMode("on"), "on");
	assert.equal(normalizeMode("off"), "off");
	assert.equal(normalizeMode("preview"), null);
	assert.equal(normalizeMode(null), null);
});

test("DEFAULT_CONFIG starts with chat skim off", () => {
	assert.deepEqual(DEFAULT_CONFIG, { defaultMode: "off" });
});

test("loadConfig returns defaults when file is missing", async () => {
	await withTempAgentDir(async (env) => {
		assert.deepEqual(await loadConfig(env), { defaultMode: "off" });
	});
});

test("loadConfig returns defaults when file is garbage", async () => {
	await withTempAgentDir(async (env, dir) => {
		await writeFile(join(dir, "skim.json"), "this is not json", "utf8");
		assert.deepEqual(await loadConfig(env), { defaultMode: "off" });
	});
});

test("loadConfig ignores legacy prState", async () => {
	await withTempAgentDir(async (env, dir) => {
		await writeFile(
			join(dir, "skim.json"),
			JSON.stringify({ defaultMode: "on", prState: "auto" }),
			"utf8",
		);
		assert.deepEqual(await loadConfig(env), {
			defaultMode: "on",
			rulesPath: undefined,
			ultraPath: undefined,
			prRulesPath: undefined,
		});
	});
});

test("saveConfig round-trips optional rule paths", async () => {
	await withTempAgentDir(async (env) => {
		await saveConfig(
			{
				defaultMode: "on",
				rulesPath: "/tmp/rules.md",
				prRulesPath: "/tmp/pr-rules.md",
			},
			env,
		);
		const loaded = await loadConfig(env);
		assert.equal(loaded.defaultMode, "on");
		assert.equal(loaded.rulesPath, "/tmp/rules.md");
		assert.equal(loaded.prRulesPath, "/tmp/pr-rules.md");
	});
});

test("saveConfig writes pretty JSON with trailing newline", async () => {
	await withTempAgentDir(async (env) => {
		await saveConfig({ defaultMode: "off" }, env);
		const raw = await readFile(getConfigPath(env), "utf8");
		assert.ok(raw.endsWith("\n"), "expected trailing newline");
		assert.deepEqual(JSON.parse(raw), { defaultMode: "off" });
	});
});

test("saveConfig creates the agent directory if missing", async () => {
	await withTempAgentDir(async (env, dir) => {
		const nestedEnv = {
			...env,
			PI_CODING_AGENT_DIR: join(dir, "nested", "deeper"),
		};
		await saveConfig({ defaultMode: "off" }, nestedEnv);
		assert.deepEqual(await loadConfig(nestedEnv), {
			defaultMode: "off",
			rulesPath: undefined,
			ultraPath: undefined,
			prRulesPath: undefined,
		});
	});
});

test("getConfigPath honors PI_CODING_AGENT_DIR", () => {
	assert.equal(
		getConfigPath({ PI_CODING_AGENT_DIR: "/tmp/pi-agent" }),
		"/tmp/pi-agent/skim.json",
	);
});
