const STOP_ALIASES = new Set(["off", "stop", "quit"]);

export function normalizeMode(value) {
	if (value === "off" || value === "on" || value === "v2") return value;
	return null;
}

export function parseSkimCommand(args, currentMode) {
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

	if (normalized === "on") return { kind: "mode", mode: "on" };
	if (normalized === "on v2") return { kind: "mode", mode: "v2" };
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
