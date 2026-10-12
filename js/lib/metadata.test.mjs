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

test('firstSentenceFromMetadata hopper over innledende overskrift som eget avsnitt', () => {
    const para = function(content) { return { paragraphs: [{ header: 'Om statistikken', content: content }] }; };
    assert.equal(firstSentenceFromMetadata(para('<p><strong>Sammendrag</strong></p><p>Dødsfall med dødsårsak ulykke. Antall døde per år.</p>')),
        'Dødsfall med dødsårsak ulykke.');
    assert.equal(firstSentenceFromMetadata(para('<p><strong>Formål:</strong></p><p>Statistikk fra MSIS gir oversikt. Den brukes.</p>')),
        'Statistikk fra MSIS gir oversikt.');
    assert.equal(firstSentenceFromMetadata(para('<h3>Formål</h3><p>Tekst her.</p>')), 'Tekst her.');
    // Fet tekst inne i et avsnitt er ikke en overskrift.
    assert.equal(firstSentenceFromMetadata(para('<p><strong>Alle</strong> dødsfall telles.</p>')), 'Alle dødsfall telles.');
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
