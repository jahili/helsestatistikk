// Gjør forhåndsvisningsdata (JSON-stat2 eller CSV-tekst) om til tabell og CSV-fil.
// Logikken er flyttet uendret fra QueryResult-komponenten.

// Beregn multi-dimensjonale indekser (siste dimensjon varierer raskest)
function indicesFor(i, sizes) {
    const indices = [];
    let tempI = i;
    for (let j = sizes.length - 1; j >= 0; j--) {
        indices[j] = tempI % sizes[j];
        tempI = Math.floor(tempI / sizes[j]);
    }
    return indices;
}

function sizesOf(previewData) {
    return previewData.id.map(function(id) {
        return previewData.dimension[id].category.index.length;
    });
}

// Grupper verdier etter alle dimensjoner unntatt måltall-dimensjonen.
function pivotByMetric(previewData, metricDimId) {
    const dimNames = previewData.id;
    const contentsCodeIndex = dimNames.indexOf(metricDimId);
    const contentsCategories = previewData.dimension[metricDimId].category.index;
    const otherDimNames = dimNames.filter(function(id) { return id !== metricDimId; });
    const sizes = sizesOf(previewData);
    const hasGeoDim = dimNames.includes('GEO') && previewData.dimension.GEO !== undefined;
    const dataMap = {};

    for (let i = 0; i < previewData.value.length; i++) {
        const indices = indicesFor(i, sizes);
        const keyParts = otherDimNames.map(function(id) {
            return previewData.dimension[id].category.index[indices[dimNames.indexOf(id)]];
        });
        const key = keyParts.join('|');
        const contentsCode = contentsCategories[indices[contentsCodeIndex]];
        if (!dataMap[key]) dataMap[key] = { dims: keyParts, values: {}, geoCode: null };
        dataMap[key].values[contentsCode] = previewData.value[i];
        if (hasGeoDim) {
            dataMap[key].geoCode = previewData.dimension.GEO.category.index[indices[dimNames.indexOf('GEO')]];
        }
    }
    return { dataMap: dataMap, otherDimNames: otherDimNames, contentsCategories: contentsCategories, hasGeoDim: hasGeoDim };
}

function geoCodeAt(previewData, indices) {
    const dimNames = previewData.id;
    const geoIdx = dimNames.indexOf('GEO');
    if (geoIdx >= 0 && previewData.dimension.GEO) {
        const rowIndexInGEO = indices[geoIdx];
        const geoIndex = previewData.dimension.GEO.category.index;
        if (Array.isArray(geoIndex)) return String(geoIndex[rowIndexInGEO] || '-');
        if (typeof geoIndex === 'object') {
            for (const code in geoIndex) {
                if (geoIndex[code] === rowIndexInGEO) return code;
            }
        }
    }
    return '-';
}

// Returnerer { columns: [{ label, numeric }], rows: [[...]], totalRows, summary, metric }
export function previewToTable(previewData, findMetricDimension, maxRows) {
    const limit = maxRows || 100;
    if (!previewData) return null;

    if (previewData.csvText) {
        const lines = previewData.csvText.split('\n').filter(function(line) { return line.trim(); });
        const clean = function(c) { return c.trim().replace(/^"|"$/g, ''); };
        const headers = (lines[0] || '').split(';').map(clean);
        const rows = lines.slice(1, 1 + limit).map(function(line) { return line.split(';').map(clean); });
        return {
            columns: headers.map(function(label) { return { label: label, numeric: false }; }),
            rows: rows,
            totalRows: Math.max(0, lines.length - 1),
            summary: null,
            metric: null
        };
    }

    if (!previewData.dimension || !previewData.value) return null;

    const dimNames = previewData.id;
    const metricDimId = findMetricDimension(previewData);

    if (metricDimId && dimNames.indexOf(metricDimId) !== -1) {
        const contentsDim = previewData.dimension[metricDimId];
        const pivot = pivotByMetric(previewData, metricDimId);
        const rowKeys = Object.keys(pivot.dataMap);
        const geoIdx = pivot.otherDimNames.indexOf('GEO');
        const columns = [{ label: 'GEO-kode', numeric: false, code: true }]
            .concat(pivot.otherDimNames.map(function(id) { return { label: previewData.dimension[id].label, numeric: false }; }))
            .concat(pivot.contentsCategories.map(function(code) { return { label: contentsDim.category.label[code], numeric: true }; }));
        const rows = rowKeys.slice(0, limit).map(function(key) {
            const rowData = pivot.dataMap[key];
            const geo = geoIdx >= 0 && rowData.dims[geoIdx] ? String(rowData.dims[geoIdx]) : '-';
            return [geo]
                .concat(rowData.dims.map(function(catCode, idx) {
                    return previewData.dimension[pivot.otherDimNames[idx]].category.label[catCode];
                }))
                .concat(pivot.contentsCategories.map(function(code) {
                    return rowData.values[code] !== undefined ? rowData.values[code] : '-';
                }));
        });
        return {
            columns: columns,
            rows: rows,
            totalRows: rowKeys.length,
            summary: rowKeys.length + ' rad' + (rowKeys.length !== 1 ? 'er' : '') + ' totalt (' +
                previewData.value.length + ' verdier, ' + pivot.contentsCategories.length + ' måltall)',
            metric: { id: metricDimId, count: pivot.contentsCategories.length }
        };
    }

    const sizes = sizesOf(previewData);
    const columns = [{ label: 'GEO-kode', numeric: false, code: true }]
        .concat(dimNames.map(function(id) { return { label: previewData.dimension[id].label, numeric: false }; }))
        .concat([{ label: 'Verdi', numeric: true }]);
    const rows = [];
    for (let i = 0; i < Math.min(previewData.value.length, limit); i++) {
        const indices = indicesFor(i, sizes);
        rows.push([geoCodeAt(previewData, indices)]
            .concat(dimNames.map(function(id, idx) {
                const catIndex = previewData.dimension[id].category.index[indices[idx]];
                return previewData.dimension[id].category.label[catIndex];
            }))
            .concat([previewData.value[i]]));
    }
    return { columns: columns, rows: rows, totalRows: previewData.value.length, summary: null, metric: null };
}

export function previewToCsv(previewData, findMetricDimension) {
    if (!previewData) return '';
    if (previewData.csvText) return previewData.csvText;
    if (!previewData.dimension || !previewData.value) return JSON.stringify(previewData, null, 2);

    const dimNames = previewData.id;
    const metricDimId = findMetricDimension(previewData);
    let csvContent = '';

    if (metricDimId && dimNames.indexOf(metricDimId) !== -1) {
        // Pivot måltall til kolonner. Header: GeoCode først (hvis GEO finnes) + andre dimensjoner + måltall
        const contentsDim = previewData.dimension[metricDimId];
        const pivot = pivotByMetric(previewData, metricDimId);
        csvContent = (pivot.hasGeoDim ? ['GeoCode'] : [])
            .concat(pivot.otherDimNames.map(function(id) { return previewData.dimension[id].label; }))
            .concat(pivot.contentsCategories.map(function(code) { return contentsDim.category.label[code]; }))
            .join(',') + '\n';

        Object.keys(pivot.dataMap).forEach(function(key) {
            const row = pivot.dataMap[key];
            const cells = [];
            if (pivot.hasGeoDim && row.geoCode !== null) cells.push(row.geoCode);
            row.dims.forEach(function(catCode, idx) {
                cells.push('"' + previewData.dimension[pivot.otherDimNames[idx]].category.label[catCode] + '"');
            });
            pivot.contentsCategories.forEach(function(code) {
                cells.push(row.values[code] !== undefined ? row.values[code] : '');
            });
            csvContent += cells.join(',') + '\n';
        });
        return csvContent;
    }

    // Ingen måltall-dimensjon: én rad per verdi
    const sizes = sizesOf(previewData);
    csvContent = dimNames.map(function(id) { return previewData.dimension[id].label; }).join(',') + ',Verdi\n';
    for (let i = 0; i < previewData.value.length; i++) {
        const indices = indicesFor(i, sizes);
        csvContent += dimNames.map(function(id, idx) {
            const catIndex = previewData.dimension[id].category.index[indices[idx]];
            return '"' + previewData.dimension[id].category.label[catIndex] + '"';
        }).join(',') + ',' + previewData.value[i] + '\n';
    }
    return csvContent;
}

// fhi_{source}_{tableId}_{YYYY-MM-DD}.csv
export function csvFileName(sourceId, tableId, date) {
    const d = date || new Date();
    const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    return 'fhi_' + (sourceId || 'unknown') + '_' + (tableId || 'unknown') + '_' + dateStr + '.csv';
}
