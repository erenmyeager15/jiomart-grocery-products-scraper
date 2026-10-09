import assert from 'node:assert/strict';
import test from 'node:test';

import { buildFetchModes, classifyCompletion } from '../dist/run-policy.js';
import { isReadableCatalogPayload } from '../dist/routes.js';

test('uses direct access before a bounded configured-proxy fallback', () => {
    assert.deepEqual(buildFetchModes(true), ['direct', 'proxy', 'proxy']);
    assert.deepEqual(buildFetchModes(false), ['direct', 'direct', 'direct']);
});

test('treats a verified empty or fully filtered catalogue as a successful outcome', () => {
    assert.equal(classifyCompletion({ savedCount: 0, spendingLimitReached: false, sourceValidQueryCount: 1 }), 'valid-empty');
    assert.equal(classifyCompletion({ savedCount: 0, spendingLimitReached: false, sourceValidQueryCount: 0 }), 'failed');
    assert.equal(classifyCompletion({ savedCount: 1, spendingLimitReached: false, sourceValidQueryCount: 1 }), 'saved');
    assert.equal(classifyCompletion({ savedCount: 0, spendingLimitReached: true, sourceValidQueryCount: 0 }), 'saved');
});

test('distinguishes recognized empty catalogues from malformed payloads', () => {
    assert.equal(isReadableCatalogPayload({ url: 'x', json: { items: [] } }), true);
    assert.equal(isReadableCatalogPayload({ url: 'x', json: { data: { products: [] } } }), true);
    assert.equal(isReadableCatalogPayload({ url: 'x', json: { message: 'ok' } }), false);
    assert.equal(isReadableCatalogPayload({ url: 'x', json: null }), false);
});
