// Versjonsnummer på modulene ved publisering, så nettleseren ikke blander gamle og nye filer fra hurtigbufferen.
// Et import map i index.html peker hver modul til «fil.mjs?v=<hash av innholdet>». Brukes av scripts/version-assets.mjs.

export const START = '<!-- versjoner:start -->';
export const END = '<!-- versjoner:slutt -->';

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// versions: { 'js/app.js': 'a1b2c3', 'js/lib/csv.mjs': '...', 'styles/app.css': '...' }
export function versionIndexHtml(html, versions) {
    const blockPattern = new RegExp('\\s*' + escapeRegExp(START) + '[\\s\\S]*?' + escapeRegExp(END), 'g');
    let out = html.replace(blockPattern, '');

    const imports = {};
    Object.keys(versions).sort().forEach(function(path) {
        if (/\.m?js$/.test(path)) imports['./' + path] = './' + path + '?v=' + versions[path];
    });
    const block = START + '\n<script type="importmap">\n' + JSON.stringify({ imports: imports }, null, 2) + '\n</script>\n' + END + '\n';

    const moduleScript = out.search(/<script type="module"/);
    if (moduleScript === -1) throw new Error('Fant ikke <script type="module"> i index.html');
    out = out.slice(0, moduleScript) + block + out.slice(moduleScript);

    // Hovedskriptet og stilarket lastes direkte fra HTML, ikke via import map.
    Object.keys(versions).forEach(function(path) {
        const attr = new RegExp('((?:src|href)=")(\\./)?' + escapeRegExp(path) + '(\\?v=[^"]*)?"', 'g');
        out = out.replace(attr, function(_, prefix, dot) { return prefix + (dot || '') + path + '?v=' + versions[path] + '"'; });
    });
    return out;
}
