/**
 * pi-skim — max info per reader-effort
 *
 * A pi extension that formats agent output for high density and
 * low cognitive load: ultra-compressed wording, one fact per line,
 * logic symbols, and 3-5 items per group.
 * https://github.com/joshbochu/skim
 *
 * Commands:
 *   /skim           Toggle skim on/off
 *   /skim emoji     Toggle emoji anchors
 *   /skim emoji on  Enable emoji anchors
 *   /skim emoji off Disable emoji anchors
 *   /skim text      Alias for /skim emoji off
 *   /skim fence     Toggle fence/markdown containers
 *   /skim fence on  Use fenced blocks
 *   /skim fence off Use markdown bullets
 *   /skim off       Disable (aliases: stop, quit)
 *
 * Mode persists across sessions via ~/.pi/agent/skim.json.
 * Rules are re-read from rules/ on every turn.
 * Edits apply to the next message without reinstalling.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";

const MODES = ["off", "text", "emoji"] as const;
type Mode = (typeof MODES)[number];
const CONTAINERS = ["fence", "markdown"] as const;
type Container = (typeof CONTAINERS)[number];
const STOP_ALIASES = new Set(["off", "stop", "quit"]);

const COMMAND_OPTIONS = [
	{
		value: "on",
		label: "on",
		description: "Enable skim",
	},
	{
		value: "off",
		label: "off",
		description: "Disable skim",
	},
	{
		value: "emoji",
		label: "emoji",
		description: "Toggle emoji anchors; accepts on/off",
	},
	{
		value: "emoji on",
		label: "emoji on",
		description: "Enable emoji anchors",
	},
	{
		value: "emoji off",
		label: "emoji off",
		description: "Disable emoji anchors",
	},
	{
		value: "text",
		label: "text",
		description: "Alias for emoji off",
	},
	{
		value: "fence",
		label: "fence",
		description: "Toggle fence/markdown; accepts on/off",
	},
	{
		value: "fence on",
		label: "fence on",
		description: "Use fenced blocks",
	},
	{
		value: "fence off",
		label: "fence off",
		description: "Use native markdown bullets",
	},
] as const;

// ------------------------------------------------------------------
// Persistent config (survives across sessions)
// ------------------------------------------------------------------

interface SkimConfig {
	/** Mode applied to new sessions. "off" means don't auto-enable. */
	defaultMode: Mode;
	/** Block container: fenced blocks or native markdown bullets. */
	container: Container;
	/** Optional override path to the skim-core rules file. */
	rulesPath?: string;
	/** Optional override path to the ultra-max-supreme rules file. */
	ultraPath?: string;
}

const CONFIG_PATH = join(homedir(), ".pi", "agent", "skim.json");
const DEFAULT_CONFIG: SkimConfig = {
	defaultMode: "off",
	container: "fence",
};

async function loadConfig(): Promise<SkimConfig> {
	try {
		const parsed = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
		const defaultMode = MODES.includes(parsed.defaultMode)
			? parsed.defaultMode
			: DEFAULT_CONFIG.defaultMode;
		const container = CONTAINERS.includes(parsed.container)
			? parsed.container
			: DEFAULT_CONFIG.container;
		const rulesPath =
			typeof parsed.rulesPath === "string" ? parsed.rulesPath : undefined;
		const ultraPath =
			typeof parsed.ultraPath === "string" ? parsed.ultraPath : undefined;
		return {
			defaultMode,
			container,
			rulesPath,
			ultraPath,
		};
	} catch {
		return { ...DEFAULT_CONFIG };
	}
}

async function saveConfig(config: SkimConfig): Promise<void> {
	await mkdir(join(homedir(), ".pi", "agent"), { recursive: true });
	await writeFile(
		CONFIG_PATH,
		JSON.stringify(config, null, 2) + "\n",
		"utf8",
	);
}

// ------------------------------------------------------------------
// Rules reload each turn; fallback if file missing
// ------------------------------------------------------------------

const RULES_FALLBACK = `\
Format every reply for high information density and low cognitive load.
Max info per reader-effort, not min tokens.
Eye scanning is proxy, not goal.

Bridge:
- ultra-max-supreme governs wording.
- skim-core governs structure.
- Auto-Clarity overrides both.

Three layout levers: vertical layout, chunking, line budget.
Skim layout is NOT permission for full sentences.

Shape:
- Headline ≤2 plain sentences.
- Body = fenced single-column blocks.

Line grammar:
- One fact per line.
- Anchor at column 0.
- Facts indent 2 spaces below.
- Left edge carries the signal.

Line budget:
- Target 45–65 visible characters in skim blocks.
- Split before 72 characters whenever possible.
- Treat 80 characters as a hard ceiling.
- CJK target ≈40 glyphs.

Exceptions:
- Stay byte-exact:
  code, commands, URLs, identifiers, errors, quoted user text.

Symbols between facts, never inside names:
→ then · ⇒ rule · ∵ because · ∴ therefore
✓ ✗ ⚠ Δ + − ? ↑ ↓ ∅ ≈ < > ≠ ×N.
\`·\` joins nouns sharing one predicate only.

Chains: each →, ∵, ∴, ⚠ starts its own indented line.
Never write A → B → C on one line.
Never put 2 predicates on one line.

Chunks: ≤5 lines per group, blank line between.
>5 siblings → regroup under sub-anchors.
≤3 indent levels.

Floor: <3 facts → one plain sentence, no block.
Ceiling: reader pauses to decode → too far.

Auto-clarity:
- Plain full sentences for security warnings.
- Plain full sentences for irreversible-action confirmations.
- Plain full sentences for ambiguous step order.
- Resume after.

Boundaries:
- Code, commands, error strings byte-exact.
- Commits, PRs, docs, comments normal prose.
- Keep user's language.
- Never announce the mode.`;

const ULTRA_FALLBACK = `\
ultra-max-supreme
Max info per reader-effort, not min tokens.

Priority:
- Minimize cognitive load.
- Maximize information density.
- Eye scanning = proxy, not goal.

Levers, strongest first:
1. Telegraphy: drop load-free words; verb-first; noun-stack.
2. Layout: one fact per line; group by role.
3. Chunking: 3–5 items per group.
4. Symbols: instantly readable AND shorter.
5. Numerals: numerals, not number-words.

Never:
- Invent abbreviations: cfg, req, fn, impl.
- Save tokens by shifting decode cost to reader.
- Compress code, API names, CLI commands, error strings.

Ceiling:
- Stop the instant reader pauses to decode.
- Auto-Clarity beats all compression rules.`;

const BRIDGE_RULES = `\
Bridge:
- ultra-max-supreme governs wording.
- skim-core governs structure.
- If rules conflict, preserve Skim structure and symbols.
- Auto-Clarity overrides both.`;

const EMOJI_ADDENDUM = `\
Emoji anchors active:
- Left-edge status sigils become ✅ ❌ ⚠️.
- Severity marks become 🔴 🟡 🟢.
- Status at line start only.
- Never decorative emoji.
- In-line logic symbols (→ ∵ ∴ Δ …) stay text.`;

const MARKDOWN_ADDENDUM = `\
Container override — markdown, not fences:
- NO fenced code blocks for skim structure.
- Fences remain for actual code only.
- Anchors are top-level bullets with label bold:
  \`- ✓ **auth.ts**\`.
- Facts are nested bullets.
- One fact per line.
- 2-space indent per level.
- Same symbols and chunk caps.
- Inline \`code\` backticks allowed.

Example:
- ✗ **tests fail**
  - ∵ pool exhausted
  - ∵ connections never released
- ⚠ **pool** 5 < load≈40
  - → raise`;

interface LoadedText {
	text: string;
	fromFile: boolean;
}

async function loadFirstText(
	candidates: Array<string | undefined>,
	fallback: string,
): Promise<LoadedText> {
	for (const path of candidates.filter((p): p is string => !!p)) {
		try {
			const text = (await readFile(path, "utf8")).trim();
			if (text.length > 0) return { text, fromFile: true };
		} catch {
			// try next candidate
		}
	}
	return { text: fallback, fromFile: false };
}

async function loadRules(config: SkimConfig): Promise<LoadedText> {
	const corePath = fileURLToPath(
		new URL("../rules/skim-core.md", import.meta.url),
	);
	const ultraPath = fileURLToPath(
		new URL("../rules/ultra-max-supreme.md", import.meta.url),
	);
	const candidates = [
		config.rulesPath,
		corePath,
	];
	const ultraCandidates = [config.ultraPath, ultraPath];
	const core = await loadFirstText(candidates, RULES_FALLBACK);
	const ultra = await loadFirstText(ultraCandidates, ULTRA_FALLBACK);

	return {
		text: [BRIDGE_RULES, ultra.text, core.text].join("\n\n"),
		fromFile: core.fromFile && ultra.fromFile,
	};
}

// ------------------------------------------------------------------
// Extension
// ------------------------------------------------------------------

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
		const label =
			(mode === "emoji" ? "EMOJI" : "TEXT") +
			(config.container === "markdown" ? "·MD" : "");
		ctx.ui.setStatus(
			"skim",
			theme.fg("muted", "⇊ skim: ") + theme.fg("text", label),
		);
	}

	async function applyState(
		newMode: Mode,
		newContainer: Container,
		ctx: ExtensionContext,
	) {
		mode = newMode;
		config.container = newContainer;
		pi.appendEntry("skim-mode", { mode, container: newContainer });
		// Persist across sessions: /skim on stays on until /skim off.
		config.defaultMode = mode;
		await saveConfig(config);
		syncStatus(ctx);
		ctx.ui.notify(
			mode === "off" ? "Skim off." : `Skim on (${mode}, ${newContainer}).`,
			"info",
		);
	}

	async function setMode(modeArg: Mode, ctx: ExtensionContext) {
		await applyState(modeArg, config.container, ctx);
	}

	async function setContainer(
		container: Container,
		ctx: ExtensionContext,
	) {
		const activeMode = mode === "off" ? "text" : mode;
		await applyState(activeMode, container, ctx);
	}

	async function toggleEmoji(ctx: ExtensionContext) {
		await setMode(mode === "emoji" ? "text" : "emoji", ctx);
	}

	async function toggleFence(ctx: ExtensionContext) {
		await setContainer(
			config.container === "fence" ? "markdown" : "fence",
			ctx,
		);
	}

	// -- Restore state on session load --

	pi.on("session_start", async (_event, ctx) => {
		await ensureConfigLoaded();

		let sessionMode: Mode | null = null;
		for (const entry of ctx.sessionManager.getEntries()) {
			if (entry.type === "custom" && entry.customType === "skim-mode") {
				const data = entry.data as { mode: Mode; container?: Container };
				if (MODES.includes(data?.mode)) sessionMode = data.mode;
				if (data?.container && CONTAINERS.includes(data.container)) {
					config.container = data.container;
				}
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
		description:
			"Toggle skim. Args: on, off, emoji [on|off], fence [on|off]",
		getArgumentCompletions: (prefix: string) => {
			const normalized = prefix.trim().toLowerCase();
			const items = COMMAND_OPTIONS.filter((item) =>
				item.value.startsWith(normalized),
			);
			return items.length > 0 ? items : null;
		},
		handler: async (args, ctx) => {
			await ensureConfigLoaded();
			const arg = args?.trim().toLowerCase() ?? "";
			const activeMode = mode === "off" ? "text" : mode;
			const [primary, secondary] = arg.split(/\s+/, 2);

			if (!arg) {
				await applyState(
					mode === "off" ? activeMode : "off",
					config.container,
					ctx,
				);
			} else if (arg === "on") {
				await setMode(activeMode, ctx);
			} else if (STOP_ALIASES.has(arg)) {
				await setMode("off", ctx);
			} else if (arg === "text") {
				await setMode("text", ctx);
			} else if (primary === "emoji") {
				if (!secondary) {
					await toggleEmoji(ctx);
				} else if (secondary === "on") {
					await setMode("emoji", ctx);
				} else if (secondary === "off") {
					await setMode("text", ctx);
				} else {
					ctx.ui.notify('Use: /skim emoji [on|off]', "error");
				}
			} else if (primary === "fence") {
				if (!secondary) {
					await toggleFence(ctx);
				} else if (secondary === "on") {
					await setContainer("fence", ctx);
				} else if (secondary === "off") {
					await setContainer("markdown", ctx);
				} else {
					ctx.ui.notify('Use: /skim fence [on|off]', "error");
				}
			} else {
				ctx.ui.notify(
					`Unknown: "${arg}". Use: on, off, emoji, fence`,
					"error",
				);
			}
		},
	});

	// -- Inject skim rules into system prompt on every agent run --

	pi.on("before_agent_start", async (event, ctx) => {
		await ensureConfigLoaded();
		if (mode === "off") return;

		const { text, fromFile } = await loadRules(config);
		if (!fromFile && !warnedFallback) {
			warnedFallback = true;
			ctx.ui.notify(
				"skim: rule file missing — using fallback rules",
				"warning",
			);
		}

		const parts = ["IMPORTANT — SKIM MODE ACTIVE:", text];
		if (mode === "emoji") parts.push(EMOJI_ADDENDUM);
		if (config.container === "markdown") parts.push(MARKDOWN_ADDENDUM);

		return {
			systemPrompt: `${event.systemPrompt}\n\n${parts.join("\n\n")}`,
		};
	});
}
