// cURL-kommando for samme POST-kall som appen og Power Query bruker.
export function generateCurlCommand(finalQuery, apiBase, sourceId, tableId) {
    if (!finalQuery || !sourceId || !tableId) return '';
    const url = apiBase + '/' + sourceId + '/Table/' + tableId + '/data';
    // Enkeltfnutter i JSON escapes for POSIX-skall: ' -> '\''
    const body = JSON.stringify(finalQuery, null, 2).replace(/'/g, "'\''");
    return "curl -X POST '" + url + "' \\n" +
        "  -H 'Content-Type: application/json' \\n" +
        "  -d '" + body + "'";
}
