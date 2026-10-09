import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableLabel, getTableCategory, flattenCategories } from './tableLabels.mjs';

test('getTableLabel bruker tableLabels-oppslag når tilgjengelig', () => {
    const tableLabels = { '123': { label: 'Fint navn', category: 'Skole' } };
    assert.equal(getTableLabel(tableLabels, { tableId: '123', title: 'Raw' }), 'Fint navn');
});

test('getTableLabel faller tilbake til table.title uten oppslag', () => {
    assert.equal(getTableLabel({}, { tableId: '999', title: 'Raw tittel' }), 'Raw tittel');
});

test('getTableCategory returnerer tom streng uten oppslag', () => {
    assert.equal(getTableCategory({}, { tableId: '999' }), '');
});

test('flattenCategories flater ut ett nivå med value/label', () => {
    const result = flattenCategories([{ value: '03', label: 'Viken' }, { value: '11', label: 'Rogaland' }]);
    assert.deepEqual(result.index, ['03', '11']);
    assert.equal(result.label['03'], 'Viken');
});

test('flattenCategories traverserer nøstede children rekursivt', () => {
    const result = flattenCategories([
        {
            value: 'group1',
            label: 'Gruppe 1',
            children: [
                { value: '03', label: 'Viken' },
                { value: '11', label: 'Rogaland' }
            ]
        }
    ]);
    // Ytre item mangler label på selve grupperingsnoden i praksis, men denne har
    // både value og label satt, så den telles også med i tillegg til barna.
    assert.deepEqual(result.index, ['group1', '03', '11']);
    assert.equal(result.label['03'], 'Viken');
    assert.equal(result.label['11'], 'Rogaland');
});

test('flattenCategories hopper over items uten value eller label, men traverserer children', () => {
    const result = flattenCategories([
        {
            children: [
                { value: '03', label: 'Viken' }
            ]
        }
    ]);
    assert.deepEqual(result.index, ['03']);
});

test('flattenCategories returnerer tomt resultat for ikke-array input', () => {
    assert.deepEqual(flattenCategories(undefined), { index: [], label: {} });
    assert.deepEqual(flattenCategories(null), { index: [], label: {} });
});

import { isTableMapped, fallbackTableLabel, hasReadableTitle } from './tableLabels.mjs';

test('isTableMapped', () => {
    assert.equal(isTableMapped({ '1': { label: 'x' } }, { tableId: 1 }), true);
    assert.equal(isTableMapped({}, { tableId: 1 }), false);
});

test('fallbackTableLabel bruker lesbar tittel, ellers metadata, ellers intern tittel', () => {
    assert.equal(fallbackTableLabel({ tableId: 1, title: 'Personskader totalt' }, {}), 'Personskader totalt');
    assert.equal(fallbackTableLabel({ tableId: 932, title: 'INNVAND_INNVKAT' }, { 932: 'Antall innvandrere' }), 'Antall innvandrere');
    assert.equal(fallbackTableLabel({ tableId: 932, title: 'INNVAND_INNVKAT' }, {}), 'INNVAND_INNVKAT');
    assert.equal(hasReadableTitle({ title: 'INNVAND_INNVKAT' }), false);
});
