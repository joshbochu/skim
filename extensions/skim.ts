/**
 * pi-skim — read down, not across
 *
 * A pi extension that formats agent output for human scanning speed:
 * vertical single-column blocks, one fact per line, logic symbols instead
 * of connective prose, 3-5 items per group. https://github.com/joshbochu/skim
 *
 * Commands:
 *   /skim           Toggle skim on/off
 *   /skim text      Enable with text sigils (default, terminal-safe)
 *   /skim emoji     Enable with colored emoji status anchors
 *   /skim fence     Container: fenced verbatim blocks (default)
 *   /skim markdown  Container: native markdown bullets (alias: md)
 *   /skim off       Disable (aliases: stop, quit)
 *
 * Mode persists across sessions via ~/.pi/agent/skim.json.
 * Rules are re-read from rules/skim-core.md on every turn, so edits to the
 * rule file apply to the next message without reinstalling.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const MODES = ["off", "text", "emoji"] as const;
type Mode = (typeof MODES)[number];
const CONTAINERS = ["fence", "markdown"] as const;
type Container = (typeof CONTAINERS)[number];
const STOP_ALIASES = new Set(["off", "stop", "quit"]);

const COMMAND_OPTIONS = [
	{ value: "text", label: "text", description: "Text sigils — terminal-safe (default)" },
	{ value: "emoji", label: "emoji", description: "Colored emoji status anchors" },
	{ value: "fence", label: "fence", description: "Fenced verbatim blocks (default)" },
	{ value: "markdown", label: "markdown", description: "Native markdown bullets (alias: md)" },
	{ value: "off", label: "off", description: "Disable skim" },
] as const;

// ---------------------------------------------------------------------------
// Persistent config (survives across sessions)
// ---------------------------------------------------------------------------

interface SkimConfig {
	/** Mode applied to new sessions. "off" means don't auto-enable. */
	defaultMode: Mode;
	/** Block container: fenced verbatim blocks or native markdown bullets. */
	container: Container;
	/** Optional override path to the skim-core rules file. */
	rulesPath?: string;
}

const CONFIG_PATH = join(homedir(), ".pi", "agent", "skim.json");
const DEFAULT_CONFIG: SkimConfig = { defaultMode: "off", container: "fence" };

async function loadConfig(): Promise<SkimConfig> {
	try {
		const parsed = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
		return {
			defaultMode: MODES.includes(parsed.defaultMode) ? parsed.defaultMode : DEFAULT_CONFIG.defaultMode,
			container: CONTAINERS.includes(parsed.container) ? parsed.container : DEFAULT_CONFIG.container,
			rulesPath: typeof parsed.rulesPath === "string" ? parsed.rulesPath : undefined,
		};
	} catch {
		return { ...DEFAULT_CONFIG };
	}
}

async function saveConfig(config: SkimConfig): Promise<void> {
	await mkdir(join(homedir(), ".pi", "agent"), { recursive: true });
	await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf8");
}

// ---------------------------------------------------------------------------
// Rules — re-read each turn so edits apply live; fallback if file missing
// ---------------------------------------------------------------------------

const RULES_FALLBACK = `\
Format every reply for scanning, not reading. Max info per reader-effort.

Shape: headline ≤2 plain sentences, then fenced single-column blocks. One fact per line. Anchor line names a thing; its facts indent 2 spaces below. Left edge carries the signal.

Telegraphy: drop articles, copulas, aux verbs, pronouns, filler. Verb-first. Numerals not number-words. Never abbreviate (cfg/req/fn shift decode cost to reader). Keep case.

Symbols between facts, never inside names: → then · ⇒ rule · ∵ because · ∴ therefore · ✓ ✗ ⚠ Δ + − ? ↑ ↓ ∅ ≈ < > ≠ ×N. \`·\` joins nouns sharing one predicate only.

Chunks: ≤5 lines per group, blank line between. >5 siblings → regroup under sub-anchors. ≤3 indent levels.

Floor: <3 facts → one plain sentence, no block. Ceiling: reader pauses to decode → too far.

Auto-clarity: plain full sentences for security warnings, irreversible-action confirmations, ambiguous step order. Resume after.

Boundaries: code, commands, error strings byte-exact. Commits, PRs, docs, comments normal prose. Keep user's language. Never announce the mode.`;

const EMOJI_ADDENDUM = `\
Emoji anchors active: left-edge status sigils become ✅ ❌ ⚠️; severity marks 🔴 🟡 🟢. \
Status at line start only — never decorative emoji. In-line logic symbols (→ ∵ ∴ Δ …) stay text.`;

const MARKDOWN_ADDENDUM = `\
Container override — markdown, not fences: NO fenced code blocks for skim structure \
(fences remain for actual code only). Anchors are top-level bullets with the label bold: \
\`- ✓ **auth.ts**\`. Facts are nested bullets, one per line, 2-space indent per level. \
All other rules unchanged: one fact per line, same symbols, same chunk caps, inline \
\`code\` backticks allowed. Example:
- ✗ **tests fail**
  - ∵ pool exhausted
  - ∵ conns never released
- ⚠ **pool** 5 < load≈40
  - → raise`;

async function loadRules(config: SkimConfig): Promise<{ rules: string; fromFile: boolean }> {
	const candidates = [
		config.rulesPath,
		fileURLToPath(new URL("../rules/skim-core.md", import.meta.url)),
	].filter((p): p is string => !!p);

	for (const path of candidates) {
		try {
			const text = (await readFile(path, "utf8")).trim();
			if (text.length > 0) return { rules: text, fromFile: true };
		} catch {
			// try next candidate
		}
	}
	return { rules: RULES_FALLBACK, fromFile: false };
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function skim(pi: ExtensionAPI) {
	let mode: Mode = "off";
	let config: SkimConfig = { ...DEFAULT_CONFIG };
	let configLoadPromise: Promise<void> | null = null;
	let warnedFallback = false;

	const ensureConfigLoaded = async () => {
		if (!configLoadPromise) {
			configLoadPromise = (async () => {
				config = await loadConfig();
				if (mode === "off" && config.defaultMode !== "off") {
					mode = config.defaultMode;
				}
			})();
		}
		await configLoadPromise;
	};

	function syncStatus(ctx: Pick<ExtensionContext, "ui">) {
		if (mode === "off") {
			ctx.ui.setStatus("skim", "");
			return;
		}
		const theme = ctx.ui.theme;
		const label = (mode === "emoji" ? "EMOJI" : "TEXT") + (config.container === "markdown" ? "·MD" : "");
		ctx.ui.setStatus("skim", theme.fg("muted", "⇊ skim: ") + theme.fg("text", label));
	}

	async function applyState(newMode: Mode, newContainer: Container, ctx: ExtensionContext) {
		mode = newMode;
		config.container = newContainer;
		pi.appendEntry("skim-mode", { mode, container: newContainer });
		// Persist across sessions: /skim on stays on until /skim off.
		config.defaultMode = mode;
		await saveConfig(config);
		syncStatus(ctx);
		ctx.ui.notify(mode === "off" ? "Skim off." : `Skim on (${mode}, ${newContainer}).`, "info");
	}

	// -- Restore state on session load --

	pi.on("session_start", async (_event, ctx) => {
		await ensureConfigLoaded();

		let sessionMode: Mode | null = null;
		for (const entry of ctx.sessionManager.getEntries()) {
			if (entry.type === "custom" && entry.customType === "skim-mode") {
				const data = entry.data as { mode: Mode; container?: Container };
				if (MODES.includes(data?.mode)) sessionMode = data.mode;
				if (data?.container && CONTAINERS.includes(data.container)) config.container = data.container;
			}
		}

		if (sessionMode !== null) {
			mode = sessionMode;
		} else if (config.defaultMode !== "off") {
			mode = config.defaultMode;
			pi.appendEntry("skim-mode", { mode, container: config.container });
		}

		syncStatus(ctx);
	});

	// -- /skim command --

	pi.registerCommand("skim", {
		description: "Toggle skim mode: vertical, symbol-dense output. Args: text, emoji, fence, markdown, off",
		getArgumentCompletions: (prefix: string) => {
			const normalized = prefix.trim().toLowerCase();
			const items = COMMAND_OPTIONS.filter((item) => item.value.startsWith(normalized));
			return items.length > 0 ? items : null;
		},
		handler: async (args, ctx) => {
			await ensureConfigLoaded();
			const arg = args?.trim().toLowerCase();
			const activeMode = mode === "off" ? "text" : mode;

			if (!arg || arg === "on") {
				await applyState(!arg && mode !== "off" ? "off" : activeMode, config.container, ctx);
			} else if (STOP_ALIASES.has(arg)) {
				await applyState("off", config.container, ctx);
			} else if (arg === "text" || arg === "emoji") {
				await applyState(arg, config.container, ctx);
			} else if (arg === "markdown" || arg === "md") {
				await applyState(activeMode, "markdown", ctx);
			} else if (arg === "fence") {
				await applyState(activeMode, "fence", ctx);
			} else {
				ctx.ui.notify(`Unknown: "${arg}". Use: on, off, text, emoji, fence, markdown`, "error");
			}
		},
	});

	// -- Inject skim rules into system prompt on every agent run --

	pi.on("before_agent_start", async (event, ctx) => {
		await ensureConfigLoaded();
		if (mode === "off") return;

		const { rules, fromFile } = await loadRules(config);
		if (!fromFile && !warnedFallback) {
			warnedFallback = true;
			ctx.ui.notify("skim: rules/skim-core.md not found — using built-in fallback rules", "warning");
		}

		const parts = ["IMPORTANT — SKIM MODE ACTIVE:", rules];
		if (mode === "emoji") parts.push(EMOJI_ADDENDUM);
		if (config.container === "markdown") parts.push(MARKDOWN_ADDENDUM);

		return {
			systemPrompt: `${event.systemPrompt}\n\n${parts.join("\n\n")}`,
		};
	});
}
