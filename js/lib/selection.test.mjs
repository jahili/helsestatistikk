import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTimeDimension, matchesWildcard, selectedCount, isFiltered, expectedRows, selectionSummary } from './selection.mjs';

const year = { code: 'AAR', label: 'År', category: { index: ['2020', '2021', '2022', '2023'] } };
const geo = { code: 'GEO', label: 'Geografi', category: { index: ['0', '03', '0301', '030101', '32', '3201'] } };
const sex = { code: 'KJONN', label: 'Kjønn', category: { index: ['0', '1', '2'] } };

test('isTimeDimension kjenner igjen år-dimensjoner', () => {
    assert.equal(isTimeDimension(year), true);
    assert.equal(isTimeDimension({ code: 'DAAR', label: 'Dødsår' }), true);
    assert.equal(isTimeDimension(sex), false);
    assert.equal(isTimeDimension({ code: 'EU_SHORT_CODE', label: 'Dødsårsak' }), false);
    assert.equal(isTimeDimension({ code: 'SKOLEAAR', label: 'Skoleår' }), true);
});

test('matchesWildcard', () => {
    assert.equal(matchesWildcard('0301', '03*'), true);
    assert.equal(matchesWildcard('3201', '03*'), false);
    assert.equal(matchesWildcard('anything', '*'), true);
    assert.equal(matchesWildcard('03', '03'), true);
});

test('selectedCount per filtertype', () => {
    assert.equal(selectedCount(year, { filter: 'all', values: ['*'] }), 4);
    assert.equal(selectedCount(year, { filter: 'top', topCount: '2' }), 2);
    assert.equal(selectedCount(year, { filter: 'top', topCount: '10' }), 4);
    assert.equal(selectedCount(year, { filter: 'top' }), 4);
    assert.equal(selectedCount(sex, { filter: 'item', selectedCategories: ['1'] }), 1);
    assert.equal(selectedCount(geo, { filter: 'all', values: ['03*'] }), 3);
    assert.equal(selectedCount(sex, undefined), 3);
});

test('isFiltered', () => {
    assert.equal(isFiltered(sex, { filter: 'all', values: ['*'] }), false);
    assert.equal(isFiltered(sex, { filter: 'item', selectedCategories: ['1'] }), true);
});

test('expectedRows multipliserer valgte verdier', () => {
    const result = expectedRows([year, sex], {
        AAR: { filter: 'top', topCount: '2' },
        KJONN: { filter: 'all', values: ['*'] }
    });
    assert.deepEqual(result, { total: 6, factors: [2, 3] });
    assert.deepEqual(expectedRows([], {}), { total: 0, factors: [] });
});

test('selectionSummary gir korte tekster om utvalget', () => {
    const dim = { code: 'GEO', category: { index: ['0', '03', '32', '33'], label: { '0': 'Hele landet', '03': 'Oslo', '32': 'Akershus', '33': 'Buskerud' } } };
    assert.equal(selectionSummary(dim, { filter: 'all', values: ['*'] }), 'Alle (4)');
    assert.equal(selectionSummary(dim, { filter: 'item', selectedCategories: ['03', '32'] }), 'Oslo, Akershus');
    assert.equal(selectionSummary(dim, { filter: 'item', selectedCategories: ['0', '03', '32'] }, 2), '3 av 4');
    assert.equal(selectionSummary({ code: 'K', category: { index: ['T'], label: { T: 'Begge kjønn' } } }, null), 'Begge kjønn');
});
