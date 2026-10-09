// Sammenligner label-filen (fhi_table_label_mapping.csv) med tabellene i FHI-API-et.
// Brukes av scripts/check-labels.mjs og den ukentlige workflowen.

export const REPORT_MARKER = '<!-- tabell-labels-rapport -->';

function key(sourceId, tableId) {
    return sourceId + '/' + tableId;
}

// rows: fra parseTableLabelRows. apiTables: [{ sourceId, tableId, title, publishedAt }]
export function compareLabels(rows, apiTables) {
    const inFile = new Set(rows.map(function(r) { return key(r.sourceId, String(r.tableId)); }));
    const inApi = new Set(apiTables.map(function(t) { return key(t.sourceId, String(t.tableId)); }));
    const byNumber = function(a, b) {
        return a.sourceId.localeCompare(b.sourceId) || Number(a.tableId) - Number(b.tableId);
    };
    return {
        missing: apiTables.filter(function(t) { return !inFile.has(key(t.sourceId, String(t.tableId))); }).sort(byNumber),
        obsolete: rows.filter(function(r) { return !inApi.has(key(r.sourceId, String(r.tableId))); }).sort(byNumber)
    };
}

function cell(text) {
    return String(text == null ? '' : text).trim().replace(/\|/g, '\\|').replace(/\s+/g, ' ');
}

export function formatReport(result, checkedAt) {
    const lines = [
        REPORT_MARKER,
        'Den ukentlige sjekken fant forskjeller mellom `fhi_table_label_mapping.csv` og FHI-API-et (sjekket ' + checkedAt + ').',
        '',
        'FHI gir ofte en tabell ny `tableId` når den får ny årgang, ny struktur eller nytt innhold, og fjerner den gamle. ' +
        'Nye tabeller vises i appen under «Nye tabeller» til de får navn og tema i label-filen. ' +
        'Spørringer som er laget mot en utgått `tableId` (f.eks. Power Query i Power BI) må bygges på nytt.',
        ''
    ];
    if (result.missing.length) {
        lines.push('### Mangler i label-filen (' + result.missing.length + ')', '',
            '| Kilde | tableId | Tittel i API-et | Publisert |', '|---|---|---|---|');
        result.missing.forEach(function(t) {
            lines.push('| `' + cell(t.sourceId) + '` | ' + cell(t.tableId) + ' | ' + cell(t.title) + ' | ' + cell((t.publishedAt || '').slice(0, 10)) + ' |');
        });
        lines.push('');
    }
    if (result.obsolete.length) {
        lines.push('### Finnes ikke lenger i API-et (' + result.obsolete.length + ')', '',
            '| Kilde | tableId | Label | Tema |', '|---|---|---|---|');
        result.obsolete.forEach(function(r) {
            lines.push('| `' + cell(r.sourceId) + '` | ' + cell(r.tableId) + ' | ' + cell(r.label) + ' | ' + cell(r.category) + ' |');
        });
        lines.push('');
    }
    lines.push('Issuen oppdateres ved hver sjekk og lukkes automatisk når filen er i synk.');
    return lines.join('\n');
}
