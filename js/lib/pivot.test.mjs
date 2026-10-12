import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonStatToRows } from './jsonstat.mjs';
import { pivotTable, pivotToCsv, defaultColumnDimension } from './pivot.mjs';

const ds = {
    id: ['GEO', 'AAR', 'KJONN', 'MEASURE_TYPE'],
    role: { metric: ['MEASURE_TYPE'] },
    dimension: {
        GEO: { label: 'Geografi', category: { index: ['0', '32'], label: { '0': 'Hele landet', '32': '=Akershus' } } },
        AAR: { label: 'År', category: { index: ['2023', '2024'], label: { '2023': '2023', '2024': '2024' } } },
        KJONN: { label: 'Kjønn', category: { index: ['0'], label: { '0': 'Begge kjønn' } } },
        MEASURE_TYPE: { label: 'Måltall', category: { index: ['RATE'], label: { RATE: 'Rate' }, unit: { RATE: { decimals: 1 } } } }
    },
    value: [1.5, 2.5, ':', 4]
};

test('defaultColumnDimension velger tid, deretter måltall', () => {
    const data = jsonStatToRows(ds);
    assert.equal(defaultColumnDimension(data), 'AAR');
    const noTime = jsonStatToRows(Object.assign({}, ds, { id: ['GEO', 'MEASURE_TYPE'], value: [1, 2],
        dimension: { GEO: ds.dimension.GEO, MEASURE_TYPE: { label: 'Måltall', category: { index: ['A', 'B'], label: { A: 'A', B: 'B' } } } } }));
    assert.equal(defaultColumnDimension(noTime), 'MEASURE_TYPE');
    assert.equal(defaultColumnDimension(null), null);
});

test('pivotTable: tid i kolonnene, faste dimensjoner over tabellen', () => {
    const p = pivotTable(jsonStatToRows(ds));
    assert.deepEqual(p.columns, ['2023', '2024']);
    assert.deepEqual(p.rowHeaders, ['Geografi']);
    assert.deepEqual(p.fixed, [{ label: 'Kjønn', value: 'Begge kjønn' }, { label: 'Måltall', value: 'Rate' }]);
    assert.deepEqual(p.rows.map(r => r.keys), [['Hele landet'], ['=Akershus']]);
    assert.deepEqual(p.rows[1].cells, [{ value: null, flag: ':', decimals: 1 }, { value: 4, flag: null, decimals: 1 }]);
    assert.equal(p.totalRows, 2);
});

test('pivotTable: annen kolonnedimensjon og radgrense', () => {
    const p = pivotTable(jsonStatToRows(ds), 'GEO', 1);
    assert.deepEqual(p.columns, ['Hele landet', '=Akershus']);
    assert.deepEqual(p.rowHeaders, ['År']);
    assert.equal(p.rows.length, 1);
    assert.equal(p.totalRows, 2);
});

test('pivotToCsv tar med alle rader, flagg og beskytter mot formler', () => {
    const csv = pivotToCsv(jsonStatToRows(ds), 'AAR');
    assert.equal(csv, '"Geografi","2023","2024"\n"Hele landet",1.5,2.5\n"\'=Akershus",":",4\n');
});
