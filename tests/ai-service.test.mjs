import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createAiService, buildAiTask, validateAiResult, sourceQuote, readAiConfig } from "../desktop/ai-service.mjs";
import { startLocalServer } from "../desktop/local-server.mjs";
import { writingSectionBand, isWritingReport, isSpeakingReport } from "../src/lib/aiReports.js";
import { recordStudyActivity, getLatestSubjectScores, getStudyActivity } from "../src/lib/localStudyStore.js";
import { isReadingAnalysis, readingAnalysisPayload, matchingReadingAnalysis, readingAiHighlights, isReadingTextReport } from "../src/lib/readingAi.js";
import { validateBackup } from "../src/lib/backup.js";

const essay = "I enjoys reading books. It help me learn.";
const payload = { task: "Task 2", question: "Is reading important?", essay };
const writing = () => ({ criteria: Object.fromEntries(["task", "coherence", "lexical", "grammar"].map((k, i) => [k, { score: [6, 6.5, 6, 5.5][i], feedback: "具体评价" }])), summary: "综述", advice: ["建议"], grammar: [{ original: "I enjoys", replacement: "I enjoy", reason: "主谓一致" }], logic: [], revisedEssay: "I enjoy reading books. It helps me learn." });
const fixture = (t, config = { apiKey: "fixture-only-not-a-real-key" }) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ielts-ai-"));
  const configPath = path.join(root, "private.json"); fs.writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });
  t.after(() => fs.rmSync(root, { recursive: true, force: true })); return { root, configPath };
};
const completion = (data) => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(data) } }], usage: { prompt_tokens: 10, completion_tokens: 20 } }), { status: 200 });

const readingArticle = { id: "sample-reading", title: "Reading habits", paragraphs: [{ id: "A", text: "Children who read daily develop stronger vocabulary." }, { id: "B", text: "The study followed 200 pupils." }], questionGroups: [{ id: "g1", title: "Questions 1-2", instruction: "Choose the correct answer.", options: [{ value: "A", label: "Better vocabulary" }, { value: "B", label: "Greater speed" }] }] };
const readingQuestion = { id: "1", groupId: "g1", text: "What benefit did regular reading bring?", expected: "A", response: "B" };
const readingReport = () => ({ questionId: "1", explanation: "原文说词汇更强，没有说明阅读更快。", evidence: [{ paragraphId: "A", quote: "develop stronger vocabulary", reason: "直接对应 A 项。" }], vocabulary: [{ term: "pupils", meaning: "学生" }], synonyms: [{ questionPhrase: "Better vocabulary", passagePhrase: "stronger vocabulary", explanation: "都指词汇更丰富。" }], approach: "定位阅读带来的益处，排除原文未提及的速度。" });

test("reading review sends option context, grounds each quote in its named paragraph and keeps the source answer", () => {
  const p = readingAnalysisPayload(readingArticle, readingQuestion);
  const task = buildAiTask("reading/analysis", p);
  assert.match(task.body.messages[1].content, /Greater speed/);
  assert.equal(task.body.tool_choice.function.name, "submit_reading_review");
  assert.equal(task.body.response_format, undefined);
  assert.equal(p.question.expected, "A");
  const multiArticle = { ...readingArticle, questionGroups: [{ ...readingArticle.questionGroups[0], answer: ["A", "B"] }] };
  assert.match(readingAnalysisPayload(multiArticle, { ...readingQuestion, multi: true }).question.expected, /顺序不限.*A、B/);
  const report = validateAiResult("reading/analysis", readingReport(), p);
  assert.equal(isReadingAnalysis(report), true);
  const entry = { input: JSON.stringify(p), report };
  assert.equal(matchingReadingAnalysis(entry, p), report);
  assert.equal(matchingReadingAnalysis(entry, { ...p, question: { ...p.question, response: "A" } }), null);
  const changed = structuredClone(p); changed.question.options = "Changed choices";
  assert.equal(matchingReadingAnalysis(entry, changed), null);
  const highlights = readingAiHighlights(readingArticle, [report]);
  assert.equal(readingArticle.paragraphs[0].text.slice(highlights[0].start, highlights[0].end), report.evidence[0].quote);
  for (const change of [r => r.evidence[0].paragraphId = "B", r => r.evidence[0].quote = "invented words", r => r.questionId = "2", r => r.synonyms[0].questionPhrase = "not in the options", r => r.vocabulary[0].term = "nonexistent"]) {
    const bad = readingReport(); change(bad);
    assert.throws(() => validateAiResult("reading/analysis", bad, p), { code: "INVALID_MODEL_OUTPUT" });
    assert.equal(matchingReadingAnalysis({ input: JSON.stringify(p), report: bad }, p), null);
  }
  const ng = readingReport(); ng.evidence = []; ng.synonyms = [];
  assert.doesNotThrow(() => validateAiResult("reading/analysis", ng, p));
});

test("reading named output tool is validated without executing any generated action", async (t) => {
  const { configPath } = fixture(t);
  const p = readingAnalysisPayload(readingArticle, readingQuestion);
  let name = "submit_reading_review";
  const ai = createAiService({ configPath, fetchImpl: async () => new Response(JSON.stringify({ choices: [{ finish_reason: "tool_calls", message: { content: null, tool_calls: [{ type: "function", function: { name, arguments: JSON.stringify(readingReport()) } }] } }] })) });
  assert.equal((await ai.run("reading/analysis", p)).questionId, "1");
  name = "execute_something";
  await assert.rejects(ai.run("reading/analysis", { ...p, title: "Different input" }), { code: "INVALID_MODEL_OUTPUT" });
});

test("reading text translation is grounded, offline errors preserve input and backups validate reports and note ranges", async (t) => {
  const p = { text: readingArticle.paragraphs[0].text, term: "vocabulary" };
  assert.doesNotThrow(() => buildAiTask("reading/text", p));
  assert.throws(() => buildAiTask("reading/text", { ...p, term: "foreign" }));
  const result = { translation: "每天阅读的儿童词汇量更丰富。", grammar: "who 引导定语从句。", vocabulary: [{ term: "vocabulary", meaning: "词汇量" }] };
  assert.equal(isReadingTextReport(validateAiResult("reading/text", result, p)), true);
  assert.throws(() => validateAiResult("reading/text", { ...result, vocabulary: [{ term: "invented", meaning: "虚构" }] }, p));
  const backup = { format: "ielts-study-backup", version: 1, values: { "ielts-pdf-study-v1:fingerprint:1": { source: p.text, excerpt: p.text, note: "保留原笔记", report: result, annotations: [{ id: "a1", paragraphId: "pdf:1:1", start: 0, end: 8, color: "brown", note: "主语" }] }, "ielts-reading-ai-v1:sample": { "1": { input: JSON.stringify(readingAnalysisPayload(readingArticle, readingQuestion)), report: readingReport() } } } };
  assert.equal(validateBackup(backup), backup);
  const bad = structuredClone(backup); bad.values["ielts-pdf-study-v1:fingerprint:1"].annotations[0].end = 999999;
  assert.throws(() => validateBackup(bad), /PDF/);
  bad.values["ielts-pdf-study-v1:fingerprint:1"] = {}; bad.values["ielts-reading-ai-v1:sample"]["1"].report = { explanation: "broken" };
  assert.throws(() => validateBackup(bad), /阅读/);
  const { configPath } = fixture(t, {});
  await assert.rejects(createAiService({ configPath }).run("reading/text", p), { code: "NOT_CONFIGURED" });
  assert.equal(p.term, "vocabulary");
});

test("credentials stay in server config, reject foreign endpoints, and missing key preserves offline status", async (t) => {
  const { configPath } = fixture(t, {}); let calls = 0;
  const service = createAiService({ configPath, fetchImpl: () => { calls++; } });
  assert.equal(service.status().ready, false);
  await assert.rejects(service.run("writing/feedback", payload), { code: "NOT_CONFIGURED" }); assert.equal(calls, 0);
  fs.writeFileSync(configPath, JSON.stringify({ apiKey: "fixture-only-not-a-real-key", baseUrl: "https://example.com/compatible-mode/v1" }));
  assert.throws(() => readAiConfig(configPath), { code: "CONFIG_ERROR" });
});

test("writing includes Task 1 image, grounds quoted evidence and computes band locally", () => {
  assert.throws(() => buildAiTask("writing/feedback", { ...payload, task: "Task 1" }), /图表/);
  const image = "data:image/png;base64,aGVsbG8=";
  const task = buildAiTask("writing/feedback", { ...payload, task: "Task 1", image });
  assert.equal(task.body.messages[1].content[1].image_url.url, image);
  const report = validateAiResult("writing/feedback", writing(), payload); assert.equal(report.score, 6);
  assert.equal(isWritingReport(report), true); assert.equal(isWritingReport({ ...report, score: "bad" }), false); assert.equal(isWritingReport({ ...report, logic: {} }), false);
  assert.equal(sourceQuote(essay, "i ENJOYS"), "I enjoys"); assert.equal(sourceQuote(essay, "a made-up quote"), null);
  const invented = writing(); invented.grammar[0].original = "I never said this";
  assert.throws(() => validateAiResult("writing/feedback", invented, payload), { code: "INVALID_MODEL_OUTPUT" });
  const broken = writing(); broken.criteria.grammar.score = 9.5;
  assert.throws(() => validateAiResult("writing/feedback", broken, payload), { code: "INVALID_MODEL_OUTPUT" });
});

test("identical concurrent requests share one billed call; cached responses and errors never expose the key", async (t) => {
  const { configPath } = fixture(t); let calls = 0;
  const service = createAiService({ configPath, fetchImpl: async (url, options) => {
    calls++; assert.equal(url, "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions");
    assert.equal(options.headers.Authorization, "Bearer fixture-only-not-a-real-key");
    assert.equal(options.redirect, "error");
    return completion(writing());
  } });
  const [a, b] = await Promise.all([service.run("writing/feedback", payload), service.run("writing/feedback", payload)]);
  await service.run("writing/feedback", payload); assert.equal(calls, 1); assert.deepEqual(a, b);
  assert.ok(!JSON.stringify([a, service.status()]).includes("fixture-only-not-a-real-key"));
  for (const status of [401, 403, 429, 500]) {
    const failed = createAiService({ configPath, fetchImpl: async () => new Response("fixture-only-not-a-real-key", { status }) });
    await assert.rejects(failed.run("writing/feedback", payload), (e) => e.code === `PROVIDER_${status}` && !e.message.includes("fixture-only-not-a-real-key"));
  }
});

test("malformed/truncated output is rejected and a later retry can succeed", async (t) => {
  const { configPath } = fixture(t); let calls = 0;
  const service = createAiService({ configPath, fetchImpl: async () => ++calls === 1 ? new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] })) : completion(writing()) });
  await assert.rejects(service.run("writing/feedback", payload), { code: "INVALID_MODEL_OUTPUT" });
  assert.equal((await service.run("writing/feedback", payload)).score, 6); assert.equal(calls, 2);
});

test("speaking ties each answer to its question and never scores pronunciation/fluency from text", () => {
  const p = { targetBand: 7, answers: [{ id: "q1", part: "part1", question: "Hobbies?", answer: essay }] };
  const r = { scores: { fluency: 9, lexical: 6, grammar: 5.5, pronunciation: 9 }, feedback: { fluency: "连贯性", lexical: "用词", grammar: "语法", pronunciation: "错误地判断发音" }, answers: [{ id: "q1", polished: "Polished.", example: "Example.", notes: "改动" }] };
  const report = validateAiResult("speaking/feedback", r, p); assert.equal(report.scores.fluency, null); assert.equal(report.scores.pronunciation, null);
  assert.equal(isSpeakingReport(report), true); assert.equal(isSpeakingReport({ ...report, answers: "broken" }), false);
  assert.equal(isSpeakingReport({ ...report, scores: { ...report.scores, pronunciation: 9 } }), false);
  report.answers[0].id = "other-question"; assert.throws(() => validateAiResult("speaking/feedback", report, p), { code: "INVALID_MODEL_OUTPUT" });
  assert.throws(() => buildAiTask("speaking/feedback", { ...p, answers: [null] }));
  assert.throws(() => buildAiTask("speaking/feedback", { ...p, answers: [{ ...p.answers[0], answer: " " }] }));
});

test("ASR rejects arbitrary URLs and non-audio; usage and raw transcript remain separate", async (t) => {
  for (const audio of ["https://example.com/audio.wav", "data:audio/wav;base64,aGVsbG8=", ""]) assert.throws(() => buildAiTask("transcribe", { audio }));
  const { configPath } = fixture(t), bytes = Buffer.alloc(100); bytes.write("RIFF"); bytes.write("WAVE", 8);
  const ai = createAiService({ configPath, fetchImpl: async (url, options) => {
    const data = JSON.parse(options.body); assert.equal(data.model, "qwen3-asr-flash"); assert.equal(data.asr_options.enable_itn, false);
    return new Response(JSON.stringify({ choices: [{ message: { content: "I enjoys reading." } }] }));
  } });
  assert.equal((await ai.run("transcribe", { audio: `data:audio/wav;base64,${bytes.toString("base64")}` })).text, "I enjoys reading.");
});

test("local HTTP AI routes reject cross-origin, missing headers and invalid JSON before contacting provider", async (t) => {
  const { root, configPath } = fixture(t); fs.writeFileSync(path.join(root, "index.html"), "local app"); let calls = 0;
  const service = await startLocalServer({ distDirectory: root, resourcesDirectory: root, userDataDirectory: root, aiOptions: { configPath, fetchImpl: async () => { calls++; return completion(writing()); } } });
  t.after(() => service.close());
  const status = await fetch(`${service.origin}/api/ai/status`).then((r) => r.json());
  assert.equal(status.ready, true); assert.ok(!JSON.stringify(status).includes("fixture-only-not-a-real-key")); assert.equal(calls, 0);
  const url = `${service.origin}/api/ai/writing/feedback`;
  const headers = { "Content-Type": "application/json", "X-IELTS-Local": "1" };
  assert.equal((await fetch(url, { method: "POST", headers: { ...headers, Origin: "https://example.com" }, body: JSON.stringify(payload) })).status, 403);
  assert.equal((await fetch(url, { method: "POST", body: JSON.stringify(payload) })).status, 403);
  assert.equal((await fetch(url, { method: "POST", headers, body: "{broken" })).status, 400); assert.equal(calls, 0);
  const response = await fetch(url, { method: "POST", headers: { ...headers, Origin: service.origin }, body: JSON.stringify(payload) });
  assert.equal(response.status, 200); assert.equal((await response.json()).score, 6); assert.equal(calls, 1);
});

test("writing Task 2 double weight needs all reports; later AI review keeps original submission ordering", () => {
  const items = [{ id: "one", task: "Task 1" }, { id: "two", task: "Task 2" }];
  assert.equal(writingSectionBand(items, { one: { score: 9 } }), null);
  assert.equal(writingSectionBand(items, { one: { score: 9 }, two: { score: 6 } }), 7);
  const values = new Map(); globalThis.window = { localStorage: { getItem: (k) => values.get(k) || null, setItem: (k, v) => values.set(k, v) }, dispatchEvent: () => {} }; globalThis.CustomEvent = class {};
  try {
    recordStudyActivity({ id: "older", page: "writing", subject: "写作", title: "Old", score: null, submittedAt: 1000, responses: { essay } });
    recordStudyActivity({ id: "newer", page: "writing", subject: "写作", title: "New", score: 7, submittedAt: 2000 });
    recordStudyActivity({ ...getStudyActivity("older"), score: 5, aiReport: writing() });
    assert.equal(getLatestSubjectScores().get("写作").id, "newer"); assert.equal(getStudyActivity("older").responses.essay, essay); assert.equal(getStudyActivity("older").submittedAt, 1000);
  } finally { delete globalThis.window; }
});

test('PDF OCR accepts only bounded inline page images and validates complete text output',()=>{
 const image='data:image/png;base64,aGVsbG8=';
 const task=buildAiTask('reading/ocr',{image});assert.equal(task.kind,'text');assert.equal(task.body.messages[1].content[1].image_url.url,image);
 for(const value of ['https://example.com/private.png','file:///etc/passwd','data:text/html;base64,aGVsbG8='])assert.throws(()=>buildAiTask('reading/ocr',{image:value}));
 assert.deepEqual(validateAiResult('reading/ocr',{text:'Visible words.',uncertain:false},{}),{text:'Visible words.',uncertain:false});
 assert.doesNotThrow(()=>validateAiResult('reading/ocr',{text:'',uncertain:true},{}));
 assert.throws(()=>validateAiResult('reading/ocr',{text:'Words'},{}));assert.throws(()=>validateAiResult('reading/ocr',{text:'x'.repeat(30001),uncertain:false},{}));
});

test("user key settings persist privately, switch immediately, and never echo credentials", async (t) => {
  const { root } = fixture(t);
  const configPath = path.join(root, "private", "ai.json");
  let authorization;
  const service = createAiService({ configPath, fetchImpl: async (url, options) => { authorization = options.headers.Authorization; assert.ok(url.startsWith("https://dashscope.aliyuncs.com/")); return completion(writing()); } });
  const key = "sk-fixture-first-key-not-real";
  const result = service.saveConfig({ apiKey: ` ${key}\n`, region: "beijing" });
  assert.equal(result.ready, true); assert.equal(result.region, "beijing");
  assert.ok(!JSON.stringify(result).includes(key));
  assert.equal(fs.statSync(configPath).mode & 0o777, 0o600);
  assert.equal(fs.statSync(path.dirname(configPath)).mode & 0o777, 0o700);
  await service.run("writing/feedback", payload); assert.equal(authorization, `Bearer ${key}`);
  const saved = JSON.parse(fs.readFileSync(configPath, "utf8")); saved.textModel = "custom-model";
  fs.writeFileSync(configPath, JSON.stringify(saved));
  const second = "sk-fixture-second-key-not-real";
  service.saveConfig({ apiKey: second, region: "beijing" });
  await service.run("writing/feedback", payload); assert.equal(authorization, `Bearer ${second}`);
  assert.equal(readAiConfig(configPath).textModel, "custom-model");
  service.saveConfig({ apiKey: second, region: "singapore" });
  assert.equal(readAiConfig(configPath).baseUrl, "https://dashscope-intl.aliyuncs.com/compatible-mode/v1");
  assert.equal(service.status().region, "singapore");
  assert.deepEqual(fs.readdirSync(path.dirname(configPath)), ["ai.json"]);
});

test("invalid key settings leave the previous config untouched", (t) => {
  const { configPath } = fixture(t); const service = createAiService({ configPath });
  const before = fs.readFileSync(configPath, "utf8");
  for (const bad of [null, [], {}, { apiKey: "", region: "beijing" }, { apiKey: "AccessKey123456", region: "beijing" }, { apiKey: "sk-short", region: "beijing" }, { apiKey: "sk-key with spaces", region: "beijing" }, { apiKey: "sk-" + "x".repeat(1022), region: "beijing" }, { apiKey: "sk-fixture-not-real", region: "unknown" }, { apiKey: "sk-fixture-not-real", region: "beijing", baseUrl: "https://example.com" }]) {
    assert.throws(() => service.saveConfig(bad));
    assert.equal(fs.readFileSync(configPath, "utf8"), before);
  }
  const previous = process.env.DASHSCOPE_API_KEY;
  try {
    process.env.DASHSCOPE_API_KEY = "sk-environment-fixture-only";
    assert.equal(service.status().managedByEnvironment, true);
    assert.throws(() => service.saveConfig({ apiKey: "sk-fixture-not-real", region: "beijing" }), { code: "ENV_MANAGED" });
    assert.equal(fs.readFileSync(configPath, "utf8"), before);
  } finally { if (previous === undefined) delete process.env.DASHSCOPE_API_KEY; else process.env.DASHSCOPE_API_KEY = previous; }
});

test("HTTP key import is same-origin only, bounded, and shared between app services", async (t) => {
  const { root, configPath } = fixture(t, {});
  fs.writeFileSync(path.join(root, "index.html"), "app");
  let calls = 0;
  const aiOptions = { configPath, fetchImpl: async () => { calls++; return completion(writing()); } };
  const server = await startLocalServer({ distDirectory: root, resourcesDirectory: root, userDataDirectory: root, aiOptions });
  t.after(() => server.close());
  const headers = { "Content-Type": "application/json", "X-IELTS-Local": "1", Origin: server.origin };
  const body = JSON.stringify({ apiKey: "sk-fixture-http-not-real", region: "beijing" });
  const post = (options = {}) => fetch(`${server.origin}/api/ai/config`, { method: "POST", headers, body, ...options });
  assert.equal((await post({ headers: { ...headers, Origin: "https://example.com" } })).status, 403);
  assert.equal((await post({ headers: { ...headers, "Sec-Fetch-Site": "cross-site" } })).status, 403);
  assert.equal((await post({ headers: { "Content-Type": "application/json" } })).status, 403);
  assert.equal((await post({ body: "x".repeat(4097) })).status, 413);
  assert.equal((await post({ body: "{" })).status, 400);
  const response = await post(); assert.equal(response.status, 200);
  assert.ok(!(await response.text()).includes("sk-fixture-http-not-real"));
  assert.equal(createAiService({ configPath }).status().ready, true);
  assert.equal(calls, 0);
});
