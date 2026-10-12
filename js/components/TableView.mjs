// Tabell-fanen i steg 4: pivottabell (én dimensjon i kolonnene) eller liste med de første radene.
import { pivotTable, pivotToCsv, defaultColumnDimension } from '../lib/pivot.mjs';
import { jsonStatToRows } from '../lib/jsonstat.mjs';
import { previewToTable } from '../lib/preview.mjs';
import { formatNumber } from '../lib/format.mjs';
import { Button, Segment, Icon } from './ui.mjs';

const { useMemo, createElement: h } = React;
const PIVOT_ROWS = 500;
const LIST_ROWS = 100;

const formatters = {};
function formatValue(value, decimals) {
    const key = decimals == null ? 'auto' : decimals;
    if (!formatters[key]) {
        formatters[key] = new Intl.NumberFormat('nb-NO', decimals == null
            ? { maximumFractionDigits: 3 }
            : { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
    return formatters[key].format(value);
}

function saveCsv(text, fileName) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function() { URL.revokeObjectURL(link.href); }, 1000);
}

function PivotTable(props) {
    const data = props.data;
    const varying = data.dimensions.filter(function(d) { return d.categories.length > 1; });
    const colDimId = varying.some(function(d) { return d.id === props.colDim; }) ? props.colDim : defaultColumnDimension(data);
    const pivot = useMemo(function() { return pivotTable(data, colDimId, PIVOT_ROWS); }, [data, colDimId]);

    return h(React.Fragment, null,
        h('div', { className: 'table-tools' },
            varying.length > 1 && h('div', { className: 'chart-filter' },
                h('label', { className: 'field-label', htmlFor: 'pivot-col' }, 'Kolonner'),
                h('select', {
                    id: 'pivot-col',
                    className: 'text-input chart-select',
                    value: colDimId || '',
                    onChange: function(e) { props.setColDim(e.target.value); }
                }, varying.map(function(d) { return h('option', { key: d.id, value: d.id }, d.label); }))
            ),
            pivot.fixed.length > 0 && h('p', { className: 'table-fixed' },
                pivot.fixed.map(function(f) { return f.label + ': ' + f.value; }).join(' · '))
        ),
        h('div', { className: 'preview-scroll', tabIndex: 0, role: 'region', 'aria-label': 'Pivottabell, kan rulles' },
            h('table', { className: 'preview-table pivot-table' },
                h('thead', null,
                    h('tr', null,
                        pivot.rowHeaders.map(function(label, i) { return h('th', { key: 'r' + i, scope: 'col' }, label); }),
                        pivot.columns.map(function(label, i) { return h('th', { key: 'c' + i, scope: 'col', className: 'num' }, label); })
                    )
                ),
                h('tbody', null, pivot.rows.map(function(row, r) {
                    const prev = r > 0 ? pivot.rows[r - 1] : null;
                    return h('tr', { key: r },
                        row.keys.map(function(key, k) {
                            // Gjentatte overskrifter i ytre nivåer vises bare første gang.
                            const repeated = prev && prev.keys.slice(0, k + 1).join('\u0001') === row.keys.slice(0, k + 1).join('\u0001');
                            return h('th', { key: 'k' + k, scope: 'row', className: 'pivot-key' + (repeated ? ' is-repeated' : '') }, repeated ? '' : key);
                        }),
                        row.cells.map(function(cell, c) {
                            if (cell.value == null) {
                                const reason = cell.flag ? (props.flags[cell.flag] || cell.flag) : 'Mangler';
                                return h('td', { key: c, className: 'num is-missing', title: reason }, cell.flag || '–');
                            }
                            return h('td', { key: c, className: 'num' }, formatValue(cell.value, cell.decimals));
                        })
                    );
                }))
            )
        ),
        h('p', { className: 'help-text' },
            pivot.totalRows > pivot.rows.length
                ? 'Viser ' + formatNumber(pivot.rows.length) + ' av ' + formatNumber(pivot.totalRows) + ' rader. Last ned tabellen for å få alle.'
                : formatNumber(pivot.totalRows) + ' rad' + (pivot.totalRows === 1 ? '' : 'er') + '.',
            Object.keys(props.flags).length > 0 && ' Symboler: ' + Object.keys(props.flags).map(function(k) { return k + ' ' + props.flags[k].toLowerCase(); }).join(', ') + '.'
        ),
        h('div', { className: 'chart-actions' },
            h(Button, {
                size: 'sm', variant: 'outline', icon: Icon.download(16),
                onClick: function() { saveCsv(pivotToCsv(data, colDimId), props.fileBase + '_pivot.csv'); }
            }, 'Last ned tabellen (CSV)')
        )
    );
}

function ListTable(props) {
    const table = previewToTable(props.previewData, props.findMetricDimension, LIST_ROWS);
    if (!table) return h('p', { className: 'side-text' }, 'Kan ikke vise tabell for dette dataformatet. Last ned som CSV.');
    return h(React.Fragment, null,
        h('div', { className: 'preview-scroll', tabIndex: 0, role: 'region', 'aria-label': 'Liste, kan rulles' },
            h('table', { className: 'preview-table' },
                h('thead', null,
                    h('tr', null, table.columns.map(function(col, i) {
                        return h('th', { key: i, scope: 'col', className: col.numeric ? 'num' : undefined }, col.label);
                    }))
                ),
                h('tbody', null, table.rows.map(function(row, r) {
                    return h('tr', { key: r }, row.map(function(cell, c) {
                        const col = table.columns[c] || {};
                        return h('td', { key: c, className: col.numeric ? 'num' : (col.code ? 'mono' : undefined) }, cell);
                    }));
                }))
            )
        ),
        h('p', { className: 'help-text' },
            table.totalRows > table.rows.length
                ? 'Viser de første ' + table.rows.length + ' av ' + formatNumber(table.totalRows) + ' radene. «Last ned som CSV» gir alle.'
                : (table.summary || formatNumber(table.totalRows) + ' rader.'),
            table.metric ? ' Måltall er gjort om til ' + table.metric.count + ' kolonner.' : '')
    );
}

// props: previewData, mode, setMode, colDim, setColDim, findMetricDimension, fileBase
export function TableView(props) {
    const data = useMemo(function() { return jsonStatToRows(props.previewData); }, [props.previewData]);
    const mode = data ? props.mode : 'liste';
    return h('div', { className: 'table-view' },
        data && h(Segment, {
            label: 'Tabelltype',
            className: 'table-mode',
            options: [{ value: 'pivot', label: 'Pivot' }, { value: 'liste', label: 'Liste' }],
            value: mode,
            onChange: props.setMode
        }),
        mode === 'pivot'
            ? h(PivotTable, { data: data, colDim: props.colDim, setColDim: props.setColDim, flags: data.flags, fileBase: props.fileBase })
            : h(ListTable, { previewData: props.previewData, findMetricDimension: props.findMetricDimension })
    );
}
