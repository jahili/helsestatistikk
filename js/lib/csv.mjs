function splitCsvLine(line, separator) {
    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const nextChar = line[j + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                j++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === separator && !inQuotes) {
            cells.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
        } else {
            current += char;
        }
    }

    if (current) {
        cells.push(current.trim().replace(/^"|"$/g, ''));
    }
    return cells;
}

// Alle gyldige rader i label-filen: [{ sourceId, tableId, title, label, category }]
export function parseTableLabelRows(text) {
    const lines = text.split('\n');
    const rows = [];

    if (lines.length < 2) {
        console.error('CSV-filen er tom eller har ingen data-linjer');
        return rows;
    }

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Kolonner: 0=source_id, 1=tableId, 2=title, 3=label, 4=category
        const cells = splitCsvLine(line, ',');
        if (cells.length > 3 && cells[1] && cells[3]) {
            rows.push({
                sourceId: cells[0],
                tableId: cells[1],
                title: cells[2],
                label: cells[3],
                category: cells[4] || ''
            });
        }
    }

    return rows;
}

export function parseTableLabelsCSV(text) {
    const result = {};
    parseTableLabelRows(text).forEach(function(row) {
        result[row.tableId] = { label: row.label, category: row.category };
    });
    return result;
}
