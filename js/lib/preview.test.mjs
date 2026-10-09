import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewToTable, previewToCsv, csvFileName } from './preview.mjs';
import { findMetricDimension } from './query.mjs';

// 2 geo × 2 år × 2 måltall, siste dimensjon varierer raskest
const withMetric = {
    id: ['GEO', 'AAR', 'MEASURE_TYPE'],
    dimension: {
        GEO: { label: 'Geografi', category: { index: ['03', '32'], label: { '03': 'Oslo', '32': 'Akershus' } } },
        AAR: { label: 'År', category: { index: ['2023', '2024'], label: { '2023': '2023', '2024': '2024' } } },
        MEASURE_TYPE: { label: 'Måltall', role: 'metric', category: { index: ['N', 'R'], label: { N: 'Antall', R: 'Rate' } } }
    },
    value: [1, 2, 3, 4, 5, 6, 7, 8]
};

const withoutMetric = {
    id: ['GEO', 'KJONN'],
    dimension: {
        GEO: { label: 'Geografi', category: { index: ['03'], label: { '03': 'Oslo' } } },
        KJONN: { label: 'Kjønn', category: { index: ['1', '2'], label: { '1': 'Menn', '2': 'Kvinner' } } }
    },
    value: [10, 20]
};

test('previewToTable pivoterer måltall til kolonner', () => {
    const t = previewToTable(withMetric, findMetricDimension);
    assert.deepEqual(t.columns.map(c => c.label), ['GEO-kode', 'Geografi', 'År', 'Antall', 'Rate']);
    assert.deepEqual(t.rows[0], ['03', 'Oslo', '2023', 1, 2]);
    assert.deepEqual(t.rows[3], ['32', 'Akershus', '2024', 7, 8]);
    assert.equal(t.totalRows, 4);
    assert.equal(t.summary, '4 rader totalt (8 verdier, 2 måltall)');
});

test('previewToTable uten måltall gir én rad per verdi', () => {
    const t = previewToTable(withoutMetric, findMetricDimension);
    assert.deepEqual(t.columns.map(c => c.label), ['GEO-kode', 'Geografi', 'Kjønn', 'Verdi']);
    assert.deepEqual(t.rows, [['03', 'Oslo', 'Menn', 10], ['03', 'Oslo', 'Kvinner', 20]]);
});

test('previewToTable respekterer maks antall rader', () => {
    const t = previewToTable(withMetric, findMetricDimension, 2);
    assert.equal(t.rows.length, 2);
    assert.equal(t.totalRows, 4);
});

test('previewToTable leser CSV-tekst', () => {
    const t = previewToTable({ csvText: '"a";"b"\n1;2\n3;4\n' }, findMetricDimension);
    assert.deepEqual(t.columns.map(c => c.label), ['a', 'b']);
    assert.deepEqual(t.rows, [['1', '2'], ['3', '4']]);
});

test('previewToCsv med måltall', () => {
    assert.equal(
        previewToCsv(withMetric, findMetricDimension),
        'GeoCode,Geografi,År,Antall,Rate\n' +
        '03,"Oslo","2023",1,2\n03,"Oslo","2024",3,4\n32,"Akershus","2023",5,6\n32,"Akershus","2024",7,8\n'
    );
});

test('previewToCsv uten måltall', () => {
    assert.equal(
        previewToCsv(withoutMetric, findMetricDimension),
        'Geografi,Kjønn,Verdi\n"Oslo","Menn",10\n"Oslo","Kvinner",20\n'
    );
});

test('csvFileName', () => {
    assert.equal(csvFileName('daar', '643', new Date(2026, 9, 1)), 'fhi_daar_643_2026-10-01.csv');
});
