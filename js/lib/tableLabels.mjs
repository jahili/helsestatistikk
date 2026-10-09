export function getTableLabel(tableLabels, table) {
    if (tableLabels && tableLabels[table.tableId]) {
        const labelData = tableLabels[table.tableId];
        return typeof labelData === 'object' ? labelData.label : labelData;
    }
    return table.label || table.title || table.name;
}

export function getTableCategory(tableLabels, table) {
    if (tableLabels && tableLabels[table.tableId]) {
        const labelData = tableLabels[table.tableId];
        return typeof labelData === 'object' ? labelData.category : '';
    }
    return '';
}

// Helper function to flatten hierarchical categories
export function flattenCategories(categories) {
    const result = { index: [], label: {} };

    function traverse(items) {
        if (!items || !Array.isArray(items)) return;

        items.forEach(function(item) {
            if (item.value && item.label) {
                result.index.push(item.value);
                result.label[item.value] = item.label;
            }
            if (item.children) {
                traverse(item.children);
            }
        });
    }

    traverse(categories);
    return result;
}

export function isTableMapped(tableLabels, table) {
    return Boolean(tableLabels && tableLabels[table.tableId]);
}

// Navn for tabeller som mangler i label-filen. API-tittelen brukes når den er lesbar
// tekst; er den bare et internt navn (f.eks. «INNVAND_INNVKAT»), brukes beskrivelsen
// fra metadata (fallbackLabels[tableId]) når den er hentet.
export function fallbackTableLabel(table, fallbackLabels) {
    const title = String(table.title || table.name || '').trim();
    if (/\s/.test(title)) return title;
    return (fallbackLabels && fallbackLabels[table.tableId]) || title;
}

export function hasReadableTitle(table) {
    return /\s/.test(String(table.title || table.name || '').trim());
}
