import { Badge, Chip, StepHeading, SearchField, Alert, Status, Icon, Button } from './ui.mjs';
import { formatDateShort } from '../lib/format.mjs';

const h = React.createElement;
const MAX_RESULTS = 50;

function sourceName(source) {
    return source.title || source.name;
}

function searchTables(ctx) {
    const q = ctx.globalSearch.trim().toLowerCase();
    if (!q) return [];
    return ctx.allTables.filter(function(table) {
        const label = (ctx.getTableLabel(table) || '').toLowerCase();
        return label.includes(q) ||
            (table.title && table.title.toLowerCase().includes(q)) ||
            (table.name && table.name.toLowerCase().includes(q)) ||
            (table.tableId && table.tableId.toString().includes(q));
    });
}

function renderSearchResults(ctx) {
    const results = searchTables(ctx);
    const stillLoading = ctx.loading || (ctx.allTables.length === 0 && ctx.sources.length > 0);
    return h('section', { className: 'search-results', 'aria-labelledby': 'search-results-heading' },
        h('h2', { id: 'search-results-heading', className: 'section-label' },
            results.length === 1 ? '1 tabell' : results.length + ' tabeller',
            ' på tvers av kilder'
        ),
        results.length === 0
            ? h('p', { className: 'empty-text' }, stillLoading ? 'Laster tabeller fra alle kilder …' : 'Ingen tabeller funnet. Prøv et annet søkeord eller en tableId.')
            : h('ul', { className: 'list-card' },
                results.slice(0, MAX_RESULTS).map(function(table) {
                    const source = ctx.sources.find(function(s) { return s.id === table.sourceId; });
                    return h('li', { key: table.sourceId + '-' + table.tableId },
                        h('button', {
                            type: 'button',
                            className: 'list-row search-hit',
                            onClick: function() { if (source) ctx.selectSourceAndTable(source, table); }
                        },
                            h('span', { className: 'search-hit-text' },
                                h('span', { className: 'search-hit-title' }, ctx.getTableLabel(table)),
                                h('span', { className: 'search-hit-meta' },
                                    table.sourceName || table.sourceId,
                                    h('code', { className: 'code-inline' }, table.sourceId)
                                )
                            ),
                            table.modifiedAt && h('span', { className: 'row-date' }, formatDateShort(table.modifiedAt)),
                            h(Badge, null, table.tableId),
                            h('span', { className: 'row-arrow', 'aria-hidden': 'true' }, Icon.arrowRight(14))
                        )
                    );
                })
            ),
        results.length > MAX_RESULTS && h('p', { className: 'help-text' },
            'Viser ' + MAX_RESULTS + ' av ' + results.length + ' treff. Presiser søket for å se flere.'
        )
    );
}

function renderSourceGrid(ctx) {
    const publishers = [];
    ctx.sources.forEach(function(s) {
        if (s.publishedBy && publishers.indexOf(s.publishedBy) === -1) publishers.push(s.publishedBy);
    });
    const visible = ctx.publisherFilter === 'all'
        ? ctx.sources
        : ctx.sources.filter(function(s) { return s.publishedBy === ctx.publisherFilter; });

    return h(React.Fragment, null,
        publishers.length > 1 && h('div', { className: 'chip-row', role: 'group', 'aria-label': 'Filtrer på utgiver' },
            h(Chip, { variant: 'filter', pressed: ctx.publisherFilter === 'all', onClick: function() { ctx.setPublisherFilter('all'); } },
                'Alle kilder · ' + ctx.sources.length),
            publishers.map(function(p) {
                return h(Chip, { key: p, variant: 'filter', pressed: ctx.publisherFilter === p, onClick: function() { ctx.setPublisherFilter(p); } }, p);
            })
        ),
        h('ul', { className: 'source-grid', 'aria-label': 'Kilder' },
            visible.map(function(source) {
                const selected = ctx.selectedSource && ctx.selectedSource.id === source.id;
                return h('li', { key: source.id },
                    h('button', {
                        type: 'button',
                        className: 'card source-card' + (selected ? ' card-selected' : ''),
                        'aria-pressed': selected ? 'true' : undefined,
                        onClick: function() { ctx.selectSource(source); }
                    },
                        h('span', { className: 'source-card-head' },
                            h('span', { className: 'card-title' }, sourceName(source)),
                            h(Badge, { selected: selected }, source.id)
                        ),
                        source.description && h('span', { className: 'source-card-desc' }, source.description),
                        h('span', { className: 'source-card-foot' },
                            h('span', { className: 'source-card-publisher' }, source.publishedBy || ''),
                            h('span', { className: 'source-card-cta', 'aria-hidden': 'true' }, 'Velg →')
                        )
                    )
                );
            })
        )
    );
}

export function renderSourceStep(ctx) {
    const searching = ctx.globalSearch.trim() !== '';
    return h(React.Fragment, null,
        h(StepHeading, { eyebrow: '01 · KILDE', title: 'Hvilket register vil du hente fra?' }),
        h(SearchField, {
            id: 'global-search',
            size: 'lg',
            label: 'Søk etter tabell på tvers av alle kilder',
            placeholder: 'Søk etter tabell på tvers av alle kilder, f.eks. «dødsfall alder»',
            value: ctx.globalSearch,
            onChange: ctx.setGlobalSearch,
            inputRef: ctx.globalSearchRef,
            shortcut: '/',
            onKeyDown: function(e) { if (e.key === 'Escape') ctx.setGlobalSearch(''); }
        }),
        ctx.error && h(Alert, null, ctx.error),
        searching ? renderSearchResults(ctx) : (
            ctx.loading && ctx.sources.length === 0
                ? h(Status, null, 'Laster kilder …')
                : renderSourceGrid(ctx)
        )
    );
}

export function renderSourceActions(ctx) {
    const s = ctx.selectedSource;
    return s
        ? h(Button, { variant: 'primary', size: 'lg', block: true, onClick: function() { ctx.setStep(2); }, trailingIcon: Icon.arrowRight() },
            'Fortsett med ' + sourceName(s))
        : h(Button, { variant: 'primary', size: 'lg', block: true, disabled: true }, 'Velg en kilde for å fortsette');
}
