import test from 'node:test';
import assert from 'node:assert/strict';
import { getGeographyGroups, geoLevelsOfDimensions, isGeographyDimension, geoKey, isExpiredGeoLabel } from './geo.mjs';

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

test('geoLevelsOfDimensions kjenner igjen FHI-koder, andre geografidimensjoner og helseregioner', () => {
    const tree = (pairs) => pairs.map(([value, label, children]) => ({ value, label, children: children ? tree(children) : [] }));
    const gEO = { code: 'GEO', categories: tree([['0', 'Hele landet', [['03', 'Oslo', [['0301', 'Oslo', [['030101', 'Gamle Oslo'], ['0301010101', 'Sone 1']]]]]]]]) };
    assert.deepEqual(geoLevelsOfDimensions([gEO]), ['N', 'F', 'K', 'B', 'LKS']);
    const fylke = { code: 'FYLKE', label: 'Bofylke', categories: tree([['Total', 'Hele landet', [['3', 'Oslo'], ['32', 'Akershus']]]]) };
    assert.deepEqual(geoLevelsOfDimensions([fylke]), ['N', 'F']);
    const zz = { code: 'BOFYLKE_K', label: 'Bustadsfylke', categories: tree([['ZZ', 'Heile landet', [['31', 'Østfold']]]]) };
    assert.deepEqual(geoLevelsOfDimensions([zz]), ['N', 'F']);
    const region = { code: 'BOSTED', label: 'Bostedsregion', categories: tree([['9000', 'Landet'], ['1000', 'Region Sør-Øst']]) };
    assert.deepEqual(geoLevelsOfDimensions([region]), ['N', 'R']);
    const flat = { code: 'GEO', category: { index: ['0', '32'], label: { '0': 'Hele landet', '32': 'Akershus' } } };
    assert.deepEqual(geoLevelsOfDimensions([flat]), ['N', 'F']);
});

test('geoLevelsOfDimensions overser dimensjoner som ikke er geografi', () => {
    const alder = { code: 'ALDER', label: 'Alder', categories: [{ value: '10', label: '10 år', children: [] }] };
    const dodssted = { code: 'DODSSTED', label: 'Dødssted', categories: [{ value: '1', label: 'Sykehus', children: [] }] };
    assert.deepEqual(geoLevelsOfDimensions([alder, dodssted]), []);
    assert.equal(isGeographyDimension({ code: 'Geografi', label: 'Geografi' }), true);
});

test('geoLevelsOfDimensions tåler tekst etter koden og manglende ledende null', () => {
    const tree = (pairs) => pairs.map(([value, label, children]) => ({ value, label, children: children ? tree(children) : [] }));
    const sted = { code: 'Sted', label: 'Geografi (landet, fylker, kommuner)',
        categories: tree([['Landet', 'Hele landet', [['01 Østfold (2008-2019)', '01 Østfold (2008-2019)', [['0101 Halden (2008-2019)', '0101 Halden']]]]]]) };
    assert.deepEqual(geoLevelsOfDimensions([sted]), ['N', 'F', 'K']);
    const kommune = { code: 'KOMMUNE', label: 'Bokommune', categories: tree([['301', 'Oslo'], ['4601', 'Bergen']]) };
    assert.deepEqual(geoLevelsOfDimensions([kommune]), ['K']);
});

test('getGeographyGroups grupperer KPR-koder med navn og gyldighetsperiode, og koder uten ledende null', () => {
    const codes = ['Landet', '01 Østfold (2008-2019)', '0101 Halden (2008-2019)', '16 Sør-Trøndelag (2008-2017)', '1621 Ørland (2008-2017)', '31 Østfold', '3101 Halden'];
    const kpr = getGeographyGroups({ code: 'Sted', label: 'Geografi (landet, fylker, kommuner)',
        category: { index: codes, label: Object.fromEntries(codes.map(c => [c, c])) } });
    assert.deepEqual(kpr.others.map(o => o.code), ['Landet']);
    assert.deepEqual(kpr.hierarchy['16 Sør-Trøndelag (2008-2017)'].municipalities.map(m => m.code), ['1621 Ørland (2008-2017)']);
    assert.deepEqual(kpr.hierarchy['01 Østfold (2008-2019)'].municipalities.map(m => m.code), ['0101 Halden (2008-2019)']);
    assert.deepEqual(kpr.hierarchy['31 Østfold'].municipalities.map(m => m.code), ['3101 Halden']);
    const fylke = getGeographyGroups({ code: 'KOMMUNE', label: 'Bokommune',
        category: { index: ['3', '301'], label: { '3': 'Oslo', '301': 'Oslo kommune' } } });
    assert.deepEqual(fylke.hierarchy['3'].municipalities.map(m => m.code), ['301']);
    assert.equal(geoKey('0101 Halden (2008-2019)'), '0101');
    assert.equal(geoKey('Total'), null);
});

test('utgåtte enheter gjenkjennes og fylkene sorteres med gjeldende først', () => {
    assert.equal(isExpiredGeoLabel('01 Østfold (2008-2019)'), true);
    assert.equal(isExpiredGeoLabel('31 Østfold (2024->)'), false);
    assert.equal(isExpiredGeoLabel('Akershus'), false);
    const codes = ['01 Østfold (2008-2019)', '03 Oslo (2008->)', '31 Østfold (2024->)'];
    const g = getGeographyGroups({ code: 'Sted', label: 'Geografi', category: { index: codes, label: Object.fromEntries(codes.map(c => [c, c])) } });
    assert.deepEqual(g.counties.map(c => c.code), ['03 Oslo (2008->)', '31 Østfold (2024->)', '01 Østfold (2008-2019)']);
});
