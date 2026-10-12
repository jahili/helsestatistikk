// Innledende overskrifter som eget avsnitt, f.eks. «<p><strong>Sammendrag</strong></p>» eller «<h3>Formål:</h3>».
const LEADING_HEADINGS = /^\s*(?:<p>\s*<(strong|b)>[^<]*<\/\1>\s*<\/p>\s*|<h[1-6]>[^<]*<\/h[1-6]>\s*)+/i;

// Første setning av første avsnitt (utenom «Geografi») i tabellens metadata, uten HTML og innledende overskrift.
export function firstSentenceFromMetadata(tableMetadata) {
    if (tableMetadata && tableMetadata.paragraphs && Array.isArray(tableMetadata.paragraphs)) {
        for (let i = 0; i < tableMetadata.paragraphs.length; i++) {
            if (tableMetadata.paragraphs[i].header !== 'Geografi') {
                const content = tableMetadata.paragraphs[i].content;
                if (typeof content === 'string') {
                    const text = content
                        .replace(LEADING_HEADINGS, '')
                        .replace(/<\/(p|div|li|h[1-6]|br)\s*>/gi, ' ')
                        .replace(/<[^>]*>/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    const match = text.match(/^[^!?]*?\.(?=\s[A-ZÆØÅ]|$)|^[^!?]*?[!?]/);
                    if (match) return match[0];
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
