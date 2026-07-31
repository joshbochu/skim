const STOP_ALIASES = new Set(["off", "stop", "quit"]);

/**
 * Hardcoded OFF: users only see regular skim (on/off/capture/pr).
 * Leave true for internal experiments that expose `/skim on v2`.
 * Infrastructure (skills/skim-v2, loadV2Rules, compare evals) stays in place.
 */
export const ENABLE_VERSION_OPTIONS = false;

export function normalizeMode(value, { allowV2 = ENABLE_VERSION_OPTIONS } = {}) {
	if (value === "off" || value === "on") return value;
	if (value === "v2") return allowV2 ? "v2" : "on";
	return null;
}

export function parseSkimCommand(
	args,
	currentMode,
	{ allowV2 = ENABLE_VERSION_OPTIONS } = {},
) {
	const raw = args?.trim() ?? "";
	const normalized = raw.toLowerCase().replace(/\s+/g, " ");

	if (!normalized) {
		return {
			kind: "mode",
			mode: currentMode === "off" ? "on" : "off",
		};
	}

	const [primary = ""] = normalized.split(" ", 1);
	if (primary === "capture") {
		return {
			kind: "capture",
			note: raw.slice(raw.search(/\s|$/)).trim(),
		};
	}

	if (primary === "pr") {
		const firstSpace = raw.search(/\s/);
		return {
			kind: "pr",
			target: firstSpace === -1 ? "" : raw.slice(firstSpace).trim(),
		};
	}

	if (normalized === "on") return { kind: "mode", mode: "on" };
	if (normalized === "on v2") {
		if (!allowV2) return { kind: "error", value: normalized };
		return { kind: "mode", mode: "v2" };
	}
	if (STOP_ALIASES.has(normalized)) return { kind: "mode", mode: "off" };

	return { kind: "error", value: normalized };
}

export function stripFrontmatter(text) {
	const normalized = text.replace(/^\uFEFF/, "");
	if (!normalized.startsWith("---")) return normalized.trim();
	const match = normalized.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
	if (!match) return normalized.trim();
	return normalized.slice(match[0].length).trim();
}

export function getCommandOptions({ allowV2 = ENABLE_VERSION_OPTIONS } = {}) {
	const options = [
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
		{
			value: "pr",
			label: "pr",
			description: "Reshape and update a PR body. Optional: GitHub PR URL",
		},
	];
	if (allowV2) {
		options.splice(1, 0, {
			value: "on v2",
			label: "on v2",
			description: "Enable persistent skim-v2",
		});
	}
	return options;
}

export function commandUsage({ allowV2 = ENABLE_VERSION_OPTIONS } = {}) {
	return allowV2
		? "on, on v2, off, capture, pr"
		: "on, off, capture, pr";
}
