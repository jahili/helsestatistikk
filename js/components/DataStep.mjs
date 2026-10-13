// Steg 4 «Data»: dataene vises med en gang, som figur, tabell eller spørring til API og Power BI.
import { ChartView } from './Chart.mjs';
import { TableView } from './TableView.mjs';
import { renderApiTab } from './QueryResult.mjs';
import { selectionSummary } from '../lib/selection.mjs';
import { formatDateLong, formatNumber } from '../lib/format.mjs';
import { Button, StepHeading, Alert, Status, Icon } from './ui.mjs';

const h = React.createElement;

const TABS = [
    { id: 'figur', label: 'Figur', icon: Icon.chart },
    { id: 'tabell', label: 'Tabell', icon: function(s) { return Icon.table(s); } },
    { id: 'api', label: 'API og Power BI', icon: Icon.code }
];

function renderSelectionSummary(ctx) {
    const selection = ctx.appliedSelection;
    if (!selection || !ctx.dimensions.length) return null;
    return h('section', { className: 'selection-bar', 'aria-label': 'Utvalg' },
        h('ul', { className: 'selection-list' },
            ctx.dimensions.map(function(dim) {
                return h('li', { key: dim.code, className: 'selection-item' },
                    h('span', { className: 'selection-label' }, dim.label || dim.code),
                    h('span', { className: 'selection-value' }, selectionSummary(dim, selection.config[dim.code]))
                );
            })
        ),
        h(Button, { size: 'sm', icon: Icon.sliders(16), onClick: function() { ctx.setStep(3); } }, 'Endre utvalg')
    );
}

function renderTabs(ctx) {
    const onKey = function(e) {
        const idx = TABS.findIndex(function(t) { return t.id === ctx.dataView; });
        let next = null;
        if (e.key === 'ArrowRight') next = TABS[(idx + 1) % TABS.length];
        else if (e.key === 'ArrowLeft') next = TABS[(idx - 1 + TABS.length) % TABS.length];
        else if (e.key === 'Home') next = TABS[0];
        else if (e.key === 'End') next = TABS[TABS.length - 1];
        if (next) {
            e.preventDefault();
            ctx.setDataView(next.id);
            const el = document.getElementById('data-tab-' + next.id);
            if (el) el.focus();
        }
    };
    return h('div', { role: 'tablist', 'aria-label': 'Visning', className: 'data-tabs' },
        TABS.map(function(t) {
            const selected = t.id === ctx.dataView;
            return h('button', {
                key: t.id,
                id: 'data-tab-' + t.id,
                type: 'button',
                role: 'tab',
                className: 'data-tab',
                'aria-selected': selected ? 'true' : 'false',
                'aria-controls': 'data-panel',
                tabIndex: selected ? 0 : -1,
                onClick: function() { ctx.setDataView(t.id); },
                onKeyDown: onKey
            }, t.icon(16), t.label);
        })
    );
}

function sourceLabel(ctx) {
    return 'Kilde: FHI Statistikk, ' + (ctx.selectedSource.title || ctx.selectedSource.name) + ', tabell ' + ctx.selectedTable.tableId;
}

function renderPanel(ctx) {
    if (ctx.dataView === 'api') return renderApiTab(ctx);
    if ((ctx.loading || ctx.dataLoading) && !ctx.previewData) return h(Status, null, ctx.finalQuery ? 'Henter data …' : 'Laster dimensjoner …');
    if (!ctx.previewData) {
        return ctx.error
            ? h(Button, { variant: 'outline', onClick: ctx.fetchPreview }, 'Prøv igjen')
            : h(Status, null, 'Ingen data hentet ennå.');
    }
    if (ctx.dataView === 'tabell') {
        return h(TableView, {
            previewData: ctx.previewData,
            mode: ctx.tableMode,
            setMode: ctx.setTableMode,
            colDim: ctx.pivotCol,
            setColDim: ctx.setPivotCol,
            findMetricDimension: ctx.findMetricDimension,
            fileBase: ctx.dataFileBase
        });
    }
    return h(ChartView, {
        previewData: ctx.previewData,
        title: ctx.getTableLabel(ctx.selectedTable),
        fileBase: ctx.dataFileBase,
        sourceLabel: sourceLabel(ctx),
        theme: ctx.effectiveTheme,
        chartState: ctx.chartState,
        onChartState: ctx.updateChartState
    });
}

function dataInfo(ctx) {
    const data = ctx.previewData;
    if (!data || !Array.isArray(data.value)) return null;
    const parts = [formatNumber(data.value.length) + ' verdier'];
    if (data.updated) parts.push('oppdatert av FHI ' + formatDateLong(data.updated));
    return parts.join(' · ');
}

function secondaryActions(ctx) {
    return [
        h(Button, { key: 'link', block: true, icon: Icon.link(16), onClick: ctx.copyLink }, 'Kopier lenke til visningen'),
        h(Button, { key: 'new', variant: 'link', className: 'start-over', onClick: ctx.startOver }, 'Start på nytt')
    ];
}

export function renderDataStep(ctx) {
    if (!ctx.selectedSource || !ctx.selectedTable) return null;
    const table = ctx.selectedTable;
    const info = dataInfo(ctx);
    return h(React.Fragment, null,
        h(StepHeading, {
            eyebrow: '04 · DATA',
            title: ctx.getTableLabel(table),
            subtitle: ctx.firstSentence || null,
            actions: [
                h(Button, {
                    key: 'info', size: 'sm', icon: Icon.info(16),
                    onClick: function() { ctx.fetchMetadata(ctx.selectedSource.id, table.tableId, { openModal: true }); }
                }, 'Om tabellen')
            ]
        }),
        renderSelectionSummary(ctx),
        ctx.selectionChanged && h(Alert, { tone: 'warning' },
            'Utvalget i steg 03 er endret siden dataene ble hentet. ',
            h(Button, { variant: 'link', onClick: ctx.buildFinalQuery }, 'Vis data for det nye utvalget')),
        ctx.notice && h(Alert, { tone: 'warning' }, ctx.notice),
        ctx.error && h(Alert, null, ctx.error),
        h('section', { className: 'card data-card' },
            h('div', { className: 'data-head' },
                renderTabs(ctx),
                info && h('span', { className: 'data-info' }, info)
            ),
            h('div', { id: 'data-panel', role: 'tabpanel', 'aria-labelledby': 'data-tab-' + ctx.dataView, className: 'data-panel' },
                renderPanel(ctx))
        ),
        h('div', { className: 'mobile-only mobile-actions' }, secondaryActions(ctx))
    );
}

export function renderDataActions(ctx) {
    return h(React.Fragment, null,
        h(Button, {
            variant: 'primary', size: 'lg', block: true,
            icon: Icon.download(18),
            onClick: ctx.downloadCsv,
            disabled: ctx.pendingCsv || !ctx.finalQuery
        }, ctx.pendingCsv ? 'Henter data …' : 'Last ned som CSV'),
        h('div', { className: 'desktop-only side-actions' }, secondaryActions(ctx))
    );
}
