#!/usr/bin/env node
/** SDD-0451. Chromium/CDP observation; never replaces Location or application code. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

export const STORAGE_KEY = '__dtd_navigation_probe_v1';
const CAPTURE = '__dtdNavigationProbeCapture';
const BINDING = '__dtdNavigationProbeEvent';

export function requireLoopback(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('The probe accepts only loopback HTTP(S) targets.');
  }
  if (url.username || url.password) throw new Error('Credentials in URLs are forbidden.');
  return url;
}

function initProbe({ storageKey, capture, binding }) {
  if (window !== window.top) return;
  const documentId = crypto.randomUUID();
  window[capture] = (kind, extra = {}, stack = new Error().stack) => {
    const navigationType = performance.getEntriesByType('navigation')[0]?.type ?? null;
    // These technical events intentionally omit DOM, cookies, tokens and data bodies.
    const event = { navigationType, kind, at: Date.now(), documentId,
      path: location.pathname + location.search, stack, ...extra };
    try {
      const previous = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
      previous.push(event);
      sessionStorage.setItem(storageKey, JSON.stringify(previous));
    } catch (error) { event.persistenceError = String(error); }
    try { window[binding](JSON.stringify(event)); } catch { /* CDP may be detached. */ }
    return event;
  };
  window[capture]('document');
  addEventListener('beforeunload', () => window[capture]('beforeunload', {
    attribution: 'lifecycle observer; this stack alone does not identify the emitter',
  }));
  // CDP installs native function breakpoints while this new document is paused,
  // before any application script can navigate. Location is LegacyUnforgeable.
  debugger;
}

const nativeTargets = [
  ['reload', 'location.reload'],
  ['assign', 'location.assign'],
  ['replace', 'location.replace'],
  ['href', 'Object.getOwnPropertyDescriptor(location, "href").set'],
  ['window.location', 'Object.getOwnPropertyDescriptor(window, "location").set'],
  ['document.location', 'Object.getOwnPropertyDescriptor(document, "location").set'],
];

const moduleExpression = `(() => {
  try {
    if (typeof originalFactory === 'undefined' && typeof moduleObject === 'undefined') return null;
    return {
      moduleId: typeof moduleObject === 'undefined' ? null : moduleObject.id,
      originalFactoryType: typeof originalFactory,
      optionsId: typeof options === 'undefined' ? null : options.id,
      webpackFactoryType: typeof webpackRequire === 'undefined' || typeof moduleObject === 'undefined'
        ? null : typeof webpackRequire.m?.[moduleObject.id],
      cached: typeof webpackRequire === 'undefined' || typeof moduleObject === 'undefined'
        ? null : !!webpackRequire.c?.[moduleObject.id]
    };
  } catch { return null; }
})()`;

export async function attachProbe(page, { onEvent = () => {} } = {}) {
  const cdp = await page.context().newCDPSession(page);
  const events = [];
  const errors = [];
  const targets = new Map();
  const scripts = new Map();
  let pauseMilliseconds = 0;
  let closed = false;
  let mainFrame;
  function record(event) {
    events.push(event);
    if (event.persistenceError) errors.push(`sessionStorage: ${event.persistenceError}`);
    onEvent(event);
  }
  cdp.on('Runtime.bindingCalled', ({ name, payload }) => {
    if (name === BINDING) {
      try { record(JSON.parse(payload)); } catch (error) { errors.push(String(error)); }
    }
  });
  cdp.on('Debugger.scriptParsed', (script) => scripts.set(script.scriptId, script.url));
  cdp.on('Page.frameNavigated', ({ frame }) => { if (!frame.parentId) mainFrame = frame.id; });
  cdp.on('Page.frameRequestedNavigation', (event) => {
    if (event.frameId === mainFrame) record({ kind: 'requested-navigation', at: Date.now(),
      reason: event.reason, disposition: event.disposition, path: new URL(event.url).pathname + new URL(event.url).search });
  });
  cdp.on('Network.requestWillBeSent', (event) => {
    if (event.type === 'Document' && event.frameId === mainFrame) record({
      kind: 'document-request', at: Date.now(), requestId: event.requestId,
      path: new URL(event.request.url).pathname + new URL(event.request.url).search,
      initiatorType: event.initiator.type, initiatorStack: event.initiator.stack ?? null,
    });
  });
  cdp.on('Network.responseReceived', (event) => {
    if (event.type === 'Document' && event.frameId === mainFrame) record({
      kind: 'document-response', at: Date.now(), requestId: event.requestId,
      path: new URL(event.response.url).pathname + new URL(event.response.url).search,
      status: event.response.status,
    });
  });
  const paused = async (event) => {
    const began = Date.now();
    try {
      const frame = event.callFrames[0];
      if (!frame) return;
      const url = scripts.get(frame.location.scriptId) ?? frame.url;
      const evaluate = (expression, returnByValue = true, callFrameId = frame.callFrameId) =>
        cdp.send('Debugger.evaluateOnCallFrame', { callFrameId, expression, returnByValue, silent: true });
      if (url === 'dtd-navigation-probe-init.js') {
        // Chromium can retain the native breakpoint identity across documents.
        // Remove the preceding document's IDs before installing the new handles.
        for (const breakpointId of targets.keys()) await cdp.send('Debugger.removeBreakpoint', { breakpointId });
        targets.clear();
        for (const [kind, expression] of nativeTargets) {
          const result = await evaluate(expression, false);
          if (!result.result.objectId || result.exceptionDetails) throw new Error(`Native target unavailable: ${kind}`);
          const { breakpointId } = await cdp.send('Debugger.setBreakpointOnFunctionCall', {
            objectId: result.result.objectId,
          });
          targets.set(breakpointId, kind);
        }
        const armed = await evaluate(`window.${CAPTURE}('armed', {targets: ${JSON.stringify(nativeTargets.map(([kind]) => kind))}})`);
        if (armed.exceptionDetails) throw new Error('Could not persist native breakpoint readiness');
      } else {
        const kinds = [...new Set((event.hitBreakpoints ?? []).map((id) => targets.get(id)).filter(Boolean))];
        if (!kinds.length) return;
        const callFrames = event.callFrames.map((item) => ({
          functionName: item.functionName, url: scripts.get(item.location.scriptId) ?? item.url,
          line: item.location.lineNumber + 1, column: item.location.columnNumber + 1,
        }));
        const modules = [];
        for (const item of event.callFrames.slice(0, 15)) {
          const result = await evaluate(moduleExpression, true, item.callFrameId);
          if (result.result.value) modules.push({ ...result.result.value,
            url: scripts.get(item.location.scriptId) ?? item.url, line: item.location.lineNumber + 1 });
        }
        const details = { methods: kinds, callFrames, modules, pauseReason: event.reason };
        const result = await evaluate(`window.${CAPTURE}('emitter', ${JSON.stringify(details)}, new Error().stack)`);
        if (result.exceptionDetails) throw new Error('Could not persist emitter stack before navigation');
      }
    } catch (error) { errors.push(String(error)); }
    finally {
      pauseMilliseconds += Date.now() - began;
      if (!closed) await cdp.send('Debugger.resume').catch((error) => errors.push(String(error)));
    }
  };
  cdp.on('Debugger.paused', paused);
  await cdp.send('Page.enable');
  mainFrame = (await cdp.send('Page.getFrameTree')).frameTree.frame.id;
  await cdp.send('Network.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Debugger.enable');
  await cdp.send('Runtime.addBinding', { name: BINDING });
  const source = `(${initProbe.toString()})(${JSON.stringify({ storageKey: STORAGE_KEY, capture: CAPTURE, binding: BINDING })});\n//# sourceURL=dtd-navigation-probe-init.js`;
  const { identifier } = await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source });
  return {
    events, errors,
    get pauseMilliseconds() { return pauseMilliseconds; },
    async persisted() { return page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) || '[]'), STORAGE_KEY); },
    async close() {
      await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
      closed = true;
      cdp.off('Debugger.paused', paused);
      await cdp.detach();
    },
  };
}

export function summarize(events, { targetPath, start, end }) {
  const windowEvents = events.filter((event) => event.at >= start && event.at < end && event.path === targetPath);
  const documents = windowEvents.filter((event) => event.kind === 'document');
  const navigationTypes = Object.fromEntries(['navigate', 'reload', 'back_forward', 'prerender'].map((type) =>
    [type, documents.filter((event) => event.navigationType === type).length]));
  const initial = events.find((event) => event.kind === 'document' && event.path === targetPath);
  const successorNavigationTypes = Object.fromEntries(Object.keys(navigationTypes).map((type) =>
    [type, documents.filter((event) => event.documentId !== initial?.documentId && event.navigationType === type).length]));
  return { navigationTypes, successorNavigationTypes, documentCount: documents.length,
    documentRequestCount: windowEvents.filter((event) => event.kind === 'document-request').length,
    emitterCount: windowEvents.filter((event) => event.kind === 'emitter').length,
    beforeunloadCount: windowEvents.filter((event) => event.kind === 'beforeunload').length,
    durationMs: end - start };
}

export function assessReceipt(receipt) {
  const issues = [];
  const end = receipt.windowEnd ? Date.parse(receipt.windowEnd) : Infinity;
  const observed = receipt.events.filter((event) => event.at < end);
  if (receipt.runError) issues.push('run-error');
  if (!receipt.documentCount) issues.push('target-not-observed');
  if (receipt.finalPath !== receipt.targetPath) issues.push('left-target-path');
  if (receipt.errors.length) issues.push('instrument-errors');
  const documents = observed.filter((event) => event.kind === 'document');
  const armed = new Set(receipt.events.filter((event) => event.kind === 'armed').map((event) => event.documentId));
  if (documents.some((event) => !armed.has(event.documentId))) issues.push('document-not-armed');
  const responses = observed.filter((event) => event.kind === 'document-response');
  if (!responses.some((event) => event.path === receipt.targetPath && event.status === 200)) issues.push('target-http-200-not-observed');
  if (responses.some((event) => event.status >= 400)) issues.push('http-error');
  const persisted = new Set((receipt.persistedEvents ?? []).map((event) => JSON.stringify(event)));
  const missing = observed.filter((event) => event.documentId && !persisted.has(JSON.stringify(event)));
  if (!receipt.persistedEvents || missing.length) issues.push('persistence-incomplete');
  return { status: issues.length ? 'INCONCLUSIVE' : 'OBSERVED', issues,
    interpretation: 'OBSERVED means instrument coverage only; it does not prove authentication, reproduce H1 or identify its emitter.' };
}

async function within(promise, milliseconds) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Snapshot evaluation timed out during navigation')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

async function main() {
  const sourceHash = createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex');
  const args = process.argv.slice(2);
  const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1]; };
  if (args.includes('--help')) {
    console.log('node scripts/probes/navigation-emitter.mjs --url http://localhost:PORT/m/erp?tab=expenses --output FILE [--seconds 60] [--storage-state EXTERNAL_FILE] [--prepare EXTERNAL_MODULE]');
    return;
  }
  const url = requireLoopback(option('--url', 'http://localhost:3001/m/erp?tab=expenses'));
  const output = path.resolve(option('--output', '.harness/d1-navigation.json'));
  const seconds = Number(option('--seconds', '60'));
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Invalid duration');
  if (fs.existsSync(output)) throw new Error('Refusing to overwrite an existing receipt');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let probe;
  let receipt;
  try {
    const context = await browser.newContext({ storageState: option('--storage-state', undefined) });
    const page = await context.newPage();
    const prepare = option('--prepare', undefined);
    if (prepare) await (await import(pathToFileURL(path.resolve(prepare)).href)).prepare({ page, context, baseURL: url.origin });
    probe = await attachProbe(page);
    const startedAt = new Date().toISOString();
    const targetPath = url.pathname + url.search;
    await page.goto(url.href, { waitUntil: 'commit', timeout: 120_000 });
    // Start at the first actual document, not during cold server compilation.
    const deadline = Date.now() + 30_000;
    while (!probe.events.some((event) => event.kind === 'document' && event.path === targetPath) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const firstDocument = probe.events.find((event) => event.kind === 'document' && event.path === targetPath);
    if (!firstDocument) throw new Error('No document observation received');
    const start = firstDocument.at;
    const end = start + seconds * 1000;
    while (Date.now() < end) await new Promise((resolve) => setTimeout(resolve, Math.min(1000, end - Date.now())));
    let persistence = null;
    let persistenceError;
    const snapshotDeadline = Date.now() + 5_000;
    // A fast reload may destroy an evaluation context. Retry the copy only;
    // the measurement window remains the exact original 60 seconds.
    while (!persistence && Date.now() < snapshotDeadline) {
      try { persistence = await within(probe.persisted(), Math.min(1000, snapshotDeadline - Date.now())); }
      catch (error) {
        persistenceError = error;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    if (!persistence) probe.errors.push(`Final persistence snapshot: ${persistenceError}`);
    receipt = { ...summarize(probe.events, { targetPath, start, end }),
      targetPath, startedAt, windowStart: new Date(start).toISOString(), windowEnd: new Date(end).toISOString(),
      finalPath: new URL(page.url()).pathname + new URL(page.url()).search,
      head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
      nodeVersion: process.version,
      probeSourceSha256: sourceHash,
      browserVersion: browser.version(), debuggerPauseMs: probe.pauseMilliseconds,
      errors: probe.errors, persistedEvents: persistence, events: probe.events };
    receipt.assessment = assessReceipt(receipt);
    console.log(JSON.stringify(receipt, null, 2));
    fs.writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
    if (receipt.assessment.status !== 'OBSERVED') process.exitCode = 2;
  } catch (error) {
    const failed = { navigationTypes: null, runError: String(error),
      targetPath: url.pathname + url.search, errors: probe?.errors ?? [], events: probe?.events ?? [],
      assessment: { status: 'INCONCLUSIVE', issues: ['run-error'] } };
    if (!fs.existsSync(output)) fs.writeFileSync(output, JSON.stringify(failed, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(failed, null, 2));
    process.exitCode = 2;
  } finally {
    if (probe) await probe.close().catch(() => {});
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
