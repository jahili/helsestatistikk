// Lagrer hvilke geografiske nivåer (N, F, K, B, LKS, R) hver tabell har, i table_geo_levels.json.
// Tabelloversikten i appen viser nivåene derfra, så den slipper å hente dimensjonene til alle tabellene.
// Bruk: node scripts/update-geo-levels.mjs   (kjør når den ukentlige sjekken melder om tabeller som mangler)
import { writeFileSync } from 'node:fs';
import { geoLevelsOfDimensions } from '../js/lib/geo.mjs';

const API_BASE = 'https://statistikk-data.fhi.no/api/open/v1';
const CONCURRENCY = 2;
const sleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };

// API-et svarer 429 når det får mange kall på kort tid, og av og til faller forbindelsen; vent og prøv igjen.
async function getJson(path) {
    for (let attempt = 1; attempt <= 8; attempt++) {
        let res = null;
        try {
            res = await fetch(API_BASE + path);
        } catch (err) {
            res = null;
        }
        if (res && res.ok) return res.json();
        if (res && res.status !== 429 && res.status < 500) throw new Error('GET ' + path + ' ga ' + res.status);
        await sleep(1500 * attempt);
    }
    throw new Error('GET ' + path + ' feilet etter flere forsøk');
}

const sources = await getJson('/Common/source');
const jobs = [];
for (const source of sources) {
    const tables = await getJson('/' + source.id + '/Table');
    tables.forEach(function(t) { jobs.push({ sourceId: source.id, tableId: t.tableId }); });
}

const result = {};
let next = 0;
let failed = 0;
async function worker() {
    while (next < jobs.length) {
        const job = jobs[next++];
        try {
            const data = await getJson('/' + job.sourceId + '/Table/' + job.tableId + '/dimension');
            const dims = Array.isArray(data) ? data : (data && data.dimensions) || [];
            result[job.sourceId + '/' + job.tableId] = geoLevelsOfDimensions(dims);
        } catch (err) {
            failed++;
            console.error(err.message);
        }
        await sleep(150);
    }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// Én tabell per linje, sortert, så endringer blir lette å lese i git.
const keys = Object.keys(result).sort(function(a, b) {
    const [sa, ta] = a.split('/');
    const [sb, tb] = b.split('/');
    return sa.localeCompare(sb) || Number(ta) - Number(tb);
});
const lines = keys.map(function(k) { return '  ' + JSON.stringify(k) + ': ' + JSON.stringify(result[k]); });
writeFileSync(new URL('../table_geo_levels.json', import.meta.url), '{\n' + lines.join(',\n') + '\n}\n');
console.log(keys.length + ' tabeller lagret' + (failed ? ', ' + failed + ' feilet' : '') + '.');
if (failed) process.exitCode = 1;
