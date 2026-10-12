import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSelection } from './defaults.mjs';
import { expectedRows } from './selection.mjs';

function dim(code, label, codes, categories) {
    const labels = Object.fromEntries(codes.map(c => [c, 'L' + c]));
    return { code, label, category: { index: codes, label: labels }, categories: categories || codes.map(c => ({ value: c, label: 'L' + c, children: [] })) };
}
const years = n => Array.from({ length: n }, (_, i) => String(2000 + i));

test('tid: de siste ti årene, alle hvis det er færre', () => {
    const cfg = defaultSelection([dim('AAR', 'År', years(16)), dim('DAAR', 'Dødsår', years(4))]);
    assert.deepEqual(cfg.AAR.selectedCategories, years(16).slice(-10));
    assert.equal(cfg.AAR.filter, 'item');
    assert.equal(cfg.DAAR.filter, 'all');
});

test('geografi: hele landet og fylker når det er mange enheter', () => {
    const codes = ['0', '03', '32'].concat(Array.from({ length: 40 }, (_, i) => String(3200 + i)));
    const cfg = defaultSelection([dim('GEO', 'Geografi', codes)]);
    assert.deepEqual(cfg.GEO.selectedCategories, ['0', '03', '32']);
    assert.equal(defaultSelection([dim('GEO', 'Geografi', ['0', '03', '32'])]).GEO.filter, 'all');
});

test('måltall og små dimensjoner tas med i sin helhet', () => {
    const cfg = defaultSelection([dim('MEASURE_TYPE', 'Måltall', ['a', 'b', 'c']), dim('KJONN', 'Kjønn', ['0', '1', '2'])]);
    assert.equal(cfg.MEASURE_TYPE.filter, 'all');
    assert.equal(cfg.KJONN.filter, 'all');
});

test('store dimensjoner med hierarki får øverste nivå', () => {
    const codes = ['Total'].concat(Array.from({ length: 30 }, (_, i) => String(i)));
    const tree = [{ value: 'Total', label: 'Alle aldre', children: codes.slice(1).map(c => ({ value: c, label: c, children: [] })) }];
    const cfg = defaultSelection([dim('ALDER', 'Alder', codes, tree)]);
    assert.deepEqual(cfg.ALDER.selectedCategories, ['Total']);
    const flat = defaultSelection([dim('DIAG', 'Diagnose', codes.slice(1))]);
    assert.deepEqual(flat.DIAG.selectedCategories, ['0']);
});

test('for mange rader gir færre år og oppsummeringsnivå', () => {
    const geo = ['0', '03', '32', '33', '34', '39', '40', '42', '46', '50', '55', '56'].concat(Array.from({ length: 30 }, (_, i) => String(3200 + i)));
    const dims = [dim('GEO', 'Geografi', geo), dim('AAR', 'År', years(30)), dim('KJONN', 'Kjønn', ['0', '1', '2']),
        dim('ALDER', 'Alder', years(12)), dim('UTD', 'Utdanning', years(12)), dim('MEASURE_TYPE', 'Måltall', ['a', 'b'])];
    const cfg = defaultSelection(dims);
    assert.ok(expectedRows(dims, cfg).total <= 30000, 'rader: ' + expectedRows(dims, cfg).total);
    assert.equal(cfg.AAR.selectedCategories.length, 5);
    assert.equal(cfg.MEASURE_TYPE.filter, 'all');
});

test('tom liste gir tomt utvalg', () => {
    assert.deepEqual(defaultSelection([]), {});
    assert.deepEqual(defaultSelection(null), {});
});
