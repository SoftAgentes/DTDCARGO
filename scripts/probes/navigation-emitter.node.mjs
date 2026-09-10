import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { chromium } from '@playwright/test';
import { attachProbe, STORAGE_KEY, requireLoopback, summarize, assessReceipt } from './navigation-emitter.mjs';

// These fixtures validate the observation instrument, not the Next.js incident.
// Every navigation is initiated by fixture JavaScript, never page.reload().
const fixtures = [
  { method: 'reload', caller: 'fixtureReloadEmitter', code: 'location.reload()', type: 'reload' },
  { method: 'assign', caller: 'fixtureAssignEmitter', code: 'location.assign(location.href)', type: 'navigate' },
  { method: 'replace', caller: 'fixtureReplaceEmitter', code: 'location.replace(location.href)', type: 'navigate' },
  { method: 'href', caller: 'fixtureHrefEmitter', code: 'location.href = location.href', type: 'navigate' },
  { method: 'window.location', caller: 'fixtureWindowLocationEmitter', code: 'window.location = location.href', type: 'navigate' },
  { method: 'document.location', caller: 'fixtureDocumentLocationEmitter', code: 'document.location = location.href', type: 'navigate' },
  {
    method: 'reload', fixturePath: '/missing-factory', caller: 'fixtureMissingFactoryEmitter', type: 'reload',
    moduleId: 'fixture/client-missing.js',
    code: `const moduleObject = { id: 'fixture/client-missing.js' };
  const options = { id: moduleObject.id };
  const originalFactory = undefined;
  const webpackRequire = { m: {}, c: {} };
  if (!originalFactory) document.location.reload()`,
  },
];

const fixturePath = (fixture) => fixture.fixturePath ?? `/${fixture.method}`;

function fixtureHtml(fixture) {
  return `<!doctype html><html><head><title>Navigation emitter fixture</title></head>
<body><button id="navigate" onclick="${fixture.caller}()">Navigate once</button>
<script>
function ${fixture.caller}() {
  ${fixture.code};
}
</script></body></html>`;
}

test('probe rejects non-loopback targets and URL credentials', () => {
  assert.equal(requireLoopback('http://127.0.0.1:3456/m/erp?tab=expenses').hostname, '127.0.0.1');
  assert.equal(requireLoopback('http://[::1]:3456/').hostname, '[::1]');
  for (const invalid of ['https://example.com/', 'file:///tmp/fixture', 'http://user:password@localhost/']) {
    assert.throws(() => requireLoopback(invalid));
  }
});

function makeReceipt(events, { targetPath = '/target', finalPath = targetPath, errors = [], persistedEvents } = {}) {
  return {
    ...summarize(events, { targetPath, start: 0, end: Date.now() + 1 }),
    targetPath, finalPath, errors, events,
    persistedEvents: persistedEvents === undefined ? structuredClone(events.filter((event) => event.documentId)) : persistedEvents,
  };
}

function intactReceipt() {
  return makeReceipt([
    { kind: 'document-response', path: '/target', at: 1, status: 200 },
    { kind: 'document', path: '/target', at: 2, documentId: 'first', navigationType: 'navigate' },
    { kind: 'armed', path: '/target', at: 3, documentId: 'first' },
    { kind: 'emitter', path: '/target', at: 4, documentId: 'first', methods: ['reload'], stack: 'fixture stack' },
    { kind: 'document-response', path: '/target', at: 5, status: 200 },
    { kind: 'document', path: '/target', at: 6, documentId: 'second', navigationType: 'reload' },
    { kind: 'armed', path: '/target', at: 7, documentId: 'second' },
  ]);
}

function assertInconclusive(receipt, ...issues) {
  const assessment = assessReceipt(receipt);
  assert.equal(assessment.status, 'INCONCLUSIVE');
  for (const issue of issues) assert.ok(assessment.issues.includes(issue), `missing assessment issue: ${issue}`);
}

test('receipt assessment rejects incomplete observations without claiming H1 reproduction', async (t) => {
  await t.test('an intact receipt means instrument coverage only', () => {
    const result = assessReceipt(intactReceipt());
    assert.equal(result.status, 'OBSERVED');
    assert.deepEqual(result.issues, []);
    assert.match(result.interpretation, /instrument coverage only/);
    assert.match(result.interpretation, /does not prove authentication, reproduce H1 or identify its emitter/);
  });
  await t.test('a document without native breakpoint readiness is inconclusive', () => {
    const receipt = intactReceipt();
    receipt.events = receipt.events.filter((event) => !(event.kind === 'armed' && event.documentId === 'second'));
    assertInconclusive(receipt, 'document-not-armed');
  });
  await t.test('a missing final storage snapshot is inconclusive', () => {
    const receipt = intactReceipt();
    receipt.persistedEvents = null;
    assertInconclusive(receipt, 'persistence-incomplete');
  });
  await t.test('losing only the emitter defeats persistence even when documents survived', () => {
    const receipt = intactReceipt();
    receipt.persistedEvents = receipt.persistedEvents.filter((event) => event.kind !== 'emitter');
    assertInconclusive(receipt, 'persistence-incomplete');
  });
  await t.test('matching document IDs do not excuse a corrupted persisted stack', () => {
    const receipt = intactReceipt();
    receipt.persistedEvents.find((event) => event.kind === 'emitter').stack = 'different stack';
    assertInconclusive(receipt, 'persistence-incomplete');
  });
  await t.test('instrument errors remain fatal even with a complete storage snapshot', () => {
    const receipt = intactReceipt();
    receipt.errors.push('sessionStorage: QuotaExceededError');
    assertInconclusive(receipt, 'instrument-errors');
  });
  await t.test('a 200 response from the login path is not the target observation', () => {
    const receipt = makeReceipt([
      { kind: 'document-response', path: '/login', at: 1, status: 200 },
      { kind: 'document', path: '/login', at: 2, documentId: 'login', navigationType: 'navigate' },
      { kind: 'armed', path: '/login', at: 3, documentId: 'login' },
    ], { finalPath: '/login' });
    assertInconclusive(receipt, 'target-not-observed', 'left-target-path', 'target-http-200-not-observed');
  });
  await t.test('an HTTP500 with an observed native reload is still inconclusive', () => {
    const receipt = intactReceipt();
    for (const response of receipt.events.filter((event) => event.kind === 'document-response')) response.status = 500;
    assert.equal(receipt.emitterCount, 1);
    assertInconclusive(receipt, 'http-error', 'target-http-200-not-observed');
  });
  await t.test('a later HTTP500 does not disappear behind an earlier HTTP200', () => {
    const receipt = intactReceipt();
    receipt.events.find((event) => event.kind === 'document-response').status = 500;
    assertInconclusive(receipt, 'http-error');
  });
  await t.test('run errors cannot be masked by a valid-looking partial receipt', () => {
    const receipt = intactReceipt();
    receipt.runError = 'fixture aborted';
    assertInconclusive(receipt, 'run-error');
  });
});

test('successor navigation types exclude the initial target document and unrelated paths', () => {
  const events = [
    { kind: 'document', path: '/login', at: 1, documentId: 'login', navigationType: 'navigate' },
    { kind: 'document', path: '/target', at: 10, documentId: 'initial', navigationType: 'navigate' },
    { kind: 'document', path: '/target', at: 20, documentId: 'reload', navigationType: 'reload' },
    { kind: 'document', path: '/target', at: 30, documentId: 'navigate', navigationType: 'navigate' },
    { kind: 'document', path: '/target', at: 50, documentId: 'out-of-window', navigationType: 'reload' },
  ];
  const summary = summarize(events, { targetPath: '/target', start: 10, end: 40 });
  assert.equal(summary.documentCount, 3);
  assert.deepEqual(summary.navigationTypes, { navigate: 2, reload: 1, back_forward: 0, prerender: 0 });
  assert.deepEqual(summary.successorNavigationTypes, { navigate: 1, reload: 1, back_forward: 0, prerender: 0 });
  const initialOnly = summarize(events, { targetPath: '/target', start: 10, end: 20 });
  assert.deepEqual(initialOnly.successorNavigationTypes, { navigate: 0, reload: 0, back_forward: 0, prerender: 0 });
  const laterWindow = summarize(events, { targetPath: '/target', start: 20, end: 40 });
  assert.deepEqual(laterWindow.successorNavigationTypes, summary.successorNavigationTypes,
    'moving the observation window must not relabel a successor as the initial document');
});

test('native Location breakpoints retain the real caller and sessionStorage across navigation', { timeout: 120_000 }, async (t) => {
  const fixtureServer = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/protected') { response.writeHead(302, { location: '/login' }).end(); return; }
    if (pathname === '/login' || pathname === '/http500') {
      response.writeHead(pathname === '/login' ? 200 : 500, { 'content-type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><title>Unrelated fixture document</title>Fixture only');
      return;
    }
    const fixture = fixtures.find((item) => pathname === fixturePath(item));
    if (!fixture) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(fixtureHtml(fixture));
  });
  fixtureServer.listen(0, '127.0.0.1');
  await once(fixtureServer, 'listening');
  const origin = `http://127.0.0.1:${fixtureServer.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    for (const fixture of fixtures) {
      await t.test(fixturePath(fixture), { timeout: 15_000 }, async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        const probe = await attachProbe(page);
        try {
          const targetPath = fixturePath(fixture);
          await page.goto(`${origin}${targetPath}`, { waitUntil: 'load', timeout: 10_000 });
          await page.waitForFunction((key) => {
            const events = JSON.parse(sessionStorage.getItem(key) || '[]');
            return events.some((event) => event.kind === 'armed');
          }, STORAGE_KEY, { timeout: 5_000 });
          const before = await probe.persisted();
          assert.equal(before.filter((event) => event.kind === 'document').length, 1);
          const initialDocument = before.find((event) => event.kind === 'document');
          assert.equal(initialDocument.navigationType, 'navigate', 'page.goto creates the initial navigate, not evidence of a loop emitter');
          assert.equal(before.filter((event) => event.kind === 'emitter').length, 0);
          await page.evaluate(() => sessionStorage.setItem('__fixture_persistence_marker', 'kept'));

          await page.locator('#navigate').click({ noWaitAfter: true, timeout: 10_000 });
          await page.waitForFunction((key) => {
            const events = JSON.parse(sessionStorage.getItem(key) || '[]');
            return events.filter((event) => event.kind === 'document').length === 2;
          }, STORAGE_KEY, { timeout: 10_000 });
          await page.waitForLoadState('load');

          const after = await probe.persisted();
          assert.equal(await page.evaluate(() => sessionStorage.getItem('__fixture_persistence_marker')), 'kept');
          assert.deepEqual(after.slice(0, before.length), before, 'the next document preserves the preceding document events');
          const documents = after.filter((event) => event.kind === 'document');
          assert.equal(documents.length, 2);
          assert.equal(after.filter((event) => event.kind === 'armed').length, 2, 'the native breakpoints are armed in each document');
          assert.notEqual(documents[0].documentId, documents[1].documentId);
          // Only the successor document classifies the fixture action. The first
          // navigate above must not be used to refute the reload fixture.
          assert.equal(documents[1].navigationType, fixture.type);
          const emissions = after.filter((event) => event.kind === 'emitter' && event.methods.includes(fixture.method));
          assert.equal(emissions.length, 1, 'exactly one native call emits the fixture navigation');
          const emission = emissions[0];
          assert.equal(emission.documentId, documents[0].documentId, 'emitter captured before context destruction');
          assert.match(emission.stack, new RegExp(fixture.caller), 'new Error().stack includes the actual fixture caller');
          assert.ok(emission.callFrames.some((frame) => frame.functionName === fixture.caller), 'CDP independently captures the actual fixture caller');
          if (fixture.moduleId) {
            assert.ok(emission.modules.some((module) => module.moduleId === fixture.moduleId &&
              module.originalFactoryType === 'undefined' && module.optionsId === fixture.moduleId &&
              module.webpackFactoryType === 'undefined' && module.cached === false),
            'the actual emitter frame exposes the missing module and factory condition');
          } else {
            assert.deepEqual(emission.modules, [], 'ordinary navigation must not be attributed to a missing webpack factory');
          }
          assert.ok(after.indexOf(emission) < after.indexOf(documents[1]), 'emitter survives into the next document in chronological order');
          const unload = after.find((event) => event.kind === 'beforeunload');
          assert.ok(unload, 'beforeunload was persisted before navigation');
          assert.equal(unload.documentId, initialDocument.documentId);
          assert.match(unload.attribution, /alone does not identify the emitter/);
          assert.ok(unload.stack, 'lifecycle observer keeps its own stack without treating it as attribution');
          assert.deepEqual(probe.errors, []);

          const summary = summarize(probe.events, { targetPath, start: initialDocument.at, end: Date.now() + 1 });
          assert.equal(summary.documentCount, 2);
          assert.equal(summary.navigationTypes.navigate, fixture.type === 'reload' ? 1 : 2);
          assert.equal(summary.navigationTypes.reload, fixture.type === 'reload' ? 1 : 0);
          assert.equal(summary.successorNavigationTypes.navigate, fixture.type === 'reload' ? 0 : 1);
          assert.equal(summary.successorNavigationTypes.reload, fixture.type === 'reload' ? 1 : 0);
          assert.ok(summary.emitterCount >= 1);
          assert.equal(summary.beforeunloadCount, 1);

          // A loop spans more than one replacement context. Verify the next
          // native call is still observed after the first document was destroyed.
          await page.locator('#navigate').click({ noWaitAfter: true, timeout: 10_000 });
          await page.waitForFunction((key) => JSON.parse(sessionStorage.getItem(key) || '[]')
            .filter((event) => event.kind === 'document').length === 3, STORAGE_KEY, { timeout: 10_000 });
          await page.waitForLoadState('load');
          const twice = await probe.persisted();
          assert.deepEqual(twice.slice(0, after.length), after);
          assert.equal(twice.filter((event) => event.kind === 'armed').length, 3);
          const secondEmission = twice.filter((event) => event.kind === 'emitter' && event.methods.includes(fixture.method))[1];
          assert.ok(secondEmission, 'native call is observed again in the replacement document');
          assert.equal(secondEmission.documentId, documents[1].documentId);
          assert.match(secondEmission.stack, new RegExp(fixture.caller));
          assert.deepEqual(probe.errors, []);
          const receipt = makeReceipt(probe.events, { targetPath, errors: probe.errors, persistedEvents: twice });
          assert.equal(assessReceipt(receipt).status, 'OBSERVED', 'complete fixture coverage is observed, not H1 reproduction');
        } catch (error) {
          t.diagnostic(JSON.stringify({ fixture: fixturePath(fixture), errors: probe.errors, events: probe.events }, null, 2));
          throw error;
        } finally {
          await probe.close();
          await context.close();
        }
      });
    }
    await t.test('browser persistence failure reaches instrument errors before reload', { timeout: 15_000 }, async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const probe = await attachProbe(page);
      try {
        await page.goto(`${origin}/reload`, { waitUntil: 'load' });
        const before = await probe.persisted();
        assert.equal(before.filter((event) => event.kind === 'armed').length, 1);
        await page.evaluate((key) => {
          const original = Storage.prototype.setItem;
          Storage.prototype.setItem = function (itemKey, value) {
            if (itemKey === key) throw new DOMException('fixture storage quota exhausted', 'QuotaExceededError');
            return original.call(this, itemKey, value);
          };
        }, STORAGE_KEY);
        await page.locator('#navigate').click({ noWaitAfter: true });
        await page.waitForFunction((key) => JSON.parse(sessionStorage.getItem(key) || '[]')
          .filter((event) => event.kind === 'document').length === 2, STORAGE_KEY);
        await page.waitForLoadState('load');
        const persisted = await probe.persisted();
        const emission = probe.events.find((event) => event.kind === 'emitter');
        assert.ok(emission, 'the actual native reload is still captured outside the failing storage');
        assert.match(emission.persistenceError, /QuotaExceededError/);
        assert.ok(probe.errors.some((error) => /sessionStorage:.*QuotaExceededError/.test(error)));
        assert.ok(!persisted.some((event) => event.kind === 'emitter'), 'storage genuinely lost the pre-navigation emitter event');
        assertInconclusive(makeReceipt(probe.events, { targetPath: '/reload', errors: probe.errors, persistedEvents: persisted }),
          'instrument-errors', 'persistence-incomplete');
      } finally {
        await probe.close();
        await context.close();
      }
    });
    for (const targetPath of ['/protected', '/http500']) {
      await t.test(`browser ${targetPath} cannot qualify as an observed target`, { timeout: 10_000 }, async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        const probe = await attachProbe(page);
        try {
          await page.goto(`${origin}${targetPath}`, { waitUntil: 'load' });
          const receipt = makeReceipt(probe.events, {
            targetPath, finalPath: new URL(page.url()).pathname, errors: probe.errors, persistedEvents: await probe.persisted(),
          });
          assert.deepEqual(probe.errors, [], 'negative observation is distinct from an instrument malfunction');
          if (targetPath === '/protected') {
            assert.ok(probe.events.some((event) => event.kind === 'document-response' && event.path === '/login' && event.status === 200));
            assertInconclusive(receipt, 'target-not-observed', 'left-target-path', 'target-http-200-not-observed');
          } else {
            assert.ok(probe.events.some((event) => event.kind === 'document-response' && event.status === 500));
            assertInconclusive(receipt, 'http-error', 'target-http-200-not-observed');
          }
        } finally {
          await probe.close();
          await context.close();
        }
      });
    }
  } finally {
    if (browser) await browser.close();
    fixtureServer.closeAllConnections();
    await new Promise((resolve, reject) => fixtureServer.close((error) => error ? reject(error) : resolve()));
  }
});
