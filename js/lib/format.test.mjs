import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDateShort, formatDateLong, formatNumber, stepNumber, shortenApiUrl } from './format.mjs';

test('formatDateShort gir norsk kortdato', () => {
    assert.equal(formatDateShort('2026-10-01T08:00:00Z'), '1. okt. 2026');
    assert.equal(formatDateShort('2026-05-22'), '22. mai 2026');
    assert.equal(formatDateShort(undefined), '');
    assert.equal(formatDateShort('ikke en dato'), '');
});

test('formatDateLong gir norsk langdato', () => {
    assert.equal(formatDateLong('2026-10-01T23:59:00+02:00'), '1. oktober 2026');
});

test('formatNumber setter tusenskille', () => {
    assert.equal(formatNumber(630), '630');
    assert.equal(formatNumber(12345), '12 345');
    assert.equal(formatNumber(1234567), '1 234 567');
});

test('stepNumber nullfyller', () => {
    assert.equal(stepNumber(1), '01');
    assert.equal(stepNumber(4), '04');
});

test('shortenApiUrl korter ned vertsnavn og /api', () => {
    assert.equal(
        shortenApiUrl('https://statistikk-data.fhi.no/api/open/v1/daar/Table/643/data'),
        '…/open/v1/daar/Table/643/data'
    );
});
