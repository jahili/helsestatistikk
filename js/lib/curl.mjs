// Sitat for POSIX-skall: alt inni '…' er bokstavelig, og ' skrives som '\''.
function shellQuote(text) {
    return "'" + String(text).replace(/'/g, "'\''") + "'";
}

// cURL-kommando for samme POST-kall som appen og Power Query bruker.
export function generateCurlCommand(finalQuery, apiBase, sourceId, tableId) {
    if (!finalQuery || !sourceId || !tableId) return '';
    const url = apiBase + '/' + sourceId + '/Table/' + tableId + '/data';
    return 'curl -X POST ' + shellQuote(url) + ' \\n' +
        "  -H 'Content-Type: application/json' \\n" +
        '  -d ' + shellQuote(JSON.stringify(finalQuery, null, 2));
}
