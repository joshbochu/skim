#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { lintOutput } from "./lint.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

function option(args, name, fallback) {
	const index = args.indexOf(name);
	return index === -1 ? fallback : args[index + 1];
}

function safeLabel(value) {
	return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "");
}

function stripFrontmatter(text) {
	const normalized = text.replace(/^\uFEFF/, "");
	if (!normalized.startsWith("---")) return normalized.trim();
	const match = normalized.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
	if (!match) return normalized.trim();
	return normalized.slice(match[0].length).trim();
}

async function buildPrompt(args) {
	const promptFile = option(args, "--prompt-file");
	if (promptFile) return (await readFile(resolve(promptFile), "utf8")).trim();

	const profile = option(args, "--profile", "classic");
	if (profile === "skim-v2") {
		const skill = await readFile(
			resolve(ROOT, "skills/skim-v2/SKILL.md"),
			"utf8",
		);
		return [
			"IMPORTANT — SKIM MODE ACTIVE",
			"Active profile: skim-v2.",
			"Apply these rules to this reply.",
			stripFrontmatter(skill),
		].join("\n\n");
	}

	const wording = await readFile(resolve(ROOT, "rules/ultra-max-supreme.md"), "utf8");
	const structure = await readFile(resolve(ROOT, "rules/skim-core.md"), "utf8");
	const parts = [
		"IMPORTANT — SKIM MODE ACTIVE",
		"Caveman-full governs every chat word. Skim governs structure.",
		wording.trim(),
		structure.trim(),
	];
	const markdown = await readFile(resolve(ROOT, "rules/skim-markdown.md"), "utf8");
	parts.push(markdown.trim());
	parts.push("FINAL CHECK: Caveman wording everywhere; plain reply has 1–2 fact lines or structured body has 1–5 top-level anchors; 1–5 children per parent; count anchors plus children; use 18, 24, or 42 as smallest sufficient fact-line budget; exceed 42 only for safety-critical meaning or explicitly exhaustive detail; select strongest evidence instead of overflowing; no polished introduction; no prose escape mode.");
	return parts.join("\n\n");
}

async function main() {
	const args = process.argv.slice(2);
	const dryRun = args.includes("--dry-run");
	const runs = Number(option(args, "--runs", "3"));
	const caseFilter = option(args, "--case");
	const provider = option(args, "--provider");
	const model = option(args, "--model");
	const piPath = option(args, "--pi", "pi");
	const label = safeLabel(option(args, "--label", "candidate"));
	const casesFile = resolve(
		ROOT,
		option(args, "--cases-file", "evals/cases.json"),
	);
	if (!Number.isInteger(runs) || runs < 1) throw new Error("--runs must be a positive integer");

	const allCases = JSON.parse(await readFile(casesFile, "utf8"));
	const cases = caseFilter
		? allCases.filter((testCase) => testCase.id === caseFilter)
		: allCases;
	if (cases.length === 0) throw new Error(`Unknown case: ${caseFilter}`);
	const systemPrompt = await buildPrompt(args);

	if (dryRun) {
		console.log(`cases=${cases.length}`);
		console.log(`runs=${runs}`);
		console.log(`generations=${cases.length * runs}`);
		console.log(`casesFile=${casesFile}`);
		console.log(`promptChars=${systemPrompt.length}`);
		console.log(`provider=${provider ?? "Pi default"}`);
		console.log(`model=${model ?? "Pi default"}`);
		return;
	}

	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const resultDir = resolve(ROOT, "evals/results", `${timestamp}-${label}`);
	await mkdir(resultDir, { recursive: true });
	const reports = [];

	for (const testCase of cases) {
		for (let run = 1; run <= runs; run += 1) {
			const piArgs = [
				"--print",
				"--mode", "text",
				"--no-session",
				"--no-tools",
				"--no-extensions",
				"--no-skills",
				"--no-context-files",
				"--append-system-prompt", systemPrompt,
			];
			if (provider) piArgs.push("--provider", provider);
			if (model) piArgs.push("--model", model);
			piArgs.push(testCase.prompt);

			process.stdout.write(`${testCase.id} run ${run}/${runs} ... `);
			const result = spawnSync(piPath, piArgs, {
				cwd: ROOT,
				encoding: "utf8",
				maxBuffer: 10 * 1024 * 1024,
			});
			if (result.error) throw result.error;
			const output = result.stdout.trim();
			const stderr = result.stderr.trim();
			const outputFile = `${testCase.id}-run-${run}.txt`;
			await writeFile(resolve(resultDir, outputFile), `${output}\n`, "utf8");
			if (stderr) {
				await writeFile(resolve(resultDir, `${testCase.id}-run-${run}.stderr.txt`), `${stderr}\n`, "utf8");
			}

			const lint = lintOutput(output, testCase);
			const report = {
				caseId: testCase.id,
				category: testCase.category,
				run,
				exitCode: result.status,
				outputFile,
				...lint,
			};
			reports.push(report);
			console.log(report.pass && result.status === 0 ? "PASS" : "FAIL");
		}
	}

	const successful = reports.filter((report) => report.pass && report.exitCode === 0);
	const summary = {
		label,
		timestamp,
		provider: provider ?? null,
		model: model ?? null,
		runsPerCase: runs,
		caseCount: cases.length,
		generationCount: reports.length,
		passCount: successful.length,
		passRate: reports.length === 0 ? 0 : successful.length / reports.length,
		averageAnchors: reports.length === 0
			? 0
			: reports.reduce((sum, report) => sum + report.metrics.anchors, 0) / reports.length,
		averageFunctionWordRate: reports.length === 0
			? 0
			: reports.reduce((sum, report) => sum + report.metrics.functionWordRate, 0) / reports.length,
		reports,
	};
	await writeFile(resolve(resultDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
	await writeFile(resolve(resultDir, "system-prompt.md"), systemPrompt, "utf8");
	console.log(`results=${resultDir}`);
	console.log(`passRate=${(summary.passRate * 100).toFixed(1)}%`);

	if (successful.length !== reports.length) process.exitCode = 1;
}

await main();
