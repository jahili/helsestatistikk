import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonStatToRows, chartPlan, chartPoints, geoLevel, geoLevelsIn, defaultGeoLevel, facetCandidates, sharedExtent } from './jsonstat.mjs';

// Utdrag av ekte svar fra daar/277 (prikkede verdier som ":") og nokkel/366 (to måltall).
const ulykker = {
    id: ['DAAR', 'KJONN', 'ULYKKER', 'MEASURE_TYPE'],
    size: [2, 2, 2, 1],
    role: { time: null, geo: [], metric: ['MEASURE_TYPE'] },
    dimension: {
        DAAR: { label: 'Dødsår', category: { index: ['1996', '1997'], label: { '1996': '1996', '1997': '1997' } } },
        KJONN: { label: 'Kjønn', category: { index: ['2', '1'], label: { '1': 'Mann', '2': 'Kvinne' } } },
        ULYKKER: { label: 'Dødsårsak', category: { index: ['1', '2'], label: { '1': 'Trafikk', '2': 'Transport' } } },
        MEASURE_TYPE: { label: 'Måltall', category: { index: ['Freq'], label: { Freq: 'Antall dødsfall' },
            unit: { Freq: { decimals: 0, label: 'Antall dødsfall' } } } }
    },
    value: [96, 3, 177, 34, 94, ':', 221, ':'],
    extension: { flags: { index: [':'], label: { ':': 'Anonymisert eller skjult av andre årsaker' } } }
};

const ulikhet = {
    id: ['GEO', 'AAR', 'MEASURE_TYPE'],
    size: [3, 2, 2],
    role: { time: null, geo: [], metric: ['MEASURE_TYPE'] },
    dimension: {
        GEO: { label: 'Geografi', category: { index: ['0', '03', '32'], label: { '0': 'Hele landet', '32': 'Akershus', '03': 'Oslo (fylke)' } } },
        AAR: { label: 'År', category: { index: ['2009_2009', '2010_2010'], label: { '2009_2009': '2009', '2010_2010': '2010' } } },
        MEASURE_TYPE: { label: 'Måltall', category: { index: ['MALTALL', 'GINI'], label: { MALTALL: 'P90/P10', GINI: 'Gini-koeffisient' },
            unit: { MALTALL: { decimals: 1, label: 'P90/P10' }, GINI: { decimals: 2, label: 'Gini-koeffisient' } } } }
    },
    value: [2.6, 0.231, 2.6, 0.236, 3.4, 0.296, 3.4, 0.31, 2.9, 0.25, 2.9, 0.26]
};

test('jsonStatToRows gir én rad per verdi med koder, siste dimensjon raskest', () => {
    const data = jsonStatToRows(ulykker);
    assert.equal(data.rows.length, 8);
    assert.deepEqual(data.rows[0], { DAAR: '1996', KJONN: '2', ULYKKER: '1', MEASURE_TYPE: 'Freq', value: 96, flag: null });
    assert.deepEqual(data.rows[7], { DAAR: '1997', KJONN: '1', ULYKKER: '2', MEASURE_TYPE: 'Freq', value: null, flag: ':' });
    assert.equal(data.flags[':'], 'Anonymisert eller skjult av andre årsaker');
});

test('jsonStatToRows finner roller og beholder rekkefølgen i category.index', () => {
    const data = jsonStatToRows(ulikhet);
    assert.deepEqual(data.dimensions.map(d => d.role), ['geo', 'time', 'metric']);
    assert.deepEqual(data.dimensions[0].categories.map(c => c.label), ['Hele landet', 'Oslo (fylke)', 'Akershus']);
    assert.deepEqual(data.dimensions[2].categories[1].unit, { decimals: 2, label: 'Gini-koeffisient' });
});

test('jsonStatToRows godtar category.index som objekt og avviser ugyldig input', () => {
    const ds = { id: ['A'], dimension: { A: { label: 'A', category: { index: { y: 1, x: 0 }, label: { x: 'X', y: 'Y' } } } }, value: [1, 2] };
    assert.deepEqual(jsonStatToRows(ds).rows.map(r => r.A), ['x', 'y']);
    assert.equal(jsonStatToRows(null), null);
    assert.equal(jsonStatToRows({ csvText: 'a;b' }), null);
});

test('chartPlan: tid gir linje, minste andre dimensjon blir farge, resten låses', () => {
    const plan = chartPlan(jsonStatToRows(ulykker));
    assert.equal(plan.type, 'line');
    assert.equal(plan.x.id, 'DAAR');
    assert.equal(plan.series.id, 'KJONN');
    assert.deepEqual(plan.filters.map(d => d.id), ['ULYKKER']);
});

test('chartPlan: flere måltall må låses til ett', () => {
    const plan = chartPlan(jsonStatToRows(ulikhet));
    assert.equal(plan.type, 'line');
    assert.equal(plan.series.id, 'GEO');
    assert.deepEqual(plan.filters.map(d => d.id), ['MEASURE_TYPE']);
});

test('chartPlan: uten tid blir det søyler langs geografi', () => {
    const ds = JSON.parse(JSON.stringify(ulikhet));
    ds.size = [3, 1, 2];
    ds.dimension.AAR.category = { index: ['2010_2010'], label: { '2010_2010': '2010' } };
    ds.value = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
    const plan = chartPlan(jsonStatToRows(ds));
    assert.equal(plan.type, 'bar');
    assert.equal(plan.x.id, 'GEO');
    assert.equal(plan.series, null);
});

test('chartPlan: ingen figur når bare måltallet varierer', () => {
    const ds = { id: ['M'], role: { metric: ['M'] }, dimension: { M: { label: 'Måltall', category: { index: ['a', 'b'], label: { a: 'A', b: 'B' } } } }, value: [1, 2] };
    const plan = chartPlan(jsonStatToRows(ds));
    assert.equal(plan.type, 'none');
    assert.ok(plan.reason);
});

test('chartPoints filtrerer på låste verdier og teller manglende', () => {
    const data = jsonStatToRows(ulykker);
    const plan = chartPlan(data);
    const first = chartPoints(data, plan, {});
    assert.deepEqual(first.points.map(p => [p.x, p.series, p.value]), [['1996', 'Kvinne', 96], ['1996', 'Mann', 177], ['1997', 'Kvinne', 94], ['1997', 'Mann', 221]]);
    assert.equal(first.missing, 0);
    const transport = chartPoints(data, plan, { ULYKKER: '2' });
    assert.equal(transport.missing, 2);
    assert.deepEqual(transport.seriesDomain, ['Kvinne', 'Mann']);
    assert.deepEqual(transport.unit, { label: 'Antall dødsfall', decimals: 0 });
    // Ukjent verdi faller tilbake til første kategori.
    assert.deepEqual(chartPoints(data, plan, { ULYKKER: 'finnes-ikke' }).points, first.points);
});

test('chartPoints bruker enheten til valgt måltall', () => {
    const data = jsonStatToRows(ulikhet);
    const plan = chartPlan(data);
    const gini = chartPoints(data, plan, { MEASURE_TYPE: 'GINI' });
    assert.deepEqual(gini.unit, { label: 'Gini-koeffisient', decimals: 2 });
    assert.deepEqual(gini.xDomain, ['2009', '2010']);
    assert.deepEqual(gini.points.filter(p => p.series === 'Akershus').map(p => p.value), [0.25, 0.26]);
});

test('geoLevel og geoLevelsIn kjenner igjen FHI sine geokoder', () => {
    assert.deepEqual(['0', '03', '0301', '030101', 'x'].map(geoLevel), ['land', 'fylke', 'kommune', 'bydel', null]);
    const dim = { role: 'geo', categories: ['0', '03', '32', '0301', '3201'].map(code => ({ code, label: code })) };
    assert.deepEqual(geoLevelsIn(dim).map(l => [l.id, l.count]), [['land', 1], ['fylke', 2], ['kommune', 2]]);
    assert.equal(defaultGeoLevel(geoLevelsIn(dim)), 'fylke');
    assert.deepEqual(geoLevelsIn({ role: 'geo', categories: [{ code: '03' }, { code: '32' }] }), []);
    assert.deepEqual(geoLevelsIn({ role: null, categories: [{ code: '0' }, { code: '03' }] }), []);
});

test('chartPoints viser valgt geonivå pluss hele landet, og begrenser antall søyler', () => {
    const codes = ['0', '03', '32'].concat(Array.from({ length: 70 }, (_, i) => String(1000 + i)));
    const ds = {
        id: ['GEO'], role: { geo: ['GEO'] },
        dimension: { GEO: { label: 'Geografi', category: { index: codes, label: Object.fromEntries(codes.map(c => [c, 'S' + c])) } } },
        value: codes.map((_, i) => i)
    };
    const data = jsonStatToRows(ds);
    const plan = chartPlan(data);
    assert.equal(plan.type, 'bar');
    assert.deepEqual(chartPoints(data, plan, {}, { geoLevel: 'fylke' }).xDomain, ['S0', 'S03', 'S32']);
    const kommuner = chartPoints(data, plan, {}, { geoLevel: 'kommune' });
    assert.deepEqual(kommuner.truncated, { shown: 60, total: 71 });
    assert.equal(kommuner.points.length, 60);
    assert.equal(chartPoints(data, plan, {}).truncated.total, 73);
});

test('defaultGeoLevel velger aldri hele landet når det finnes lavere nivåer', () => {
    assert.equal(defaultGeoLevel([{ id: 'land', count: 1 }, { id: 'kommune', count: 1 }]), 'kommune');
    assert.equal(defaultGeoLevel([]), null);
});

test('facetCandidates gir låste dimensjoner som ikke er måltall', () => {
    const data = jsonStatToRows(ulikhet);
    assert.deepEqual(facetCandidates(chartPlan(data)), []);
    const plan = chartPlan(jsonStatToRows(ulykker));
    assert.deepEqual(facetCandidates(plan).map(d => d.id), ['ULYKKER']);
    assert.deepEqual(facetCandidates({ type: 'none', filters: [] }), []);
});

test('sharedExtent finner felles min og maks, med null for søyler', () => {
    const r = [{ points: [{ value: 3 }, { value: null }] }, { points: [{ value: 7 }] }];
    assert.deepEqual(sharedExtent(r, false), [3, 7]);
    assert.deepEqual(sharedExtent(r, true), [0, 7]);
    assert.equal(sharedExtent([{ points: [] }], false), null);
});
