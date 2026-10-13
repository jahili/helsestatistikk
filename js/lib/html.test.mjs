import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHtmlToTree, parseHTML, decodeEntities, safeHref } from './html.mjs';

test('parser nøstet HTML til et treeobjekt', () => {
    const tree = parseHtmlToTree('<p>Hei <strong>verden</strong></p>');
    assert.equal(tree.length, 1);
    assert.equal(tree[0].tag, 'p');
    assert.equal(tree[0].children[0], 'Hei ');
    assert.equal(tree[0].children[1].tag, 'strong');
    assert.equal(tree[0].children[1].children[0], 'verden');
});

test('rå tekst uten tagger gir én tekst-node', () => {
    assert.deepEqual(parseHtmlToTree('bare tekst'), ['bare tekst']);
});

test('parseHTML bruker injisert h-funksjon (ingen React nødvendig)', () => {
    const calls = [];
    const stubH = (tag, props, children) => {
        calls.push(tag);
        return { tag, props, children };
    };
    const result = parseHTML('<p><strong>Bold</strong></p>', stubH);
    assert.deepEqual(calls, ['strong', 'p']);
    assert.equal(result[0].tag, 'p');
});

test('parseHtmlToTree tar vare på attributter, også med bindestrek og uten verdi', () => {
    const tree = parseHtmlToTree('<p class="ingress">Hei <a href="https://fhi.no?a=1&amp;b=2">FHI</a></p><div data-kilder></div><br/>');
    assert.deepEqual(tree[0].attrs, { class: 'ingress' });
    assert.equal(tree[0].children[1].attrs.href, 'https://fhi.no?a=1&b=2');
    assert.deepEqual(tree[1].attrs, { 'data-kilder': '' });
    assert.equal(tree[2].tag, 'br');
});

test('decodeEntities og safeHref', () => {
    assert.equal(decodeEntities('A &amp; B &lt;3 &#171;x&#xBB; &ukjent;'), 'A & B <3 «x» &ukjent;');
    assert.equal(safeHref('https://fhi.no'), 'https://fhi.no');
    assert.equal(safeHref('mailto:a@b.no'), 'mailto:a@b.no');
    assert.equal(safeHref('#om'), '#om');
    assert.equal(safeHref('javascript:alert(1)'), null);
    assert.equal(safeHref(' JaVaScRiPt:x'), null);
});
