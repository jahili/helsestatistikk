import test from 'node:test';
import assert from 'node:assert/strict';
import { getGeographyGroups } from './geo.mjs';

function makeGeoDimension() {
    return {
        code: 'GEO',
        category: {
            index: ['03', '0301', '030101'],
            label: { '03': 'Viken', '0301': 'Oslo', '030101': 'Gamle Oslo' }
        }
    };
}

test('returnerer null for ikke-GEO-dimensjoner', () => {
    assert.equal(getGeographyGroups({ code: 'AAR' }), null);
});

test('grupperer koder etter lengde (fylke/kommune/bydel)', () => {
    const result = getGeographyGroups(makeGeoDimension());
    assert.deepEqual(result.counties.map((c) => c.code), ['03']);
    assert.deepEqual(result.municipalities.map((m) => m.code), ['0301']);
    assert.deepEqual(result.districts.map((d) => d.code), ['030101']);
});

test('bygger hierarki fylke -> kommune -> bydel', () => {
    const result = getGeographyGroups(makeGeoDimension());
    assert.deepEqual(result.hierarchy['03'].municipalities.map((m) => m.code), ['0301']);
    assert.deepEqual(result.hierarchy['03'].districts['0301'].map((d) => d.code), ['030101']);
});

test('henger levekårssoner (10 sifre) på kommunen sin i stedet for i «andre»', () => {
    const result = getGeographyGroups({
        code: 'GEO',
        category: {
            index: ['0', '31', '3101', '3110', '3101000001', '3101000002', '46', '4601', '460101', '4601010105'],
            label: {
                '0': 'Hele landet', '31': 'Østfold', '3101': 'Halden', '3110': 'Hvaler',
                '3101000001': 'Halden LKS 01', '3101000002': 'Halden LKS 02',
                '46': 'Vestland', '4601': 'Bergen', '460101': 'Bergenhus', '4601010105': 'Bergen LKS 010105'
            }
        }
    });
    assert.deepEqual(result.others.map((o) => o.code), ['0']);
    assert.deepEqual(result.zones.map((z) => z.code), ['3101000001', '3101000002', '4601010105']);
    assert.deepEqual(result.hierarchy['31'].zones['3101'].map((z) => z.label), ['Halden LKS 01', 'Halden LKS 02']);
    assert.deepEqual(result.hierarchy['31'].zones['3110'], []);
    // I Bergen ligger sonene under kommunen, ved siden av bydelene.
    assert.deepEqual(result.hierarchy['46'].districts['4601'].map((d) => d.code), ['460101']);
    assert.deepEqual(result.hierarchy['46'].zones['4601'].map((z) => z.code), ['4601010105']);
});
