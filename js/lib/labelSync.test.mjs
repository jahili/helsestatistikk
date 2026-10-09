import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareLabels, formatReport, REPORT_MARKER } from './labelSync.mjs';
import { parseTableLabelRows } from './csv.mjs';

const rows = [
    { sourceId: 'nokkel', tableId: '650', title: 'INNVAND_INNVKAT_Unge', label: 'Innvandrere', category: 'Befolkning' },
    { sourceId: 'daar', tableId: '643', title: 'D1', label: 'Dødsfall', category: 'Totalt' }
];
const api = [
    { sourceId: 'daar', tableId: 643, title: 'D1', publishedAt: '2026-10-01T00:00:00Z' },
    { sourceId: 'nokkel', tableId: 932, title: 'INNVAND_INNVKAT', publishedAt: '2026-09-30T09:10:10Z' }
];

test('compareLabels finner manglende og utgåtte tabeller per kilde og id', () => {
    const r = compareLabels(rows, api);
    assert.deepEqual(r.missing.map(t => t.tableId), [932]);
    assert.deepEqual(r.obsolete.map(t => t.tableId), ['650']);
});

test('compareLabels skiller på kilde, ikke bare tableId', () => {
    const r = compareLabels([{ sourceId: 'abr', tableId: '643', label: 'x' }], [{ sourceId: 'daar', tableId: 643 }]);
    assert.equal(r.missing.length, 1);
    assert.equal(r.obsolete.length, 1);
});

test('compareLabels er tom når alt stemmer', () => {
    const r = compareLabels(rows.slice(1), api.slice(0, 1));
    assert.deepEqual(r, { missing: [], obsolete: [] });
});

test('formatReport lager markdown med begge seksjoner', () => {
    const md = formatReport(compareLabels(rows, api), '2026-10-12');
    assert.ok(md.startsWith(REPORT_MARKER));
    assert.ok(md.includes('### Mangler i label-filen (1)'));
    assert.ok(md.includes('| `nokkel` | 932 | INNVAND_INNVKAT | 2026-09-30 |'));
    assert.ok(md.includes('### Finnes ikke lenger i API-et (1)'));
    assert.ok(md.includes('| `nokkel` | 650 | Innvandrere | Befolkning |'));
});

test('parseTableLabelRows tar med kilde og håndterer komma i fnutter og CRLF', () => {
    const r = parseTableLabelRows('source_id,tableId,title,label,category\r\nnokkel,1,"A, B","Lab, el","Tema"\r\n');
    assert.deepEqual(r, [{ sourceId: 'nokkel', tableId: '1', title: 'A, B', label: 'Lab, el', category: 'Tema' }]);
});
