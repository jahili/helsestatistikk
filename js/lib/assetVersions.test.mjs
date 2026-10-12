import { test } from 'node:test';
import assert from 'node:assert/strict';
import { versionIndexHtml, START, END } from './assetVersions.mjs';

const html = '<head>\n<link href="styles/app.css" rel="stylesheet"/></head>\n<body>\n<script>/* feilmelding */</script>\n' +
    '<script type="module" src="./js/app.js"></script>\n</body>';
const versions = { 'js/app.js': 'aaa', 'js/lib/csv.mjs': 'bbb', 'styles/app.css': 'ccc' };

test('versionIndexHtml legger inn import map før hovedskriptet og versjonerer src og href', () => {
    const out = versionIndexHtml(html, versions);
    const map = JSON.parse(out.split('<script type="importmap">')[1].split('</script>')[0]);
    assert.deepEqual(map, { imports: { './js/app.js': './js/app.js?v=aaa', './js/lib/csv.mjs': './js/lib/csv.mjs?v=bbb' } });
    assert.ok(out.indexOf('type="importmap"') < out.indexOf('<script type="module"'));
    assert.ok(out.indexOf('/* feilmelding */') < out.indexOf('type="importmap"'));
    assert.ok(out.includes('<script type="module" src="./js/app.js?v=aaa">'));
    assert.ok(out.includes('<link href="styles/app.css?v=ccc" rel="stylesheet"/>'));
});

test('versionIndexHtml kan kjøres flere ganger uten å duplisere', () => {
    const once = versionIndexHtml(html, versions);
    const twice = versionIndexHtml(once, Object.assign({}, versions, { 'js/app.js': 'ddd' }));
    assert.equal(twice.split(START).length, 2);
    assert.equal(twice.split(END).length, 2);
    assert.ok(twice.includes('src="./js/app.js?v=ddd"'));
    assert.ok(!twice.includes('aaa'));
});

test('versionIndexHtml krever et modulskript', () => {
    assert.throws(() => versionIndexHtml('<body></body>', versions), /script type="module"/);
});
