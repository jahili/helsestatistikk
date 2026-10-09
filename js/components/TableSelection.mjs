import { Badge, Segment, StepHeading, SearchField, Alert, Status, Icon, Button } from './ui.mjs';
import { formatDateShort, formatDateLong } from '../lib/format.mjs';

const h = React.createElement;
const NEW_GROUP = 'Nye tabeller';

function filterTables(ctx) {
    const q = ctx.tableSearch.trim().toLowerCase();
    if (!q) return ctx.tables;
    return ctx.tables.filter(function(table) {
        const label = (ctx.getTableLabel(table) || '').toLowerCase();
        const tableId = (table.tableId || '').toString().toLowerCase();
        return label.includes(q) || tableId.includes(q);
    });
}

function isHighlighted(ctx, table) {
    return Boolean(ctx.highlightedTable) && String(ctx.highlightedTable.tableId) === String(table.tableId);
}

function tableRow(ctx, table, indent) {
    const selected = isHighlighted(ctx, table);
    return h('li', { key: table.tableId },
        h('button', {
            type: 'button',
            className: 'list-row table-row' + (indent ? ' table-row-indent' : '') + (selected ? ' is-selected' : ''),
            'aria-pressed': selected ? 'true' : 'false',
            onClick: function() { ctx.highlightTable(table); },
            onDoubleClick: function() { ctx.selectTable(table); }
        },
            h('span', { className: 'table-row-title' }, ctx.getTableLabel(table)),
            ctx.isUnmapped(table) && h('span', { className: 'new-tag', title: 'Mangler i label-filen' }, 'Ny'),
            table.modifiedAt && h('span', { className: 'row-date' }, formatDateShort(table.modifiedAt)),
            h(Badge, { selected: selected }, table.tableId)
        )
    );
}

function renderByTheme(ctx, tables) {
    const grouped = {};
    tables.forEach(function(table) {
        // Tabeller som ikke finnes i label-filen ennå, samles øverst.
        const category = ctx.isUnmapped(table) ? NEW_GROUP : (ctx.getTableCategory(table) || 'Andre');
        (grouped[category] = grouped[category] || []).push(table);
    });
    const searching = ctx.tableSearch.trim() !== '';

    return h('div', { className: 'list-card table-list' },
        Object.keys(grouped).sort(function(a, b) {
            if (a === NEW_GROUP || b === NEW_GROUP) return a === NEW_GROUP ? -1 : 1;
            return a.localeCompare(b, 'nb');
        }).map(function(category) {
            // Under søk vises alle treff uansett om temaet er lukket.
            const expanded = searching || ctx.expandedCategories[category] !== false;
            const listId = 'tema-' + category.replace(/\W+/g, '-');
            return h('div', { key: category, className: 'theme-group' },
                h('button', {
                    type: 'button',
                    className: 'theme-header',
                    'aria-expanded': expanded ? 'true' : 'false',
                    'aria-controls': listId,
                    onClick: function() {
                        ctx.setExpandedCategories(function(prev) {
                            return Object.assign({}, prev, { [category]: !expanded });
                        });
                    }
                },
                    expanded ? Icon.chevronDown(14) : Icon.chevronRight(14),
                    h('span', { className: 'theme-title' }, category),
                    h('span', { className: 'theme-count' }, grouped[category].length)
                ),
                expanded && h('ul', { id: listId, className: 'theme-rows' },
                    grouped[category].map(function(table) { return tableRow(ctx, table, true); })
                )
            );
        })
    );
}

function renderByDate(ctx, tables) {
    const sorted = tables.slice().sort(function(a, b) {
        return String(b.modifiedAt || '').localeCompare(String(a.modifiedAt || ''));
    });
    return h('ul', { className: 'list-card table-list' },
        sorted.map(function(table) { return tableRow(ctx, table, false); })
    );
}

function renderDetail(ctx) {
    const table = ctx.highlightedTable;
    const source = ctx.selectedSource;
    if (!table || !source) {
        return h('div', { className: 'card detail-card detail-empty' },
            Icon.table(28),
            h('p', null, 'Velg en tabell i listen for å se dimensjonene før du går videre.')
        );
    }
    const key = source.id + '/' + table.tableId;
    const dims = ctx.tablePreviewDims[key];
    const label = ctx.getTableLabel(table);
    // API-tittelen er av og til bare et internt navn (f.eks. «D14a_demens»); vis den bare når den er lesbar tekst.
    const summary = table.title && table.title !== label && /\s/.test(table.title.trim()) ? table.title : null;

    return h(React.Fragment, null,
        h('section', { className: 'card detail-card', 'aria-labelledby': 'detail-title', 'aria-live': 'polite' },
            h('div', { className: 'detail-head' },
                h('span', { className: 'detail-path' }, source.id + ' / Table / ' + table.tableId),
                h('h2', { id: 'detail-title', className: 'detail-title' }, label),
                summary && h('p', { className: 'detail-summary' }, summary),
                ctx.isUnmapped(table) && h('p', { className: 'detail-note' },
                    'Ny tabell hos FHI som ikke har fått navn og tema her ennå. Navnet er hentet fra FHIs beskrivelse',
                    table.title ? ' (intern tittel: ' : '', table.title && h('code', { className: 'code-inline' }, table.title), table.title ? ').' : '.')
            ),
            h('div', { className: 'detail-dims' },
                h('h3', { className: 'section-label' }, 'Dimensjoner'),
                !dims || dims.status === 'loading'
                    ? h(Status, null, 'Henter dimensjoner …')
                    : dims.status === 'error'
                        ? h('p', { className: 'help-text' }, dims.message)
                        : h('ul', { className: 'dim-list' },
                            dims.dims.map(function(d) {
                                return h('li', { key: d.code, className: 'dim-list-row' },
                                    h('span', null, d.label || d.code, h('code', { className: 'code-inline' }, d.code)),
                                    h('span', { className: 'mono dim-count', title: d.count + ' kategorier' }, d.count)
                                );
                            })
                        )
            ),
            table.modifiedAt && h('div', { className: 'detail-updated' },
                h('span', null, 'Sist oppdatert'),
                h('span', null, formatDateLong(table.modifiedAt))
            )
        ),
        h('div', { className: 'detail-links' },
            h(Button, {
                variant: 'link',
                onClick: function() { ctx.fetchMetadata(source.id, table.tableId, { openModal: true }); }
            }, 'Om tabellen'),
            source.aboutUrl && h('a', { href: source.aboutUrl, target: '_blank', rel: 'noopener noreferrer', className: 'detail-link' },
                'Les mer om ' + (source.title || source.name) + ' hos FHI ↗')
        )
    );
}

export function renderTableStep(ctx) {
    const source = ctx.selectedSource;
    const tables = filterTables(ctx);

    return h('div', { className: 'table-step' },
        h('div', { className: 'table-step-list' },
            h(StepHeading, {
                eyebrow: '02 · TABELL',
                title: source ? (source.title || source.name) : 'Tabell',
                subtitle: 'Velg tabellen du vil bygge en spørring for'
            }),
            h('div', { className: 'toolbar' },
                h(SearchField, {
                    id: 'table-search',
                    label: 'Søk i tabeller eller tableId',
                    placeholder: 'Søk i tabeller eller tableId',
                    value: ctx.tableSearch,
                    onChange: ctx.setTableSearch
                }),
                h(Segment, {
                    label: 'Sortering',
                    size: 'lg',
                    value: ctx.tableSort,
                    onChange: ctx.setTableSort,
                    options: [{ value: 'theme', label: 'Etter tema' }, { value: 'updated', label: 'Sist oppdatert' }]
                })
            ),
            ctx.error && h(Alert, null, ctx.error),
            ctx.loading && ctx.tables.length === 0
                ? h(Status, null, 'Laster tabeller …')
                : tables.length === 0
                    ? h('p', { className: 'empty-text' }, ctx.tableSearch.trim() ? 'Ingen tabeller funnet.' : 'Kilden har ingen tabeller.')
                    : (ctx.tableSort === 'updated' ? renderByDate(ctx, tables) : renderByTheme(ctx, tables))
        ),
        h('aside', { className: 'table-step-detail', 'aria-label': 'Valgt tabell' }, renderDetail(ctx))
    );
}

export function renderTableActions(ctx) {
    const t = ctx.highlightedTable;
    return t
        ? h(Button, { variant: 'primary', size: 'lg', block: true, onClick: function() { ctx.selectTable(t); }, trailingIcon: Icon.arrowRight() },
            'Velg tabell ' + t.tableId)
        : h(Button, { variant: 'primary', size: 'lg', block: true, disabled: true }, 'Velg en tabell for å fortsette');
}
