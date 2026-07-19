import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getAgentDir } from "./skim-capture.mjs";

/**
 * @typedef {"on" | "off"} Mode
 * @typedef {{
 *   defaultMode: Mode,
 *   rulesPath?: string,
 *   ultraPath?: string,
 *   prRulesPath?: string,
 * }} SkimConfig
 */

/** @type {SkimConfig} */
export const DEFAULT_CONFIG = {
	defaultMode: "off",
};

/**
 * @param {unknown} value
 * @returns {Mode | null}
 */
export function normalizeMode(value) {
	if (value === "off" || value === "on") return value;
	return null;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function getConfigPath(env = process.env) {
	return join(getAgentDir(env), "skim.json");
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Promise<SkimConfig>}
 */
export async function loadConfig(env = process.env) {
	const path = getConfigPath(env);
	try {
		const parsed = JSON.parse(await readFile(path, "utf8"));
		const defaultMode =
			normalizeMode(parsed.defaultMode) ?? DEFAULT_CONFIG.defaultMode;
		const rulesPath =
			typeof parsed.rulesPath === "string" ? parsed.rulesPath : undefined;
		const ultraPath =
			typeof parsed.ultraPath === "string" ? parsed.ultraPath : undefined;
		const prRulesPath =
			typeof parsed.prRulesPath === "string" ? parsed.prRulesPath : undefined;
		return {
			defaultMode,
			rulesPath,
			ultraPath,
			prRulesPath,
		};
	} catch {
		return { ...DEFAULT_CONFIG };
	}
}

/**
 * @param {SkimConfig} config
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Promise<void>}
 */
export async function saveConfig(config, env = process.env) {
	await mkdir(getAgentDir(env), { recursive: true });
	await writeFile(
		getConfigPath(env),
		JSON.stringify(config, null, 2) + "\n",
		"utf8",
	);
}
