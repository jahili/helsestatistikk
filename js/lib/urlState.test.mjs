import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeState, decodeState, applyUrlSelection } from './urlState.mjs';

const dims = [
    { code: 'GEO', category: { index: ['0', '03', '32'] } },
    { code: 'AAR', category: { index: ['2023_2023', '2024_2024'] } },
    { code: 'MEASURE_TYPE', category: { index: ['A', 'B'] } },
    { code: 'KOMM', category: { index: ['0301', '3201', '3301'] } }
];
const queryConfig = {
    GEO: { filter: 'item', values: ['*'], selectedCategories: ['0', '03'] },
    AAR: { filter: 'top', values: ['*'], selectedCategories: [], topCount: '2' },
    MEASURE_TYPE: { filter: 'all', values: ['*'], selectedCategories: [] },
    KOMM: { filter: 'all', values: ['03*', '32*'], selectedCategories: [] }
};

test('encodeState lager lesbart fragment med alle dimensjoner', () => {
    const hash = encodeState({
        sourceId: 'nokkel', tableId: 366, view: 'tabell', format: 'csv2', maxRowCount: '1000',
        dimensions: dims, queryConfig, wildcardDims: { KOMM: true },
        chart: { filters: { MEASURE_TYPE: 'B' }, geoLevel: 'fylke', facet: 'KJONN' }
    });
    assert.equal(hash, 'kilde=nokkel&tabell=366&v.GEO=0,03&v.AAR=top:2&v.MEASURE_TYPE=*&v.KOMM=w:03*,32*' +
        '&vis=tabell&format=csv2&max=1000&f.MEASURE_TYPE=B&niva=fylke&del=KJONN');
});

test('encodeState utelater standardverdier og stopper ved manglende tabell', () => {
    assert.equal(encodeState({ sourceId: 'daar', tableId: null }), 'kilde=daar');
    assert.equal(encodeState({ sourceId: 'daar', tableId: 7, step: 3, view: 'figur', format: 'json-stat2', dimensions: [] }), 'kilde=daar&tabell=7&steg=utvalg');
    assert.equal(encodeState(null), '');
});

test('decodeState gjenskaper det encodeState skrev', () => {
    const hash = encodeState({ sourceId: 'nokkel', tableId: 366, view: 'api', dimensions: dims, queryConfig, wildcardDims: { KOMM: true },
        chart: { filters: { MEASURE_TYPE: 'B' }, geoLevel: 'kommune' } });
    const s = decodeState('#' + hash);
    assert.equal(s.sourceId, 'nokkel');
    assert.equal(s.tableId, '366');
    assert.equal(s.view, 'api');
    assert.equal(s.hasSelection, true);
    assert.deepEqual(s.dims.GEO.selectedCategories, ['0', '03']);
    assert.equal(s.dims.AAR.topCount, '2');
    assert.equal(s.dims.MEASURE_TYPE.filter, 'all');
    assert.deepEqual(s.dims.KOMM, { filter: 'all', values: ['03*', '32*'], selectedCategories: [], wildcard: true });
    assert.deepEqual(s.chart, { filters: { MEASURE_TYPE: 'B' }, geoLevel: 'kommune', facet: null });
});

test('decodeState tåler koder med komma, ugyldige verdier og tom streng', () => {
    const s = decodeState('kilde=x&tabell=1&v.D=a%2Cb,c&vis=tull&format=xml&max=abc&%E0%A4%A=1');
    assert.deepEqual(s.dims.D.selectedCategories, ['a,b', 'c']);
    assert.equal(s.view, null);
    assert.equal(s.format, null);
    assert.equal(s.maxRowCount, null);
    assert.equal(decodeState('').sourceId, null);
    assert.deepEqual(decodeState('kilde=x&v.D=').dims.D.selectedCategories, []);
});

test('applyUrlSelection hopper over koder som ikke finnes lenger', () => {
    const defaults = { GEO: { filter: 'all', values: ['*'], selectedCategories: [] }, AAR: { filter: 'all', values: ['*'], selectedCategories: [] } };
    const url = decodeState('v.GEO=0,99,03&v.AAR=top:9&v.KOMM=w:03*').dims;
    const r = applyUrlSelection(dims, defaults, url);
    assert.deepEqual(r.config.GEO.selectedCategories, ['0', '03']);
    assert.equal(r.dropped, 1);
    assert.equal(r.config.AAR.topCount, '2');
    assert.deepEqual(r.config.KOMM.values, ['03*']);
    assert.deepEqual(r.wildcardDims, { KOMM: true });
});

test('applyUrlSelection beholder standardvalget når ingen av kodene finnes', () => {
    const defaults = { GEO: { filter: 'item', values: ['*'], selectedCategories: ['0'] } };
    const r = applyUrlSelection(dims, defaults, decodeState('v.GEO=98,99').dims);
    assert.deepEqual(r.config.GEO.selectedCategories, ['0']);
    assert.equal(r.dropped, 2);
});
