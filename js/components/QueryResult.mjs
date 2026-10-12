import { tokenizeJson, tokenizeStrings } from '../lib/jsonHighlight.mjs';
import { generateCurlCommand } from '../lib/curl.mjs';
import { previewToTable, csvFileName } from '../lib/preview.mjs';
import { shortenApiUrl, formatNumber } from '../lib/format.mjs';
import { Button, StepHeading, Alert, Icon, Segment } from './ui.mjs';
import { ChartView } from './Chart.mjs';

const h = React.createElement;
const PREVIEW_ROWS = 100;

const TABS = [
    { id: 'json', label: 'JSON' },
    { id: 'powerquery', label: 'Power Query (M)' },
    { id: 'curl', label: 'cURL' }
];

function highlight(code, tab) {
    const tokens = tab === 'json' ? tokenizeJson(code) : tokenizeStrings(code);
    return tokens.map(function(token, idx) {
        if (token.type === 'punctuation') return token.text;
        return h('span', { key: idx, className: 'tok-' + token.type }, token.text);
    });
}

function codeFor(ctx, tab) {
    if (tab === 'powerquery') return ctx.generatePowerQueryCode();
    if (tab === 'curl') {
        return generateCurlCommand(ctx.finalQuery, ctx.API_BASE, ctx.selectedSource && ctx.selectedSource.id, ctx.selectedTable && ctx.selectedTable.tableId);
    }
    return JSON.stringify(ctx.finalQuery, null, 2);
}

function renderCodeBlock(ctx) {
    const tab = TABS.some(function(t) { return t.id === ctx.outputFormat; }) ? ctx.outputFormat : 'json';
    const code = codeFor(ctx, tab);
    const copyKey = 'code-' + tab;
    const copied = ctx.copiedKey === copyKey;
    const onTabKey = function(e) {
        const idx = TABS.findIndex(function(t) { return t.id === tab; });
        let next = null;
        if (e.key === 'ArrowRight') next = TABS[(idx + 1) % TABS.length];
        else if (e.key === 'ArrowLeft') next = TABS[(idx - 1 + TABS.length) % TABS.length];
        else if (e.key === 'Home') next = TABS[0];
        else if (e.key === 'End') next = TABS[TABS.length - 1];
        if (next) {
            e.preventDefault();
            ctx.setOutputFormat(next.id);
            const el = document.getElementById('tab-' + next.id);
            if (el) el.focus();
        }
    };

    return h('section', { className: 'code-block', 'aria-label': 'Spørring' },
        h('div', { className: 'code-toolbar' },
            h('div', { role: 'tablist', 'aria-label': 'Format', className: 'code-tabs' },
                TABS.map(function(t) {
                    const selected = t.id === tab;
                    return h('button', {
                        key: t.id,
                        id: 'tab-' + t.id,
                        type: 'button',
                        role: 'tab',
                        className: 'code-tab',
                        'aria-selected': selected ? 'true' : 'false',
                        'aria-controls': 'code-panel',
                        tabIndex: selected ? 0 : -1,
                        onClick: function() { ctx.setOutputFormat(t.id); },
                        onKeyDown: onTabKey
                    }, t.label);
                })
            ),
            h('button', {
                type: 'button',
                className: 'code-copy' + (copied ? ' is-copied' : ''),
                onClick: function() { ctx.copyToClipboard(code, copyKey); },
                'aria-label': copied ? 'Kopiert' : 'Kopier ' + TABS.find(function(t) { return t.id === tab; }).label
            }, copied ? Icon.check(14) : Icon.copy(14), copied ? 'Kopiert ✓' : 'Kopier')
        ),
        h('pre', {
            id: 'code-panel',
            role: 'tabpanel',
            'aria-labelledby': 'tab-' + tab,
            tabIndex: 0,
            className: 'code-pre'
        }, h('code', null, highlight(code, tab)))
    );
}

function endpointRow(ctx, method, label, url, key) {
    const copied = ctx.copiedKey === key;
    return h('div', { className: 'endpoint' },
        h('span', { className: 'endpoint-label' }, label),
        h('div', { className: 'endpoint-row' },
            h('span', { className: 'method method-' + method.toLowerCase() }, method),
            h('code', { className: 'endpoint-url', title: url }, shortenApiUrl(url)),
            h('button', {
                type: 'button',
                className: 'icon-btn' + (copied ? ' is-copied' : ''),
                'aria-label': copied ? 'Kopiert' : 'Kopier ' + label.toLowerCase() + '-URL',
                title: copied ? 'Kopiert' : 'Kopier URL',
                onClick: function() { ctx.copyToClipboard(url, key); }
            }, copied ? Icon.check(14) : Icon.copy(14))
        )
    );
}

function renderSidePanel(ctx) {
    const base = ctx.API_BASE + '/' + ctx.selectedSource.id + '/Table/' + ctx.selectedTable.tableId;
    const isJsonStat = ctx.finalQuery.response && ctx.finalQuery.response.format === 'json-stat2';
    return h('div', { className: 'query-side' },
        h('section', { className: 'card side-card', 'aria-labelledby': 'endpoints-heading' },
            h('h2', { id: 'endpoints-heading', className: 'side-title' }, 'Endepunkter'),
            endpointRow(ctx, 'POST', 'Data', base + '/data', 'url-data'),
            endpointRow(ctx, 'GET', 'Dimensjoner', base + '/dimension', 'url-dim'),
            h('div', { className: 'endpoint' },
                h('span', { className: 'endpoint-label' }, 'Geo-mapping (CSV)'),
                h('a', { href: ctx.geoMappingUrl, target: '_blank', rel: 'noopener noreferrer', className: 'endpoint-link', title: ctx.geoMappingUrl },
                    'geo_mapping.csv ↗')
            )
        ),
        h('section', { className: 'card side-card', 'aria-labelledby': 'powerbi-heading' },
            h('h2', { id: 'powerbi-heading', className: 'side-title' }, 'I Power BI'),
            h('p', { className: 'side-text' }, 'Hent data › Tom spørring › Avansert redigering, og lim inn M-koden fra fanen «Power Query (M)».'),
            isJsonStat && h('p', { className: 'side-text side-note' },
                'Power Query-koden leser CSV. Velg «CSV · navn» eller «CSV · koder» i steg 03 for å bruke den.')
        )
    );
}

function renderPreview(ctx) {
    if (!ctx.previewData) {
        return h('section', { className: 'preview-empty', 'aria-labelledby': 'preview-heading' },
            h('div', { className: 'preview-empty-text' },
                Icon.table(28),
                h('span', null,
                    h('h2', { id: 'preview-heading', className: 'preview-title' }, 'Forhåndsvisning'),
                    h('span', { className: 'side-text' }, 'Hent de første radene for å sjekke at utvalget stemmer før du bruker spørringen.')
                )
            ),
            h(Button, { variant: 'outline', onClick: ctx.fetchPreview, disabled: ctx.loading },
                ctx.loading ? 'Henter …' : 'Hent forhåndsvisning')
        );
    }

    const table = previewToTable(ctx.previewData, ctx.findMetricDimension, PREVIEW_ROWS);
    const showChart = ctx.previewView === 'chart';
    return h('section', { className: 'card preview-card', 'aria-labelledby': 'preview-heading' },
        h('div', { className: 'preview-head' },
            h('div', null,
                h('h2', { id: 'preview-heading', className: 'preview-title' }, 'Forhåndsvisning'),
                showChart && Array.isArray(ctx.previewData.value) && h('p', { className: 'side-text' },
                    'Figuren bygger på alle ' + formatNumber(ctx.previewData.value.length) + ' verdiene i utvalget.'),
                !showChart && h('p', { className: 'side-text' },
                    table
                        ? (table.totalRows > table.rows.length
                            ? 'Viser de første ' + table.rows.length + ' av ' + formatNumber(table.totalRows) + ' rader.'
                            : (table.summary || formatNumber(table.totalRows) + ' rader.'))
                        : 'Data hentet.',
                    table && table.metric ? ' Måltall (' + table.metric.id + ') er pivotert til ' + table.metric.count + ' kolonner.' : ''
                )
            ),
            h('div', { className: 'preview-tools' },
                h(Segment, {
                    label: 'Visning',
                    options: [{ value: 'table', label: 'Tabell' }, { value: 'chart', label: 'Figur' }],
                    value: showChart ? 'chart' : 'table',
                    onChange: ctx.setPreviewView
                }),
                h(Button, { size: 'sm', onClick: ctx.fetchPreview, disabled: ctx.loading }, ctx.loading ? 'Henter …' : 'Hent på nytt')
            )
        ),
        showChart
            ? h(ChartView, {
                previewData: ctx.previewData,
                theme: ctx.effectiveTheme,
                title: ctx.getTableLabel(ctx.selectedTable),
                fileBase: csvFileName(ctx.selectedSource.id, ctx.selectedTable.tableId).replace(/\.csv$/, ''),
                sourceLabel: 'Kilde: FHI Statistikk, ' + (ctx.selectedSource.title || ctx.selectedSource.name) + ', tabell ' + ctx.selectedTable.tableId
            })
        : table
            ? h('div', { className: 'preview-scroll', tabIndex: 0, role: 'region', 'aria-label': 'Forhåndsvisning, kan rulles' },
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
            )
            : h('p', { className: 'side-text' }, 'Kan ikke vise tabell for dette dataformatet. Last ned som CSV.')
    );
}

function secondaryActions(ctx) {
    return [
        h(Button, {
            key: 'csv', block: true, icon: Icon.download(18),
            onClick: ctx.downloadCsv,
            disabled: ctx.pendingCsv
        }, ctx.pendingCsv ? 'Henter data …' : 'Last ned som CSV'),
        h(Button, { key: 'new', variant: 'link', className: 'start-over', onClick: ctx.startOver }, 'Start ny spørring')
    ];
}

export function renderQueryStep(ctx) {
    if (!ctx.finalQuery || !ctx.selectedSource || !ctx.selectedTable) return null;
    return h(React.Fragment, null,
        h(StepHeading, {
            eyebrow: '04 · SPØRRING',
            title: 'Spørringen er klar',
            subtitle: 'Bruk den direkte mot API-et, eller lim inn i Power BI / Excel.'
        }),
        h('div', { className: 'query-layout' },
            renderCodeBlock(ctx),
            renderSidePanel(ctx)
        ),
        ctx.error && h(Alert, null, ctx.error),
        renderPreview(ctx),
        h('div', { className: 'mobile-only mobile-actions' }, secondaryActions(ctx))
    );
}

export function renderQueryActions(ctx) {
    const copied = ctx.copiedKey === 'json-main';
    return h(React.Fragment, null,
        h(Button, {
            variant: 'primary', size: 'lg', block: true,
            icon: copied ? Icon.check(18) : Icon.copy(18),
            onClick: function() { ctx.copyToClipboard(JSON.stringify(ctx.finalQuery, null, 2), 'json-main'); }
        }, copied ? 'Kopiert ✓' : 'Kopier JSON-spørring'),
        h('div', { className: 'desktop-only side-actions' }, secondaryActions(ctx))
    );
}
