// Pivottabell fra den lange tabellen i jsonstat.mjs: én dimensjon i kolonnene, resten som radoverskrifter.
// Dimensjoner med bare én verdi vises over tabellen i stedet for som kolonner.

function labelOf(dim, code) {
    const cat = dim.categories.find(function(c) { return c.code === code; });
    return cat ? cat.label : code;
}

// Tid i kolonnene hvis den varierer, ellers måltall, ellers siste dimensjon som varierer.
export function defaultColumnDimension(data) {
    if (!data) return null;
    const varying = data.dimensions.filter(function(d) { return d.categories.length > 1; });
    const pick = varying.find(function(d) { return d.role === 'time'; }) ||
        varying.find(function(d) { return d.role === 'metric'; }) ||
        varying[varying.length - 1];
    return pick ? pick.id : null;
}

// Returnerer { columns, rowHeaders, rows: [{ keys, cells: [{ value, flag, decimals }] }], fixed, colDimId, totalRows }
export function pivotTable(data, colDimId, maxRows) {
    if (!data) return null;
    const limit = maxRows || 500;
    const varying = data.dimensions.filter(function(d) { return d.categories.length > 1; });
    const fixed = data.dimensions.filter(function(d) { return d.categories.length <= 1; }).map(function(d) {
        return { label: d.label, value: d.categories.length ? d.categories[0].label : '' };
    });
    const colDim = varying.find(function(d) { return d.id === colDimId; }) ||
        varying.find(function(d) { return d.id === defaultColumnDimension(data); }) || null;
    const rowDims = varying.filter(function(d) { return d !== colDim; });
    const metric = data.dimensions.find(function(d) { return d.role === 'metric'; });
    const decimalsFor = function(row) {
        if (!metric) return null;
        const cat = metric.categories.find(function(c) { return c.code === row[metric.id]; });
        return cat && cat.unit && typeof cat.unit.decimals === 'number' ? cat.unit.decimals : null;
    };

    const colCodes = colDim ? colDim.categories.map(function(c) { return c.code; }) : [null];
    const byKey = {};
    const order = [];
    data.rows.forEach(function(row) {
        const key = rowDims.map(function(d) { return row[d.id]; }).join('\u0001');
        if (!byKey[key]) {
            byKey[key] = {
                keys: rowDims.map(function(d) { return labelOf(d, row[d.id]); }),
                cells: colCodes.map(function() { return { value: null, flag: null, decimals: null }; })
            };
            order.push(key);
        }
        const col = colDim ? colCodes.indexOf(row[colDim.id]) : 0;
        byKey[key].cells[col] = { value: row.value, flag: row.flag, decimals: decimalsFor(row) };
    });

    return {
        columns: colDim ? colDim.categories.map(function(c) { return c.label; }) : ['Verdi'],
        rowHeaders: rowDims.map(function(d) { return d.label; }),
        rows: order.slice(0, limit).map(function(k) { return byKey[k]; }),
        fixed: fixed,
        colDimId: colDim ? colDim.id : null,
        totalRows: order.length
    };
}

// Verdier som starter med = + - @ kan tolkes som formler i Excel; de får en apostrof foran.
function csvText(text) {
    let s = String(text == null ? '' : text);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
}

// Alle rader (ikke bare de som vises), med flaggsymbolet der verdien mangler.
export function pivotToCsv(data, colDimId) {
    const pivot = pivotTable(data, colDimId, Infinity);
    if (!pivot) return '';
    const lines = [pivot.rowHeaders.concat(pivot.columns).map(csvText).join(',')];
    pivot.rows.forEach(function(row) {
        const cells = row.cells.map(function(c) {
            if (c.value != null) return String(c.value);
            return c.flag ? csvText(c.flag) : '';
        });
        lines.push(row.keys.map(csvText).concat(cells).join(','));
    });
    return lines.join('\n') + '\n';
}
