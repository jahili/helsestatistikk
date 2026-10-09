import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstSentenceFromMetadata, labelFromMetadata } from './metadata.mjs';

const meta = { paragraphs: [
    { header: 'Geografi', content: 'Hopp over. Denne.' },
    { header: 'Beskrivelse', content: '<p>Antall og andel personer innvandret. Mer tekst.</p>' }
] };

test('firstSentenceFromMetadata hopper over Geografi og fjerner HTML', () => {
    assert.equal(firstSentenceFromMetadata(meta), 'Antall og andel personer innvandret.');
    assert.equal(firstSentenceFromMetadata(null), '');
});

test('labelFromMetadata fjerner punktum og ledende «Sammendrag»', () => {
    assert.equal(labelFromMetadata(meta), 'Antall og andel personer innvandret');
    assert.equal(labelFromMetadata({ paragraphs: [{ header: 'X', content: 'Sammendrag Nye tilfeller av sykdom.' }] }), 'Nye tilfeller av sykdom');
});

test('labelFromMetadata kutter lange setninger ved ordgrense', () => {
    const long = { paragraphs: [{ header: 'X', content: 'Ord '.repeat(40).trim() + '.' }] };
    const label = labelFromMetadata(long, 30);
    assert.ok(label.endsWith(' …'));
    assert.ok(label.length <= 32);
    assert.ok(!label.includes('Or …'));
});
