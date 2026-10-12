// Gir modulene og stilarket versjonsnummer i index.html før publisering (kjøres av .github/workflows/static.yml).
// Bruk: node scripts/version-assets.mjs
// Endrer index.html på stedet; ikke commit resultatet.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { versionIndexHtml } from '../js/lib/assetVersions.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

function walk(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap(function(entry) {
        const full = join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
    });
}

const files = walk(join(root, 'js'))
    .filter(function(f) { return /\.m?js$/.test(f) && !/\.test\.mjs$/.test(f); })
    .concat([join(root, 'styles', 'app.css')]);

const versions = {};
files.forEach(function(file) {
    const path = relative(root, file).split('\\').join('/');
    versions[path] = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 10);
});

const indexPath = join(root, 'index.html');
writeFileSync(indexPath, versionIndexHtml(readFileSync(indexPath, 'utf8'), versions));
console.log('Versjonerte ' + Object.keys(versions).length + ' filer i index.html.');
