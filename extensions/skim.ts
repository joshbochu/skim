/**
 * @joshbochu/skim — max info per reader-effort
 *
 * A pi extension that formats agent output for high density and
 * low cognitive load: Caveman-full wording, one fact per line,
 * logic symbols, and at most 5 top-level anchors.
 * https://github.com/joshbochu/skim
 *
 * Commands:
 *   /skim           Toggle skim on/off
 *   /skim on v2     Enable persistent skim-v2 mode
 *   /skim capture   Save last prompt/response for later improvement
 *   /skim off       Disable (aliases: stop, quit)
 *
 * Mode persists across sessions via ~/.pi/agent/skim.json.
 * Rules are re-read from rules/ on every turn.
 * Edits apply to the next message without reinstalling.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
	createCaptureRecord,
	findLatestExchange,
	fingerprintText,
	getAgentDir,
	saveCapture,
} from "./skim-capture.mjs";
import {
	normalizeMode,
	parseSkimCommand,
	stripFrontmatter,
} from "./skim-mode.mjs";

type Mode = "off" | "on" | "v2";

const COMMAND_OPTIONS = [
	{
		value: "on",
		label: "on",
		description: "Enable stable skim",
	},
	{
		value: "on v2",
		label: "on v2",
		description: "Enable persistent skim-v2",
	},
	{
		value: "off",
		label: "off",
		description: "Disable skim",
	},
	{
		value: "capture",
		label: "capture",
		description: "Save last prompt and response for later improvement",
	},
] as const;

// ------------------------------------------------------------------
// Persistent config (survives across sessions)
// ------------------------------------------------------------------

interface SkimConfig {
	/** Mode applied to new sessions. "off" means don't auto-enable. */
	defaultMode: Mode;
	/** Optional override path to the skim-core rules file. */
	rulesPath?: string;
	/** Optional override path to the Caveman-full wording rules file. */
	ultraPath?: string;
	/** Optional override path to the skim-v2 skill file. */
	v2Path?: string;
}

const CONFIG_PATH = join(getAgentDir(), "skim.json");
const DEFAULT_CONFIG: SkimConfig = {
	defaultMode: "off",
};

async function loadConfig(): Promise<SkimConfig> {
	try {
		const parsed = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
		const defaultMode =
			normalizeMode(parsed.defaultMode) ?? DEFAULT_CONFIG.defaultMode;
		const rulesPath =
			typeof parsed.rulesPath === "string" ? parsed.rulesPath : undefined;
		const ultraPath =
			typeof parsed.ultraPath === "string" ? parsed.ultraPath : undefined;
		const v2Path =
			typeof parsed.v2Path === "string" ? parsed.v2Path : undefined;
		return {
			defaultMode,
			rulesPath,
			ultraPath,
			v2Path,
		};
	} catch {
		return { ...DEFAULT_CONFIG };
	}
}

async function saveConfig(config: SkimConfig): Promise<void> {
	await mkdir(getAgentDir(), { recursive: true });
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
- Caveman-full governs wording.
- skim-core governs structure.
- Preserve necessary grammar only when omission changes meaning.

Three layout levers: vertical layout, chunking, line budget.
Skim layout is NOT permission for full sentences.

Shape:
- Headline ≤1 terse line.
- Body = native Markdown bullets.

Line grammar:
- One fact per line.
- Anchor at column 0.
- Facts indent 2 spaces below.
- Left edge carries the signal.

Line budget:
- Target 45–65 visible characters in skim blocks.
- Split before 72 characters whenever possible.
- Treat 80 characters as a hard ceiling.
- Default budget never authorizes horizontal packing.
- Body budget: 18 default; 24 requested detail or safety; 42 artifact handoff.
- Exceed 42 only for safety-critical meaning or explicitly exhaustive detail.
- CJK target ≈40 glyphs.

Exceptions:
- Stay byte-exact:
  code, commands, URLs, identifiers, errors, quoted user text.

Symbols between facts, never inside names:
→ then · ⇒ rule · ∵ because · ∴ therefore
✓ ✗ ⚠ Δ + − ? ↑ ↓ ∅ ≈ < > ≠ ×N.

Separator grammar:
- \`·\` = set members sharing one predicate.
- \`|\` = choice or alternative branch.
- \`/\` = paired labels or compact binary forms.
- \`+\` = additive composition.
- \`,\` = avoid in skim blocks.

Separator budgets:
- \`·\` run: 2–5 members.
- \`|\` run: 2–3 choices.
- Max 1 separator run per line.
- More items → subgroup.
- Subgroups must reflect real relationships.
- Never pair unrelated items to satisfy caps.

Grouping decision:
1. ≤5 peers → one flat sibling list.
2. >5 peers with real roles → subgroup by those roles.
3. No real roles → keep strongest 5 or offer another reply.
4. Never pair items merely to equalize group sizes.
Uneven groups are correct when meaning is uneven.

Chains: each →, ∵, ∴, ⚠ starts its own indented line.
Never write A → B → C on one line.
Never put 2 predicates on one line.

Structured body: 1–5 top-level anchors TOTAL.
Chunks: ≤5 lines per group, blank line between.
>5 siblings → regroup under sub-anchors.
≤3 indent levels.

Floor: <3 facts → 1–2 plain terse lines, no block.

Boundaries:
- Code, commands, error strings byte-exact.
- Commits, PRs, docs, comments normal prose.
- Keep user's language.
- Never announce the mode.`;

const ULTRA_FALLBACK = `\
Caveman-full wording
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

Quantified grammar:
- Anchor: 1–4 words.
- Child fact: 3–9 words.
- Ideal line: 45–65 chars.
- Hard line: 72 chars.
- Group: 3–5 siblings.
- Separator run: 2–5 members.
- Relation symbol: max 1 per line.
- Repeated fact: 0.

Tone target:
- Caveman-full, not polished consultant.
- Fragment OK when meaning survives.
- Drop connective tissue first.
- Keep enough grammar for instant read.

Style calibration:
Too normal:
ceiling is subjective
  → my judgment, not measured
Better:
ceiling subjective
  my judgment
  not measured

Never:
- Invent abbreviations: cfg, req, fn, impl.
- Save tokens by shifting decode cost to reader.
- Compress code, API names, CLI commands, error strings.

Ceiling:
- Compression must not change factual meaning.`;

const BRIDGE_RULES = `\
Bridge:
- Caveman-full governs every chat word.
- skim-core governs structure.
- Safety and factual meaning outrank style.
- Keep only grammar required for exact meaning.`;

const FINAL_CHECK = `\
FINAL OUTPUT CHECK:
- Active container: native Markdown bullets.
- Caveman-full wording in headline, anchors, and facts.
- Plain reply has 1–2 fact lines, or structured body has 1–5 anchors TOTAL.
- 1–5 child facts per parent.
- Count anchors plus children; body ≤18 lines by default.
- Use 24 lines for requested detail or safety; up to 42 for artifact handoff.
- Exceed 42 only for safety-critical meaning or explicitly exhaustive detail.
- Every indent and grouping reflects a real relationship.
- No polished introduction.
- No prose escape mode.`;

const MARKDOWN_FALLBACK = `\
Markdown structure:
- Use native Markdown bullets for Skim structure.
- Fenced blocks remain valid for actual code only.
- Anchors are top-level bullets with bold labels.
- Facts are nested bullets.
- One fact per line.
- 2-space indent per level.
- Same symbols and chunk caps.
- Inline code backticks allowed.

Semantic nesting target:

Artifact ready.

- **coverage**
  - **Background**
    - contracts · anatomy
    - eval harness
  - **Diagrams**
    - **structure**
      - reply anatomy
      - structure tree
    - **process**
      - eval dataflow
      - improvement loop
- ✓ **checks**
  - tests 14/14`;

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

async function loadMarkdownRules(): Promise<LoadedText> {
	const markdownPath = fileURLToPath(
		new URL("../rules/skim-markdown.md", import.meta.url),
	);
	return loadFirstText([markdownPath], MARKDOWN_FALLBACK);
}

const V2_FALLBACK = `\
Skim-v2 rules file missing.
Keep factual meaning and safety exact.
Use Caveman-Ultra wording inside native Markdown Skim layout.
Keep 1 fact per line, 1–5 top-level anchors, 1–5 children per parent,
3 levels maximum, and 18 fact lines by default.
No polished introduction. No prose escape mode.`;

async function loadV2Rules(config: SkimConfig): Promise<LoadedText> {
	const packagedPath = fileURLToPath(
		new URL("../skills/skim-v2/SKILL.md", import.meta.url),
	);
	const loaded = await loadFirstText(
		[config.v2Path, packagedPath],
		V2_FALLBACK,
	);
	return {
		text: stripFrontmatter(loaded.text),
		fromFile: loaded.fromFile,
	};
}

async function loadModeRules(
	mode: Exclude<Mode, "off">,
	config: SkimConfig,
): Promise<LoadedText> {
	return mode === "v2" ? loadV2Rules(config) : loadRules(config);
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

	async function captureLatest(note: string, ctx: ExtensionCommandContext) {
		await ctx.waitForIdle();
		const exchange = findLatestExchange(ctx.sessionManager.getBranch());
		if (!exchange) {
			ctx.ui.notify("Nothing to capture yet.", "error");
			return;
		}

		try {
			const activeMode = mode === "off" ? "on" : mode;
			const { text: rulesText } = await loadModeRules(activeMode, config);
			const record = createCaptureRecord({
				exchange,
				note,
				cwd: ctx.cwd,
				sessionId: ctx.sessionManager.getSessionId(),
				sessionFile: ctx.sessionManager.getSessionFile(),
				model: ctx.model
					? { provider: ctx.model.provider, id: ctx.model.id }
					: null,
				mode,
				rulesFingerprint: fingerprintText(rulesText),
			});
			const path = await saveCapture(record);
			pi.appendEntry("skim-capture", {
				id: record.id,
				path,
				note: record.note,
			});
			ctx.ui.notify(`Captured ${record.id}.`, "info");
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			ctx.ui.notify(`Capture failed: ${message}`, "error");
		}
	}

	function syncStatus(ctx: Pick<ExtensionContext, "ui">) {
		if (mode === "off") {
			ctx.ui.setStatus("skim", "");
			return;
		}
		const theme = ctx.ui.theme;
		const label = mode === "v2" ? "V2" : "ON";
		ctx.ui.setStatus(
			"skim",
			theme.fg("muted", "⇊ skim: ") + theme.fg("text", label),
		);
	}

	async function applyState(
		newMode: Mode,
		ctx: ExtensionContext,
	) {
		mode = newMode;
		pi.appendEntry("skim-mode", { mode });
		// Persist across sessions: /skim on stays on until /skim off.
		config.defaultMode = mode;
		await saveConfig(config);
		syncStatus(ctx);
		ctx.ui.notify(
			mode === "off"
				? "Skim off."
				: mode === "v2"
					? "Skim v2 on."
					: "Skim on.",
			"info",
		);
	}

	async function setMode(modeArg: Mode, ctx: ExtensionContext) {
		await applyState(modeArg, ctx);
	}

	// -- Restore state on session load --

	pi.on("session_start", async (_event, ctx) => {
		await ensureConfigLoaded();

		let sessionMode: Mode | null = null;
		for (const entry of ctx.sessionManager.getEntries()) {
			if (entry.type === "custom" && entry.customType === "skim-mode") {
				const data = entry.data as { mode?: unknown };
				const restoredMode = normalizeMode(data?.mode);
				if (restoredMode) sessionMode = restoredMode;
			}
		}

		if (sessionMode !== null) {
			mode = sessionMode;
		} else if (config.defaultMode !== "off") {
			mode = config.defaultMode;
			pi.appendEntry("skim-mode", { mode });
		}

		syncStatus(ctx);
	});

	// -- /skim command --

	pi.registerCommand("skim", {
		description:
			"Toggle skim or capture output. Args: on, on v2, off, capture [note]",
		getArgumentCompletions: (prefix: string) => {
			const normalized = prefix.trim().toLowerCase();
			const items = COMMAND_OPTIONS.filter((item) =>
				item.value.startsWith(normalized),
			);
			return items.length > 0 ? items : null;
		},
		handler: async (args, ctx) => {
			await ensureConfigLoaded();
			const command = parseSkimCommand(args, mode);

			if (command.kind === "capture") {
				await captureLatest(command.note, ctx);
			} else if (command.kind === "mode") {
				await setMode(command.mode as Mode, ctx);
			} else {
				ctx.ui.notify(
					`Unknown: "${command.value}". Use: on, on v2, off, capture`,
					"error",
				);
			}
		},
	});

	// -- Inject skim rules into system prompt on every agent run --

	pi.on("before_agent_start", async (event, ctx) => {
		await ensureConfigLoaded();
		if (mode === "off") return;

		const { text, fromFile } = await loadModeRules(mode, config);
		if (!fromFile && !warnedFallback) {
			warnedFallback = true;
			ctx.ui.notify(
				"skim: rule file missing — using fallback rules",
				"warning",
			);
		}

		const parts = [
			mode === "v2"
				? "IMPORTANT — SKIM-V2 MODE ACTIVE:"
				: "IMPORTANT — SKIM MODE ACTIVE:",
			text,
		];
		if (mode === "on") {
			const { text: markdownRules } = await loadMarkdownRules();
			parts.push(markdownRules);
			parts.push(FINAL_CHECK);
		}

		return {
			systemPrompt: `${event.systemPrompt}\n\n${parts.join("\n\n")}`,
		};
	});
}
