// Sammenligner fhi_table_label_mapping.csv med tabellene i FHI-API-et.
// Bruk: node scripts/check-labels.mjs [rapport.md]
// Skriver rapporten til fil (eller stdout) og setter `changed=true|false` i $GITHUB_OUTPUT.
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { parseTableLabelRows } from '../js/lib/csv.mjs';
import { compareLabels, formatReport } from '../js/lib/labelSync.mjs';

const API_BASE = 'https://statistikk-data.fhi.no/api/open/v1';

async function getJson(path) {
    const res = await fetch(API_BASE + path);
    if (!res.ok) throw new Error('GET ' + path + ' ga ' + res.status);
    return res.json();
}

const sources = await getJson('/Common/source');
const apiTables = [];
for (const source of sources) {
    const tables = await getJson('/' + source.id + '/Table');
    tables.forEach(function(t) {
        apiTables.push({ sourceId: source.id, tableId: t.tableId, title: t.title, publishedAt: t.publishedAt });
    });
}

const rows = parseTableLabelRows(readFileSync(new URL('../fhi_table_label_mapping.csv', import.meta.url), 'utf8'));
const result = compareLabels(rows, apiTables);
const geoLevels = JSON.parse(readFileSync(new URL('../table_geo_levels.json', import.meta.url), 'utf8'));
const missingGeo = apiTables.filter(function(t) { return !(t.sourceId + '/' + t.tableId in geoLevels); });
const changed = result.missing.length > 0 || result.obsolete.length > 0 || missingGeo.length > 0;

console.error(sources.length + ' kilder, ' + apiTables.length + ' tabeller i API-et, ' + rows.length + ' rader i label-filen. ' +
    'Mangler: ' + result.missing.length + ', utgått: ' + result.obsolete.length + ', uten geografiske nivåer: ' + missingGeo.length + '.');

const report = changed ? formatReport(result, new Date().toISOString().slice(0, 10), missingGeo) : '';
const out = process.argv[2];
if (out) writeFileSync(out, report);
else if (report) console.log(report);

if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'changed=' + changed + '\n');
