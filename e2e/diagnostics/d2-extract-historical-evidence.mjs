/**
 * Read-only extraction from the existing E/H backup. No browser or HTTP calls.
 * Usage: node e2e/diagnostics/d2-extract-historical-evidence.mjs [backup-root]
 * The optional root is the directory containing runtime-clean-start-20260907-{e,h}.
 * Only this task's selected metadata JSON is written. ZIP response resources,
 * request headers, cookies, bodies, screenshots and DOM snapshots are not emitted.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, URL } from "node:url";
import { unzipSync, strFromU8 } from "fflate";

const defaultRoot = "C:/Users/AKX generator/Desktop/Developer/DTD-backups/pr28-e2e-harness-validation-20260906/local-supabase-auth-feasibility-20260906";
const backupRoot = path.resolve(process.argv[2] ?? defaultRoot);
const outputFile = fileURLToPath(new URL("../../docs/qa/assets/d2-webkit-auth-cors/03-historical-evidence.json", import.meta.url));
const authUrl = "http://127.0.0.1:55431/auth/v1/user";
const nextOrigin = "http://127.0.0.1:3743";
const mobileUrl = `${nextOrigin}/m/erp?tab=expenses`;
const stackFramesUrl = `${nextOrigin}/__nextjs_original-stack-frames`;
const corsHeaderNames = new Set([
  "access-control-allow-origin", "access-control-allow-headers",
  "access-control-allow-methods", "access-control-allow-credentials",
  "access-control-expose-headers", "access-control-max-age", "vary",
]);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const relativeReportPath = (run, suffix) => path.join(backupRoot,
  `runtime-clean-start-20260907-${run}`, "receipts", `auth18-clean-start-20260907-${run}`, suffix);
const pick = (value, keys) => Object.fromEntries(keys.filter((key) => key in value).map((key) => [key, value[key]]));
const primaryFiles = [];
function readPrimary(file) {
  const bytes = fs.readFileSync(file);
  primaryFiles.push({ path: file.replaceAll("\\", "/"), bytes: bytes.length, sha256: sha256(bytes) });
  return bytes;
}
function exactDirectory(root, predicate) {
  const matches = fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory() && predicate(entry.name));
  assert.equal(matches.length, 1, "Expected one matching historical artifact directory");
  return path.join(root, matches[0].name);
}
function parseLines(text, accept = () => true) {
  return text.split(/\r?\n/).flatMap((line, index) => line && accept(line)
    ? [{ line: index + 1, value: JSON.parse(line) }] : []);
}
function readArchive(project) {
  const root = relativeReportPath("h", "playwright-artifacts");
  const directory = exactDirectory(root, (name) => name.startsWith("gastos-expense-void-") && name.endsWith(`-${project}`));
  const archiveFile = path.join(directory, "trace.zip");
  const allowedEntries = new Set(["test.trace", "0-trace.trace", "0-trace.network"]);
  // fflate's filter avoids inflating resources (response bodies/screenshots/source).
  const entries = unzipSync(readPrimary(archiveFile), { filter: (entry) => allowedEntries.has(entry.name) });
  assert.equal(Object.keys(entries).length, allowedEntries.size);
  return {
    archiveFile: archiveFile.replaceAll("\\", "/"),
    members: Object.fromEntries([...allowedEntries].map((name) => [name, {
      bytes: entries[name].length, sha256: sha256(entries[name]),
    }])),
    lines: (name, accept) => parseLines(strFromU8(entries[name]), accept),
  };
}
function projectNetwork(archive) {
  const authRequests = [];
  const firstMobileDocuments = [];
  const relevantNetworkLine = (line) => [authUrl, mobileUrl].some((url) => line.includes(`"url":"${url}"`));
  for (const { line, value } of archive.lines("0-trace.network", relevantNetworkLine)) {
    const snapshot = value.snapshot;
    if (!snapshot) continue;
    const { request, response } = snapshot;
    // No request headers, cookie arrays, postData or response content are read.
    if (request.url === authUrl) {
      authRequests.push({
        member: "0-trace.network", line,
        method: request.method, url: request.url,
        ...pick(snapshot, ["startedDateTime", "time", "_monotonicTime", "_failureText"]),
        status: response.status,
        corsHeaders: response.headers.filter((header) => corsHeaderNames.has(header.name.toLowerCase()))
          .map((header) => ({ name: header.name, value: header.value })),
        timings: pick(snapshot.timings ?? {}, ["dns", "connect", "ssl", "send", "wait", "receive"]),
      });
    }
    if (request.url === mobileUrl && request.method === "GET" && firstMobileDocuments.length < 2) {
      firstMobileDocuments.push({ member: "0-trace.network", line, url: request.url,
        ...pick(snapshot, ["startedDateTime", "time", "_monotonicTime"]), status: response.status });
    }
  }
  return { authRequests, firstMobileDocuments };
}

const eDirectory = exactDirectory(relativeReportPath("e", "playwright-artifacts"),
  (name) => name.startsWith("comments-lifecycle-") && name.endsWith("-mobile-safari"));
const eErrorFile = path.join(eDirectory, "error-context.md");
const eErrorLines = readPrimary(eErrorFile).toString("utf8").split(/\r?\n/);
const expectedErrors = new Set([
  'Test timeout of 90000ms exceeded while running "beforeEach" hook.',
  'Tearing down "context" exceeded the test timeout of 90000ms.',
]);
const eErrors = eErrorLines.flatMap((message, index) => expectedErrors.has(message) ? [{ line: index + 1, message }] : []);
assert.equal(eErrors.length, 2);
const eHookFile = path.join(backupRoot, "runtime-clean-start-20260907-e", "source", "e2e", "comments-lifecycle.spec.ts");
const eHookLines = readPrimary(eHookFile).toString("utf8").split(/\r?\n/);
const hookStart = eHookLines.findIndex((line) => line.includes("test.beforeEach(async ({ page }) => {"));
assert.equal(hookStart, 93);
const hookLines = eHookLines.slice(hookStart, hookStart + 8).map((text, index) => ({ line: hookStart + index + 1, text }));
assert.match(hookLines.map((line) => line.text).join("\n"), /await page\.addInitScript\(/);
assert.ok(!hookLines.some((line) => /goto\(|fetch\(|login\(/.test(line.text)));

const chromium = readArchive("chromium");
const safari = readArchive("mobile-safari");
const chromiumNetwork = projectNetwork(chromium);
const safariNetwork = projectNetwork(safari);
assert.equal(chromiumNetwork.authRequests.length, 2);
assert.ok(chromiumNetwork.authRequests.every((entry) => entry.status === 200));
assert.equal(safariNetwork.authRequests.length, 0);

const hookIds = new Set(["hook@2", "fixture@23", "pw:api@24", "fixture@25", "pw:api@26", "pw:api@27"]);
const safariTest = safari.lines("test.trace", (line) => [...hookIds].some((id) => line.includes(`"callId":"${id}"`)));
const hookEvents = safariTest.filter(({ value }) => hookIds.has(value.callId)).map(({ line, value }) => ({
  member: "test.trace", line, ...pick(value, ["type", "callId", "title", "startTime", "endTime", "method"]),
}));
const hookBefore = hookEvents.find((entry) => entry.callId === "hook@2" && entry.type === "before");
const hookAfter = hookEvents.find((entry) => entry.callId === "hook@2" && entry.type === "after");
assert.ok(hookBefore && hookAfter);
const hookDurationMs = Number((hookAfter.endTime - hookBefore.startTime).toFixed(3));

const safariTrace = safari.lines("0-trace.trace", (line) =>
  line.includes('"type":"context-options"') || line.includes('"callId":"call@194"') ||
  (line.includes('"method":"pageError"') && [authUrl, stackFramesUrl].some((url) => line.includes(url))) ||
  (line.includes('"type":"console"') && line.includes('"text":"TypeError: Load failed"')));
const clock = pick(safariTrace[0].value, ["browserName", "playwrightVersion", "platform", "wallTime", "monotonicTime"]);
const eventWallTime = (time) => new Date(clock.wallTime + time - clock.monotonicTime).toISOString();
const navigationEvents = safariTrace.filter(({ value }) => value.callId === "call@194" && ["before", "after"].includes(value.type))
  .map(({ line, value }) => ({ member: "0-trace.trace", line, ...pick(value, ["type", "callId", "startTime", "endTime", "class", "method"]),
    ...(value.type === "before" ? { url: value.params.url, waitUntil: value.params.waitUntil } : {}),
  }));
assert.equal(navigationEvents.length, 2);
assert.equal(navigationEvents[0].url, "/m/erp?tab=expenses");
const pageErrors = safariTrace.flatMap(({ line, value }) => {
  if (value.type !== "event" || value.method !== "pageError") return [];
  const error = value.params?.error?.error;
  const matchedUrl = [authUrl, stackFramesUrl].find((url) => error?.message === `${url.slice("http:/".length)} due to access control checks.`);
  if (!matchedUrl) return [];
  // Persist the raw name/message, never the stack or arbitrary event params.
  return [{ member: "0-trace.trace", line, time: value.time, calculatedWallTime: eventWallTime(value.time),
    url: matchedUrl, name: error.name, message: error.message }];
});
assert.equal(pageErrors.filter((entry) => entry.url === authUrl).length, 2);
assert.equal(pageErrors.filter((entry) => entry.url === stackFramesUrl).length, 1);
const loadFailedConsole = safariTrace.filter(({ value }) => value.type === "console" && value.text === "TypeError: Load failed")
  .map(({ line, value }) => ({ member: "0-trace.trace", line, time: value.time, text: value.text }));
assert.equal(loadFailedConsole.length, 2);
const navigationInterval = [navigationEvents[0].startTime, navigationEvents[1].endTime];
assert.ok(pageErrors.every((entry) => entry.time > navigationInterval[0] && entry.time < navigationInterval[1]));

const progressFile = relativeReportPath("h", "reports/auth18-progress.jsonl");
const hProgress = parseLines(readPrimary(progressFile).toString("utf8"));
const safariProgress = hProgress.filter(({ value }) => value.project === "mobile-safari")
  .map(({ line, value }) => ({ line, ...pick(value, ["event", "file", "line", "project", "status", "retry", "durationMs", "at"]),
    jsonlLine: line }));
assert.equal(safariProgress.length, 12);
const hRunEnd = hProgress.find(({ value }) => value.event === "end-run");
const report = {
  schemaVersion: 1,
  taskId: "d2-webkit-auth-cors",
  source: "Selected historical metadata; no runtime executed by this extractor",
  backupRoot: backupRoot.replaceAll("\\", "/"),
  primaryFiles,
  extractionPolicy: {
    zipMembers: ["test.trace", "0-trace.trace", "0-trace.network"],
    zipResponseResourcesExtracted: false, requestHeadersEmitted: false,
    cookiesEmitted: false, responseBodiesEmitted: false, domSnapshotsEmitted: false,
    arbitraryStacksEmitted: false, selectedResponseHeaders: [...corsHeaderNames],
    jsonParsing: "Only selected network URLs, hook call IDs, navigation call ID, error types and run-progress metadata; no DOM snapshot parsing",
  },
  runE: {
    errorFile: eErrorFile.replaceAll("\\", "/"), errors: eErrors,
    fileModifiedAt: fs.statSync(eErrorFile).mtime.toISOString(),
    fileModifiedAtMeaning: "Filesystem metadata, not a browser event timestamp",
    tracePresent: fs.existsSync(path.join(eDirectory, "trace.zip")),
    frozenHookFile: eHookFile.replaceAll("\\", "/"), hookLines,
    standardPlaywrightImport: eHookLines[0] === 'import { expect, test, type Page } from "@playwright/test";',
    limits: [
      "No trace is preserved for this E failure. Error context cannot distinguish fixture creation from addInitScript execution.",
      "The frozen hook has no navigation or product HTTP. It does not exercise application /auth/v1/user.",
      "The 90000 ms context teardown is separately reported; its presence does not prove the current worker cap resolved initialization.",
    ],
  },
  runH: {
    chromium: { archiveFile: chromium.archiveFile, members: chromium.members, ...chromiumNetwork },
    safari: { archiveFile: safari.archiveFile, members: safari.members, clock, hookEvents, hookDurationMs,
      navigationEvents, pageErrors, loadFailedConsole, ...safariNetwork },
    progressFile: progressFile.replaceAll("\\", "/"), safariProgress,
    runEnd: { jsonlLine: hRunEnd.line, ...pick(hRunEnd.value, ["event", "status", "total", "passed", "skipped", "failed", "globalErrors", "at"]) },
    verifiedObservations: [
      "The H beforeEach completed in 149.707 ms before the later auth errors; it is not the E 90000 ms hook timeout.",
      "Both auth errors and a same-origin Next stack-frame error occur inside the /m/erp goto interval.",
      "Chromium preserves two auth GET responses with status 200 and Access-Control-Allow-Origin: *.",
      "Safari preserves no auth network response; these archives cannot establish a missing Safari CORS response header.",
    ],
    limits: [
      "Coincidence with navigation is measured. Cancellation causality requires a separate controlled probe.",
      "The same-origin Next error prevents interpreting the generic access-control message alone as proof of server CORS rejection.",
      "Only failing H tests retained traces. There is no passing mobile-chrome trace for this test in the inspected directory.",
    ],
  },
};
assert.equal(report.runE.tracePresent, false);
assert.equal(hookDurationMs, 149.707);
const serialized = `${JSON.stringify(report, null, 2)}\n`;
assert.ok(!/\b(?:eyJ[A-Za-z0-9_-]{20,}|sbp_[A-Za-z0-9]+|Bearer\s+[A-Za-z0-9._-]+)/.test(serialized), "Unexpected credential-shaped value in output");
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, serialized);
console.log(JSON.stringify({ status: "PASÓ", outputFile, primaryFileCount: primaryFiles.length,
  chromiumAuthResponses: chromiumNetwork.authRequests.length, safariAuthResponses: safariNetwork.authRequests.length,
  safariPageErrors: pageErrors.length, hBeforeEachMs: hookDurationMs, eTraceAvailable: report.runE.tracePresent }));
