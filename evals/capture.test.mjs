import assert from "node:assert/strict";
import test from "node:test";
import {
	createCaptureRecord,
	findLatestExchange,
	fingerprintText,
	getCaptureDir,
	messageText,
} from "../extensions/skim-capture.mjs";

const messageEntry = (id, role, content, extra = {}) => ({
	type: "message",
	id,
	message: { role, content, ...extra },
});

test("extracts text from string and content blocks", () => {
	assert.equal(messageText({ content: " hello " }), " hello ");
	assert.equal(
		messageText({ content: [{ type: "text", text: "one" }, { type: "image", data: "ignored" }, { type: "text", text: "two" }] }),
		"one\ntwo",
	);
});

test("captures latest assistant response and preceding user prompt", () => {
	const entries = [
		messageEntry("u1", "user", [{ type: "text", text: "first prompt" }]),
		messageEntry("a1", "assistant", [{ type: "text", text: "first output" }], { stopReason: "stop" }),
		messageEntry("u2", "user", [{ type: "text", text: "latest prompt" }]),
		messageEntry("tool", "toolResult", [{ type: "text", text: "tool output" }]),
		messageEntry("a2", "assistant", [{ type: "text", text: "latest output" }], { stopReason: "stop" }),
	];

	assert.deepEqual(findLatestExchange(entries), {
		prompt: "latest prompt",
		output: "latest output",
		userEntryId: "u2",
		assistantEntryId: "a2",
		assistantStopReason: "stop",
	});
});

test("returns null without complete user-assistant exchange", () => {
	assert.equal(findLatestExchange([messageEntry("u1", "user", "prompt")]), null);
	assert.equal(findLatestExchange([messageEntry("a1", "assistant", "output")]), null);
});

test("creates stable capture schema", () => {
	const exchange = {
		prompt: "prompt",
		output: "output",
		userEntryId: "u1",
		assistantEntryId: "a1",
		assistantStopReason: "stop",
	};
	const record = createCaptureRecord({
		exchange,
		note: " too much prose ",
		cwd: "/repo",
		sessionId: "session-1",
		sessionFile: "/sessions/one.jsonl",
		model: { provider: "test", id: "model" },
		mode: "on",
		rulesFingerprint: "abc123",
		now: new Date("2026-07-11T12:34:56.789Z"),
		uuid: "12345678-1234-1234-1234-123456789abc",
	});

	assert.equal(record.id, "skim-20260711T123456Z-12345678");
	assert.equal(record.note, "too much prose");
	assert.equal(record.status, "unreviewed");
	assert.deepEqual(record.interaction, exchange);
	assert.equal(record.source.rulesFingerprint, "abc123");
});

test("uses Pi agent directory override", () => {
	assert.equal(
		getCaptureDir({ PI_CODING_AGENT_DIR: "/tmp/pi-agent" }),
		"/tmp/pi-agent/skim/captures",
	);
	assert.equal(fingerprintText("same"), fingerprintText("same"));
	assert.notEqual(fingerprintText("same"), fingerprintText("different"));
});
