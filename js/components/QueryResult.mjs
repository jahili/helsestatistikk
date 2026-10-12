import { tokenizeJson, tokenizeStrings } from '../lib/jsonHighlight.mjs';
import { generateCurlCommand } from '../lib/curl.mjs';
import { shortenApiUrl } from '../lib/format.mjs';
import { Icon, Segment } from './ui.mjs';

const h = React.createElement;

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
                'Power Query-koden leser CSV. Velg «CSV · navn» eller «CSV · koder» som svarformat for å bruke den.')
        )
    );
}

// Fanen «API og Power BI» i steg 4: spørringen i flere formater, svarformat og endepunkter.
export function renderApiTab(ctx) {
    if (!ctx.finalQuery || !ctx.selectedSource || !ctx.selectedTable) return null;
    return h('div', { className: 'api-tab' },
        h('div', { className: 'api-format' },
            h('span', { className: 'settings-label' }, 'Svarformat'),
            h(Segment, {
                label: 'Svarformat',
                value: ctx.finalQuery.response.format,
                onChange: ctx.setResponseFormat,
                options: [
                    { value: 'json-stat2', label: 'JSON-stat2' },
                    { value: 'csv2', label: 'CSV · navn' },
                    { value: 'csv3', label: 'CSV · koder' }
                ]
            }),
            h('p', { className: 'help-text' }, 'Spørringen bruker det samme utvalget som figuren og tabellen. Endre utvalget i steg 03.')
        ),
        h('div', { className: 'query-layout' },
            renderCodeBlock(ctx),
            renderSidePanel(ctx)
        )
    );
}
