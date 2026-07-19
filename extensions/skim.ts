/**
 * @joshbochu/skim — max info per reader-effort
 *
 * A pi extension that formats agent output for high density and
 * low cognitive load. When enabled, injects the always-on rules
 * from skills/skim-adhd-caveman-combo/SKILL.md on every agent turn.
 * https://github.com/joshbochu/skim
 *
 * Commands:
 *   /skim           Toggle skim on/off
 *   /skim capture   Save last prompt/response for later improvement
 *   /skim off       Disable (aliases: stop, quit)
 *
 * Mode persists across sessions via ~/.pi/agent/skim.json.
 * Rules are re-read from the combo skill on every turn.
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

type Mode = "off" | "on";
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
	/** Optional override path to the always-on rules skill/file. */
	rulesPath?: string;
}

const CONFIG_PATH = join(getAgentDir(), "skim.json");
const DEFAULT_CONFIG: SkimConfig = {
	defaultMode: "off",
};

function normalizeMode(value: unknown): Mode | null {
	if (value === "off" || value === "on") return value;
	return null;
}

async function loadConfig(): Promise<SkimConfig> {
	try {
		const parsed = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
		const defaultMode =
			normalizeMode(parsed.defaultMode) ?? DEFAULT_CONFIG.defaultMode;
		const rulesPath =
			typeof parsed.rulesPath === "string" ? parsed.rulesPath : undefined;
		return {
			defaultMode,
			rulesPath,
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
// Rules reload each turn from combo skill; fallback if file missing
// ------------------------------------------------------------------

const RULES_FALLBACK = `\
# Skim ADHD Caveman Combo

Treat output as a closed state machine. Default to \`DEFAULT_ULTRA\`.
Never choose a weaker style.

## Modes

### DEFAULT_ULTRA

Apply unless first nonblank user line equals exactly:

\`\`\`text
Full Explanation Please
\`\`\`

- Use Caveman-Ultra wording everywhere.
- Use 1–2 plain fact lines for fewer than 3 facts.
- Otherwise use native Markdown bullets.
- Limit structured body to 1–5 top-level anchors.
- Limit each parent to 1–5 child facts.
- Limit indentation to 3 levels.
- Limit body to 18 fact lines by default.
- Keep complete required facts; omit only lower-signal extras.

### EXPANDED_ONCE

Activate only when first nonblank user line exactly matches the trigger.
Treat trigger as control text, not answer content.

- Apply to current reply only.
- Permit complete sentences and up to 42 fact lines.
- Keep answer-first order, Skim grouping, and zero filler.
- Keep each fact once.
- Return to \`DEFAULT_ULTRA\` on next user message without trigger.

Never infer \`EXPANDED_ONCE\` from complexity, long input, safety, confusion,
repeated questions, or requests such as “explain,” “why,” or “walk through.”

## First line

Match first line to user intent:

- Direct question: answer first.
- Task: next action first.
- Diagnosis: cause first.
- Decision: verdict first.
- Completed work: result first.

No preamble, self-reference, mode announcement, recap, or closing pleasantry.

## Action handling

- Number only true ordered sequences.
- Put 1 bounded action in each numbered step.
- Keep prerequisites before dependent actions.
- Suppress unrelated tangents.
- On continuing work, restate compact state: completed step, current step,
  remaining blocker.
- End with \`Next:\` only when open work has 1 concrete next action.
- Omit invented chores when request is complete.
- Give time estimates only from evidence; use range plus main assumption.

## Caveman-Ultra wording

- Drop articles, copulas, auxiliaries, pronouns, filler, and pleasantries when
  factual meaning survives.
- Prefer fragments, short verbs, concrete nouns, and numerals.
- Keep 1 fact per line.
- Prefer 3–9 words per child fact.
- State each fact once.
- Never invent abbreviations such as \`cfg\`, \`req\`, \`fn\`, or \`impl\`.
- Keep established technical acronyms such as DB, API, and HTTP.

Preserve every word that changes truth, order, scope, or uncertainty:
\`not\`, \`may\`, \`only\`, \`unless\`, \`before\`, \`after\`, \`because\`, quantities,
units, confidence, and conditions.

When compression creates ambiguity, add only missing relation or qualifier.
Never switch whole reply to normal prose.

## Skim layout

- Optional headline: 1 terse line.
- Anchors: top-level bullets with 1–4 word bold labels.
- Facts: nested bullets, 2-space indentation.
- Target 45–65 visible characters per line.
- Split before 72 characters when possible.
- Use real semantic parent-child relationships only.
- Never pack multiple predicates onto 1 line to satisfy budgets.

Allowed relation symbols:

- \`→\` next or result
- \`⇒\` rule
- \`∵\` cause
- \`∴\` conclusion
- \`✓\` done or pass
- \`✗\` fail or missing
- \`⚠\` risk
- \`?\` unknown

Use symbols only when meaning is immediate.

## No automatic escape

- Safety may increase fact count; it never changes wording mode.
- Exactness may add local grammar; it never changes wording mode.
- Artifact completeness may exceed 18 lines; keep smallest sufficient budget.
- Security and destructive actions require explicit warnings and ordered steps
  inside Ultra style.
- Never offer expansion merely because more detail exists.

## Exact boundaries

Preserve byte-exact code, commands, URLs, identifiers, quoted user text, and
error messages. Keep commits, PR descriptions, documentation, and code
comments in their normal conventions; apply this skill to chat replies.

## Gold examples

Diagnosis:

Pool exhaustion causes test hangs.

- ✗ **cause**
  - connections never released
  - pool 5 < load≈40
- **leaks ×3**
  - auth middleware
  - report generator
  - webhook handler
- **fix**
  - wrap acquisition in \`try/finally\`
  - verify pool returns to baseline
- **Next**
  - locate auth connection acquisition

Completed work:

Auth flow fixed; tests 42/42.

- ✓ **changed**
  - \`auth.ts\` refresh logic
  - \`session.ts\` expiry handling
  - \`api.ts\` retry on 401
- ⚠ **remaining**
  - mobile client untouched

## Final check

- Mode chosen only by exact trigger?
- Answer, action, cause, verdict, or result first?
- Ultra wording everywhere in \`DEFAULT_ULTRA\`?
- Native Markdown structure valid?
- 1–5 anchors and children?
- Every grouping semantic?
- Required facts and exact text preserved?
- No autonomous prose escape?`;

interface LoadedText {
	text: string;
	fromFile: boolean;
}

function stripFrontmatter(text: string): string {
	const normalized = text.replace(/^\uFEFF/, "");
	if (!normalized.startsWith("---")) return normalized.trim();
	const match = normalized.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
	if (!match) return normalized.trim();
	return normalized.slice(match[0].length).trim();
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
	const comboSkillPath = fileURLToPath(
		new URL("../skills/skim-adhd-caveman-combo/SKILL.md", import.meta.url),
	);
	const loaded = await loadFirstText(
		[config.rulesPath, comboSkillPath],
		RULES_FALLBACK,
	);
	return {
		text: stripFrontmatter(loaded.text),
		fromFile: loaded.fromFile,
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

	async function captureLatest(note: string, ctx: ExtensionCommandContext) {
		await ctx.waitForIdle();
		const exchange = findLatestExchange(ctx.sessionManager.getBranch());
		if (!exchange) {
			ctx.ui.notify("Nothing to capture yet.", "error");
			return;
		}

		try {
			const { text: rulesText } = await loadRules(config);
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
		const label = "ON";
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
			mode === "off" ? "Skim off." : "Skim on.",
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
			"Toggle skim or capture output. Args: on, off, capture [note]",
		getArgumentCompletions: (prefix: string) => {
			const normalized = prefix.trim().toLowerCase();
			const items = COMMAND_OPTIONS.filter((item) =>
				item.value.startsWith(normalized),
			);
			return items.length > 0 ? items : null;
		},
		handler: async (args, ctx) => {
			await ensureConfigLoaded();
			const rawArg = args?.trim() ?? "";
			const arg = rawArg.toLowerCase();
			const activeMode = mode === "off" ? "on" : mode;
			const [primary = "", secondary] = arg.split(/\s+/, 2);

			if (primary === "capture") {
				const note = rawArg.slice(rawArg.split(/\s+/, 1)[0].length).trim();
				await captureLatest(note, ctx);
			} else if (!arg) {
				await applyState(mode === "off" ? activeMode : "off", ctx);
			} else if (arg === "on") {
				await setMode(activeMode, ctx);
			} else if (STOP_ALIASES.has(arg)) {
				await setMode("off", ctx);
			} else {
				ctx.ui.notify(
					`Unknown: "${arg}". Use: on, off, capture`,
					"error",
				);
			}
		},
	});

	// -- Inject combo skill rules into system prompt on every agent run --

	pi.on("before_agent_start", async (event, ctx) => {
		await ensureConfigLoaded();
		if (mode === "off") return;

		const { text, fromFile } = await loadRules(config);
		if (!fromFile && !warnedFallback) {
			warnedFallback = true;
			ctx.ui.notify(
				"skim: combo skill missing — using fallback rules",
				"warning",
			);
		}

		const parts = [
			"IMPORTANT — SKIM MODE ACTIVE:",
			"Always-on profile: skim-adhd-caveman-combo.",
			"Apply these rules to every chat reply until /skim off.",
			text,
		];

		return {
			systemPrompt: `${event.systemPrompt}\n\n${parts.join("\n\n")}`,
		};
	});
}
