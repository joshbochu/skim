import { createHash } from "node:crypto";

export function stripFrontmatter(text) {
	const normalized = text.replace(/^\uFEFF/, "");
	if (!normalized.startsWith("---")) return normalized.trim();
	const match = normalized.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
	if (!match) return normalized.trim();
	return normalized.slice(match[0].length).trim();
}

export function safeLabel(value) {
	return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "");
}

export function deterministicBit(...parts) {
	const digest = createHash("sha256").update(parts.join("\u0000")).digest();
	return digest[0] & 1;
}

export function makeBlindMapping(caseId, run, seed = "skim-compare-v1") {
	return deterministicBit(seed, caseId, String(run), "blind") === 0
		? { A: "stable", B: "candidate" }
		: { A: "candidate", B: "stable" };
}

export function makeGenerationOrder(caseId, run, seed = "skim-compare-v1") {
	return deterministicBit(seed, caseId, String(run), "generation") === 0
		? ["stable", "candidate"]
		: ["candidate", "stable"];
}

function contentText(content) {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter((item) => item?.type === "text" && typeof item.text === "string")
		.map((item) => item.text)
		.join("");
}

export function parsePiJson(raw) {
	const events = [];
	const parseErrors = [];
	for (const [index, line] of raw.split(/\r?\n/).entries()) {
		if (!line.trim()) continue;
		try {
			events.push(JSON.parse(line));
		} catch (error) {
			parseErrors.push(`line ${index + 1}: ${error.message}`);
		}
	}

	const assistantEnds = events.filter(
		(event) => event.type === "message_end" && event.message?.role === "assistant",
	);
	const fallback = [...events].reverse().find(
		(event) => event.message?.role === "assistant" && contentText(event.message.content),
	);
	const event = assistantEnds.at(-1) ?? fallback;
	if (!event) {
		return {
			text: "",
			provider: null,
			model: null,
			usage: null,
			stopReason: null,
			parseErrors: [...parseErrors, "assistant message_end event missing"],
		};
	}

	return {
		text: contentText(event.message.content).trim(),
		provider: event.message.provider ?? null,
		model: event.message.model ?? null,
		usage: event.message.usage ?? null,
		stopReason: event.message.stopReason ?? null,
		parseErrors,
	};
}

function extractJsonObject(raw) {
	const unfenced = raw
		.trim()
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```$/i, "");
	const start = unfenced.indexOf("{");
	const end = unfenced.lastIndexOf("}");
	if (start === -1 || end < start) throw new Error("JSON object missing");
	return unfenced.slice(start, end + 1);
}

export function parseJudgeJson(raw, assertionIds = []) {
	const parsed = JSON.parse(extractJsonObject(raw));
	const assertions = parsed.assertions ?? {};
	const normalized = {};
	for (const label of ["A", "B"]) {
		const byId = new Map(
			(Array.isArray(assertions[label]) ? assertions[label] : [])
				.filter((item) => typeof item?.id === "string")
				.map((item) => [item.id, item]),
		);
		normalized[label] = assertionIds.map((id) => {
			const item = byId.get(id);
			return {
				id,
				pass: item?.pass === true,
				evidence: typeof item?.evidence === "string" ? item.evidence : "",
			};
		});
	}

	const winner = ["A", "B", "tie"].includes(parsed.preference?.winner)
		? parsed.preference.winner
		: "tie";
	const confidence = ["low", "medium", "high"].includes(
		parsed.preference?.confidence,
	)
		? parsed.preference.confidence
		: "low";
	const reasons = Array.isArray(parsed.preference?.reasons)
		? parsed.preference.reasons.filter((reason) => typeof reason === "string")
		: [];

	return {
		assertions: normalized,
		preference: { winner, confidence, reasons },
	};
}

function failedAssertions(result, label) {
	return (result.assertions?.[label] ?? []).filter((item) => !item.pass).length;
}

function mechanicalErrors(output) {
	return output?.lint?.pass ? 0 : Math.max(output?.lint?.errors?.length ?? 0, 1);
}

export function adjudicateJudgeResult({ result, mapping, outputs }) {
	const rawPreference = { ...result.preference };
	const semanticFailures = {
		A: failedAssertions(result, "A"),
		B: failedAssertions(result, "B"),
	};
	const mechanical = Object.fromEntries(["A", "B"].map((label) => {
		const output = outputs[mapping[label]];
		return [label, {
			pass: output?.lint?.pass === true,
			errors: mechanicalErrors(output),
		}];
	}));

	let winner = rawPreference.winner;
	let adjudicatedBy = null;
	let reason = null;

	if (semanticFailures.A !== semanticFailures.B) {
		winner = semanticFailures.A < semanticFailures.B ? "A" : "B";
		adjudicatedBy = "semantic-hard-gate";
		reason = `Hard gate: ${winner} has fewer failed semantic assertions.`;
	} else if (mechanical.A.pass !== mechanical.B.pass) {
		winner = mechanical.A.pass ? "A" : "B";
		adjudicatedBy = "mechanical-hard-gate";
		reason = `Hard gate: ${winner} passes mechanical constraints; other output fails.`;
	} else if (
		!mechanical.A.pass &&
		!mechanical.B.pass &&
		mechanical.A.errors !== mechanical.B.errors
	) {
		winner = mechanical.A.errors < mechanical.B.errors ? "A" : "B";
		adjudicatedBy = "mechanical-severity";
		reason = `Hard gate: ${winner} has fewer mechanical violations.`;
	}

	return {
		...result,
		rawPreference,
		preference: {
			...result.preference,
			winner,
			adjudicatedBy,
			reasons: reason ? [reason] : result.preference.reasons,
		},
	};
}

function sum(items) {
	return items.reduce((total, value) => total + (Number(value) || 0), 0);
}

function mean(items) {
	return items.length === 0 ? 0 : sum(items) / items.length;
}

function round(value, places = 1) {
	const scale = 10 ** places;
	return Math.round(value * scale) / scale;
}

function usageValue(result, key) {
	return Number(result.usage?.[key]) || 0;
}

export function aggregateComparison({ config, pairs, runs, judgeEnabled }) {
	const profiles = {};
	for (const profile of ["stable", "candidate"]) {
		const results = pairs.map((pair) => pair.outputs[profile]);
		let semanticPassed = 0;
		let semanticTotal = 0;
		let judgeWins = 0;
		for (const pair of pairs) {
			if (!pair.judge?.result) continue;
			const label = Object.entries(pair.judge.mapping)
				.find(([, mappedProfile]) => mappedProfile === profile)?.[0];
			if (!label) continue;
			const grades = pair.judge.result.assertions[label] ?? [];
			semanticPassed += grades.filter((grade) => grade.pass).length;
			semanticTotal += grades.length;
			if (pair.judge.result.preference.winner === label) judgeWins += 1;
		}

		profiles[profile] = {
			label: config.profiles[profile].label,
			generations: results.length,
			callPassCount: results.filter(
				(result) => result.exitCode === 0 && result.parseErrors.length === 0,
			).length,
			mechanicalPassCount: results.filter((result) => result.lint.pass).length,
			mechanicalPassRate: results.length === 0
				? 0
				: results.filter((result) => result.lint.pass).length / results.length,
			averageWords: round(mean(results.map((result) => result.lint.metrics.words))),
			averageBodyLines: round(
				mean(results.map((result) => result.lint.metrics.bodyLines)),
			),
			averageDurationMs: round(mean(results.map((result) => result.durationMs))),
			tokens: {
				input: sum(results.map((result) => usageValue(result, "input"))),
				output: sum(results.map((result) => usageValue(result, "output"))),
				total: sum(results.map((result) => usageValue(result, "totalTokens"))),
			},
			cost: round(
				sum(results.map((result) => Number(result.usage?.cost?.total) || 0)),
				6,
			),
			semanticPassed,
			semanticTotal,
			semanticPassRate: semanticTotal === 0 ? null : semanticPassed / semanticTotal,
			judgeWins,
		};
	}

	const regressions = pairs.filter(
		(pair) => pair.outputs.stable.lint.pass && !pair.outputs.candidate.lint.pass,
	);
	const improvements = pairs.filter(
		(pair) => !pair.outputs.stable.lint.pass && pair.outputs.candidate.lint.pass,
	);
	const judgedPairs = pairs.filter((pair) => pair.judge?.result).length;
	const ties = pairs.filter((pair) => pair.judge?.result?.preference.winner === "tie").length;
	const adjudicatedPairs = pairs.filter(
		(pair) => pair.judge?.result?.preference.adjudicatedBy,
	).length;
	const judgeRuns = pairs.filter((pair) => pair.judge?.usage);
	const judge = {
		generations: judgeRuns.length,
		averageDurationMs: round(mean(judgeRuns.map((pair) => pair.judge.durationMs))),
		tokens: {
			input: sum(judgeRuns.map((pair) => Number(pair.judge.usage?.input) || 0)),
			output: sum(judgeRuns.map((pair) => Number(pair.judge.usage?.output) || 0)),
			total: sum(judgeRuns.map((pair) => Number(pair.judge.usage?.totalTokens) || 0)),
		},
		cost: round(
			sum(judgeRuns.map((pair) => Number(pair.judge.usage?.cost?.total) || 0)),
			6,
		),
	};

	let status = "observation-only";
	if (judgeEnabled && judgedPairs === pairs.length && runs < 3) {
		status = "insufficient-variance";
	} else if (judgeEnabled && judgedPairs === pairs.length && regressions.length > 0) {
		status = "hold-candidate";
	} else if (
		judgeEnabled &&
		judgedPairs === pairs.length &&
		runs >= 3 &&
		profiles.candidate.judgeWins > profiles.stable.judgeWins &&
		profiles.candidate.mechanicalPassRate >= profiles.stable.mechanicalPassRate
	) {
		status = "candidate-preferred";
	} else if (judgeEnabled && judgedPairs === pairs.length && runs >= 3) {
		status = "no-clear-winner";
	}

	return {
		profiles,
		comparison: {
			mechanicalRegressions: regressions.length,
			mechanicalImprovements: improvements.length,
			judgedPairs,
			ties,
			adjudicatedPairs,
		},
		judge,
		decision: {
			status,
			reasons: decisionReasons({ status, profiles, regressions, runs, judgeEnabled }),
		},
	};
}

function decisionReasons({ status, profiles, regressions, runs, judgeEnabled }) {
	const reasons = [];
	if (!judgeEnabled) reasons.push("Blind semantic judging not enabled.");
	if (runs < 3) reasons.push(`Only ${runs} run${runs === 1 ? "" : "s"} per case; use at least 3.`);
	if (regressions.length > 0) {
		reasons.push(`${regressions.length} candidate mechanical regression${regressions.length === 1 ? "" : "s"}.`);
	}
	if (judgeEnabled) {
		reasons.push(
			`Judge wins: candidate ${profiles.candidate.judgeWins}, stable ${profiles.stable.judgeWins}.`,
		);
	}
	if (status === "candidate-preferred") {
		reasons.push("Candidate clears matched hard gates and wins the blind judge comparison.");
	}
	return reasons;
}

export function escapeEmbeddedJson(value) {
	return JSON.stringify(value)
		.replace(/</g, "\\u003c")
		.replace(/>/g, "\\u003e")
		.replace(/&/g, "\\u0026")
		.replace(/\u2028/g, "\\u2028")
		.replace(/\u2029/g, "\\u2029");
}
