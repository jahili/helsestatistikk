// Første setning av første avsnitt (utenom «Geografi») i tabellens metadata, uten HTML.
// Flyttet uendret fra effekten i app.js.
export function firstSentenceFromMetadata(tableMetadata) {
    if (tableMetadata && tableMetadata.paragraphs && Array.isArray(tableMetadata.paragraphs)) {
        for (let i = 0; i < tableMetadata.paragraphs.length; i++) {
            if (tableMetadata.paragraphs[i].header !== 'Geografi') {
                const text = tableMetadata.paragraphs[i].content;
                if (typeof text === 'string') {
                    const match = text.match(/^[^!?]*?\.(?=\s[A-Z]|$)|^[^!?]*?[!?]/);
                    if (match) {
                        return match[0]
                            .replace(/<\/(p|div|li|h[1-6]|br)\s*>/gi, ' ')
                            .replace(/<[^>]*>/g, '')
                            .replace(/\s+/g, ' ')
                            .trim();
                    }
                }
            }
        }
    }
    return '';
}

// Kort navn fra beskrivelsen: første setning, uten avsluttende punktum, kuttet ved ordgrense.
export function labelFromMetadata(tableMetadata, maxLength) {
    const max = maxLength || 90;
    let text = firstSentenceFromMetadata(tableMetadata).replace(/^(Sammendrag|Beskrivelse|Formål)\s+/i, '').replace(/[.!?]\s*$/, '');
    if (text.length <= max) return text;
    const cut = text.slice(0, max + 1);
    const space = cut.lastIndexOf(' ');
    return (space > max * 0.6 ? cut.slice(0, space) : text.slice(0, max)).replace(/[\s,;:–-]+$/, '') + ' …';
}
