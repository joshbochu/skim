import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export function getAgentDir(env = process.env) {
	return env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
}

export function getCaptureDir(env = process.env) {
	return join(getAgentDir(env), "skim", "captures");
}

export function messageText(message) {
	if (!message || typeof message !== "object") return "";
	if (typeof message.content === "string") return message.content;
	if (!Array.isArray(message.content)) return "";
	return message.content
		.filter((item) => item?.type === "text" && typeof item.text === "string")
		.map((item) => item.text)
		.join("\n");
}

export function findLatestExchange(entries) {
	let assistantIndex = -1;
	let assistantEntry;
	let output = "";

	for (let index = entries.length - 1; index >= 0; index -= 1) {
		const entry = entries[index];
		if (entry?.type !== "message" || entry.message?.role !== "assistant") continue;
		const text = messageText(entry.message);
		if (!text.trim()) continue;
		assistantIndex = index;
		assistantEntry = entry;
		output = text;
		break;
	}

	if (assistantIndex < 0) return null;

	for (let index = assistantIndex - 1; index >= 0; index -= 1) {
		const entry = entries[index];
		if (entry?.type !== "message" || entry.message?.role !== "user") continue;
		const prompt = messageText(entry.message);
		if (!prompt.trim()) continue;
		return {
			prompt,
			output,
			userEntryId: entry.id,
			assistantEntryId: assistantEntry.id,
			assistantStopReason: assistantEntry.message.stopReason ?? null,
		};
	}

	return null;
}

export function fingerprintText(text) {
	return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export function createCaptureRecord({
	exchange,
	note,
	cwd,
	sessionId,
	sessionFile,
	model,
	mode,
	rulesFingerprint,
	now = new Date(),
	uuid = randomUUID(),
}) {
	const timestamp = now.toISOString();
	const compactTime = timestamp.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
	const id = `skim-${compactTime}-${uuid.slice(0, 8)}`;
	return {
		schemaVersion: 1,
		id,
		capturedAt: timestamp,
		status: "unreviewed",
		note: note?.trim() || null,
		source: {
			cwd,
			sessionId: sessionId ?? null,
			sessionFile: sessionFile ?? null,
			model: model ?? null,
			mode,
			rulesFingerprint,
		},
		interaction: exchange,
	};
}

export async function saveCapture(record, captureDir = getCaptureDir()) {
	await mkdir(captureDir, { recursive: true });
	const finalPath = join(captureDir, `${record.id}.json`);
	const temporaryPath = `${finalPath}.tmp-${randomUUID().slice(0, 8)}`;
	await writeFile(temporaryPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
	await rename(temporaryPath, finalPath);
	return finalPath;
}
