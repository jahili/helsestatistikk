import { Button, Segment, Chip, StepHeading, SearchField, Alert, Status, Icon } from './ui.mjs';
import { categoryCodes, selectedCount, isTimeDimension } from '../lib/selection.mjs';
import { formatNumber } from '../lib/format.mjs';

const h = React.createElement;
const WIDE_THRESHOLD = 20;
const MAX_CHIPS = 30;

function labelOf(dimension, code) {
    return (dimension.category.label && dimension.category.label[code]) || code;
}

function currentMode(ctx, dimension, config) {
    if (config.filter === 'all' && ctx.wildcardDims[dimension.code]) return 'wildcard';
    return config.filter;
}

function setMode(ctx, dimension, mode) {
    const code = dimension.code;
    const setWildcard = function(on) {
        ctx.setWildcardDims(function(prev) { return Object.assign({}, prev, { [code]: on }); });
    };
    if (mode === 'all') {
        ctx.updateDimensionConfig(code, { filter: 'all', values: ['*'] });
        setWildcard(false);
        ctx.setWildcardDrafts(function(prev) { return Object.assign({}, prev, { [code]: undefined }); });
    } else if (mode === 'wildcard') {
        ctx.updateDimensionConfig(code, { filter: 'all' });
        setWildcard(true);
    } else {
        ctx.updateDimensionConfig(code, { filter: mode });
        setWildcard(false);
    }
}

function toggleCode(ctx, dimension, config, code, checked) {
    const updated = checked
        ? config.selectedCategories.concat([code])
        : config.selectedCategories.filter(function(c) { return c !== code; });
    ctx.updateDimensionConfig(dimension.code, { selectedCategories: updated });
}

function checkboxOption(ctx, dimension, config, item, extraClass) {
    return h('label', { key: item.code, className: 'value-option' + (extraClass ? ' ' + extraClass : '') },
        h('input', {
            type: 'checkbox',
            checked: config.selectedCategories.includes(item.code),
            onChange: function(e) { toggleCode(ctx, dimension, config, item.code, e.target.checked); }
        }),
        h('span', { className: 'value-option-label' }, item.label),
        item.label !== item.code && h('code', { className: 'code-inline' }, item.code)
    );
}

function expandButton(expanded, label, onClick) {
    return h('button', {
        type: 'button',
        className: 'icon-btn tree-toggle',
        'aria-expanded': expanded ? 'true' : 'false',
        'aria-label': (expanded ? 'Skjul ' : 'Vis ') + label,
        onClick: onClick
    }, expanded ? Icon.chevronDown(14) : Icon.chevronRight(14));
}

function toggleKey(setter, key) {
    setter(function(prev) { return Object.assign({}, prev, { [key]: !prev[key] }); });
}

// Geografi: fylke › kommune › bydel. Utvalgslogikken er den samme som før redesignet.
function renderGeoTree(ctx, dimension, config, geoGroups) {
    const hierarchy = geoGroups.hierarchy;
    const q = ctx.geoSearch.trim().toLowerCase();
    const matches = function(item) {
        return item.label.toLowerCase().includes(q) || item.code.toLowerCase().includes(q);
    };
    const filteredCounties = geoGroups.counties.filter(function(county) {
        if (!q) return true;
        if (matches(county)) return true;
        const muns = hierarchy[county.code] ? hierarchy[county.code].municipalities : [];
        return muns.some(matches);
    });
    const others = q ? geoGroups.others.filter(matches) : geoGroups.others;
    const setSelected = function(updated) { ctx.updateDimensionConfig(dimension.code, { selectedCategories: updated }); };

    return h('ul', { className: 'geo-tree', 'aria-label': 'Geografisk hierarki' },
        others.map(function(other) {
            return h('li', { key: other.code, className: 'geo-node' },
                h('div', { className: 'geo-row' }, h('span', { className: 'tree-spacer' }), checkboxOption(ctx, dimension, config, other))
            );
        }),
        filteredCounties.map(function(county) {
            const muns = hierarchy[county.code] ? hierarchy[county.code].municipalities : [];
            const countyDistricts = hierarchy[county.code] ? hierarchy[county.code].districts : {};
            // Under søk vises fylket åpent, med bare treffene (eller alle kommuner hvis fylket selv traff).
            const expanded = q ? true : Boolean(ctx.expandedCounties[county.code]);
            const visibleMuns = q && !matches(county) ? muns.filter(matches) : muns;
            const allMunsAndDists = muns.map(function(m) { return m.code; }).concat(
                geoGroups.districts.filter(function(d) { return d.code.startsWith(county.code); }).map(function(d) { return d.code; })
            );
            const allSelected = allMunsAndDists.length > 0 && allMunsAndDists.every(function(c) { return config.selectedCategories.includes(c); });

            return h('li', { key: county.code, className: 'geo-node' },
                h('div', { className: 'geo-row geo-row-county' },
                    muns.length > 0
                        ? expandButton(expanded, county.label, function() { toggleKey(ctx.setExpandedCounties, county.code); })
                        : h('span', { className: 'tree-spacer' }),
                    checkboxOption(ctx, dimension, config, county, 'value-option-strong'),
                    muns.length > 0 && h(Button, {
                        variant: 'link',
                        className: 'geo-bulk',
                        onClick: function() {
                            const rest = config.selectedCategories.filter(function(c) { return !allMunsAndDists.includes(c); });
                            setSelected(allSelected ? rest : rest.concat(allMunsAndDists));
                        }
                    }, allSelected ? 'Fjern alle kommuner' : 'Velg alle kommuner')
                ),
                expanded && visibleMuns.length > 0 && h('ul', { className: 'geo-children' },
                    visibleMuns.map(function(mun) {
                        const dists = countyDistricts[mun.code] || [];
                        const munExpanded = Boolean(ctx.expandedMunicipalities[mun.code]);
                        const allDists = dists.length > 0 && dists.every(function(d) { return config.selectedCategories.includes(d.code); });
                        return h('li', { key: mun.code, className: 'geo-node' },
                            h('div', { className: 'geo-row' },
                                dists.length > 0
                                    ? expandButton(munExpanded, 'bydeler i ' + mun.label, function() { toggleKey(ctx.setExpandedMunicipalities, mun.code); })
                                    : h('span', { className: 'tree-spacer' }),
                                checkboxOption(ctx, dimension, config, mun),
                                dists.length > 0 && h(Button, {
                                    variant: 'link',
                                    className: 'geo-bulk',
                                    onClick: function() {
                                        const codes = dists.map(function(d) { return d.code; });
                                        const rest = config.selectedCategories.filter(function(c) { return !codes.includes(c); });
                                        setSelected(allDists ? rest : rest.concat(codes));
                                    }
                                }, allDists ? 'Fjern alle bydeler' : 'Velg alle bydeler')
                            ),
                            munExpanded && dists.length > 0 && h('ul', { className: 'geo-children' },
                                dists.map(function(dist) {
                                    return h('li', { key: dist.code, className: 'geo-node' },
                                        h('div', { className: 'geo-row' }, h('span', { className: 'tree-spacer' }), checkboxOption(ctx, dimension, config, dist))
                                    );
                                })
                            )
                        );
                    })
                )
            );
        }),
        filteredCounties.length === 0 && others.length === 0 && h('li', { className: 'empty-text' }, 'Ingen treff.')
    );
}

function renderValuePicker(ctx, dimension, config) {
    const codes = categoryCodes(dimension);
    const isGeo = dimension.code === 'GEO';
    const geoGroups = isGeo ? ctx.getGeographyGroups(dimension) : null;
    const searchValue = isGeo ? ctx.geoSearch : (ctx.valueSearch[dimension.code] || '');
    const setSearch = isGeo
        ? ctx.setGeoSearch
        : function(v) { ctx.setValueSearch(function(prev) { return Object.assign({}, prev, { [dimension.code]: v }); }); };
    const selected = config.selectedCategories;
    const allSelected = selected.length === codes.length;
    const q = searchValue.trim().toLowerCase();
    const visible = codes.filter(function(c) {
        return !q || labelOf(dimension, c).toLowerCase().includes(q) || c.toLowerCase().includes(q);
    });

    return h(React.Fragment, null,
        selected.length > 0
            ? h('div', { className: 'chip-row', 'aria-label': 'Valgte verdier' },
                selected.slice(0, MAX_CHIPS).map(function(c) {
                    return h(Chip, {
                        key: c,
                        variant: 'selected',
                        removeLabel: 'Fjern ' + labelOf(dimension, c),
                        onRemove: function() { toggleCode(ctx, dimension, config, c, false); }
                    }, labelOf(dimension, c));
                }),
                selected.length > MAX_CHIPS && h('span', { className: 'chip-more' }, '+' + (selected.length - MAX_CHIPS) + ' til')
            )
            : h('p', { className: 'help-text help-warning' }, 'Ingen verdier valgt ennå. Velg minst én.'),
        h('div', { className: 'picker-toolbar' },
            h(SearchField, {
                id: 'search-' + dimension.code,
                size: 'sm',
                label: 'Søk i ' + (dimension.label || dimension.code).toLowerCase(),
                placeholder: isGeo ? 'Søk etter fylke, kommune eller bydel' : 'Søk i ' + codes.length + ' verdier eller kode',
                value: searchValue,
                onChange: setSearch
            }),
            h(Button, {
                size: 'sm',
                onClick: function() {
                    ctx.updateDimensionConfig(dimension.code, { selectedCategories: allSelected ? [] : codes });
                }
            }, allSelected ? 'Fjern alle' : 'Velg alle')
        ),
        isGeo && geoGroups && geoGroups.hierarchy && geoGroups.counties.length > 0
            ? h('div', { className: 'value-scroll geo-scroll' }, renderGeoTree(ctx, dimension, config, geoGroups))
            : visible.length === 0
                ? h('p', { className: 'empty-text' }, 'Ingen treff.')
                : h('div', { className: 'value-scroll value-grid' },
                    visible.map(function(c) {
                        return checkboxOption(ctx, dimension, config, { code: c, label: labelOf(dimension, c) });
                    })
                )
    );
}

function renderStepper(ctx, dimension, config, total) {
    const id = 'top-' + dimension.code;
    const raw = config.topCount || '5';
    const n = parseInt(raw, 10) || 0;
    const set = function(v) { ctx.updateDimensionConfig(dimension.code, { topCount: String(v) }); };
    return h('div', { className: 'stepper-row' },
        h('label', { htmlFor: id, className: 'stepper-label' }, 'Antall år'),
        h('div', { className: 'stepper' },
            h('button', { type: 'button', 'aria-label': 'Færre år', disabled: n <= 1, onClick: function() { set(Math.max(1, n - 1)); } }, '−'),
            h('input', {
                id: id,
                type: 'text',
                inputMode: 'numeric',
                pattern: '[0-9]*',
                value: raw,
                onChange: function(e) { ctx.updateDimensionConfig(dimension.code, { topCount: e.target.value.replace(/\D/g, '') }); }
            }),
            h('button', { type: 'button', 'aria-label': 'Flere år', disabled: n >= total, onClick: function() { set(Math.min(total, n + 1)); } }, '+')
        ),
        h('span', { className: 'help-text stepper-help' }, 'av ' + total)
    );
}

function renderWildcard(ctx, dimension, config, count, total) {
    const id = 'wildcard-' + dimension.code;
    const draft = ctx.wildcardDrafts[dimension.code];
    return h('div', null,
        h('label', { htmlFor: id, className: 'field-label' }, 'Mønster (kommaseparert)'),
        h('input', {
            id: id,
            className: 'text-input mono',
            value: draft !== undefined ? draft : config.values.join(', '),
            placeholder: '*, 03*, 30*',
            spellCheck: false,
            onChange: function(e) {
                const text = e.target.value;
                ctx.setWildcardDrafts(function(prev) { return Object.assign({}, prev, { [dimension.code]: text }); });
                const values = text.split(',').map(function(v) { return v.trim(); }).filter(function(v) { return v; });
                ctx.updateDimensionConfig(dimension.code, { values: values.length > 0 ? values : ['*'] });
            }
        }),
        h('p', { className: 'help-text' }, 'Bruk * for å matche alle, f.eks. 03*. Treffer ' + count + ' av ' + total + '.')
    );
}

function renderDimensionCard(ctx, dimension) {
    if (!dimension.category || !dimension.category.index) {
        console.error('Dimension mangler category eller index:', dimension);
        return h('section', { key: dimension.code, className: 'card dim-card' },
            h(Alert, null, 'Dimensjon ' + (dimension.label || dimension.code) + ' har ikke riktig struktur')
        );
    }
    const config = ctx.queryConfig[dimension.code] || { filter: 'all', values: ['*'], selectedCategories: [] };
    const codes = categoryCodes(dimension);
    const total = codes.length;
    const count = selectedCount(dimension, config);
    const mode = currentMode(ctx, dimension, config);
    const wide = total > WIDE_THRESHOLD || mode === 'item';
    const headingId = 'dim-' + dimension.code;

    const options = [{ value: 'all', label: 'Alle' }, { value: 'item', label: 'Velg verdier' }];
    if (isTimeDimension(dimension)) options.push({ value: 'top', label: 'Siste X år' });
    if (total > WIDE_THRESHOLD || mode === 'wildcard') options.push({ value: 'wildcard', label: 'Wildcard' });

    return h('section', {
        key: dimension.code,
        className: 'card dim-card' + (wide ? ' dim-wide' : '') + (mode === 'item' ? ' dim-active' : ''),
        'aria-labelledby': headingId
    },
        h('div', { className: 'dim-head' },
            h('h2', { id: headingId, className: 'dim-title' },
                dimension.label || dimension.code,
                h('code', { className: 'code-inline' }, dimension.code)
            ),
            h('span', {
                className: 'dim-counter' + (count !== total ? ' is-filtered' : ''),
                'aria-label': count + ' av ' + total + ' valgt'
            }, count + ' / ' + total)
        ),
        total <= 1
            ? h('p', { className: 'help-text dim-single' }, 'Bare én verdi, tas alltid med.')
            : h(React.Fragment, null,
                h(Segment, {
                    label: 'Filtertype for ' + (dimension.label || dimension.code),
                    className: 'dim-segment',
                    value: mode,
                    options: options,
                    onChange: function(m) { setMode(ctx, dimension, m); }
                }),
                mode === 'all' && total <= 5 && h('div', { className: 'chip-row' },
                    codes.map(function(c) { return h(Chip, { key: c }, labelOf(dimension, c)); })
                ),
                mode === 'top' && renderStepper(ctx, dimension, config, total),
                mode === 'wildcard' && renderWildcard(ctx, dimension, config, count, total),
                mode === 'item' && renderValuePicker(ctx, dimension, config)
            )
    );
}

// Forventet antall rader og maks rader. Vises i sidekolonnen (og i innholdet på mobil).
// Svarformatet velges i fanen «API og Power BI» i steg 4.
export function renderQuerySettings(ctx, prefix) {
    const rows = ctx.rows;
    const max = parseInt(ctx.maxRowCount, 10);
    const overMax = !isNaN(max) && max > 0 && rows.total > max;
    const advancedId = prefix + '-advanced';
    return h('div', { className: 'query-settings' },
        h('div', { className: 'rows-box' + (overMax || rows.total === 0 ? ' is-warning' : '') },
            h('span', { className: 'rows-label' }, 'Forventet antall rader'),
            h('span', { className: 'rows-value' },
                h('span', { className: 'rows-total' }, formatNumber(rows.total)),
                rows.factors.length > 1 && h('span', { className: 'rows-formula' }, rows.factors.join(' × '))
            )
        ),
        rows.total === 0 && ctx.dimensions.length > 0 && h('p', { className: 'help-text help-warning' },
            'Minst én dimensjon har ingen valgte verdier.'),
        overMax && h('p', { className: 'help-text help-warning' },
            'Overstiger «Max antall rader» (' + formatNumber(max) + '). Svaret blir begrenset.'),
        h('div', { className: 'advanced' },
            h(Button, {
                variant: 'link',
                ariaExpanded: ctx.showAdvanced ? 'true' : 'false',
                onClick: function() { ctx.setShowAdvanced(!ctx.showAdvanced); }
            }, ctx.showAdvanced ? 'Skjul avansert' : 'Avansert'),
            ctx.showAdvanced && h('div', { id: advancedId, className: 'advanced-body' },
                h('label', { className: 'field-label', htmlFor: prefix + '-max-rows' }, 'Max antall rader'),
                h('input', {
                    id: prefix + '-max-rows',
                    type: 'number',
                    min: 1,
                    className: 'text-input mono',
                    value: ctx.maxRowCount,
                    placeholder: 'Ubegrenset',
                    onChange: function(e) { ctx.setMaxRowCount(e.target.value); }
                })
            )
        )
    );
}

export function renderVariablesStep(ctx) {
    const table = ctx.selectedTable;
    const source = ctx.selectedSource;
    const dims = Array.isArray(ctx.dimensions) ? ctx.dimensions : [];
    return h(React.Fragment, null,
        h(StepHeading, {
            eyebrow: '03 · UTVALG',
            title: table ? ctx.getTableLabel(table) : 'Variabler',
            subtitle: 'Standardutvalget gir en oversiktlig figur. Velg flere eller færre verdier og trykk «Vis data».',
            actions: [
                h(Button, {
                    key: 'info', size: 'sm', icon: Icon.info(16),
                    onClick: function() { ctx.fetchMetadata(source.id, table.tableId, { openModal: true }); }
                }, 'Om tabellen'),
                h(Button, { key: 'reset', size: 'sm', onClick: ctx.resetAllDimensions }, 'Tilbake til standard')
            ]
        }),
        ctx.firstSentence && h('p', { className: 'step-lead' }, ctx.firstSentence),
        ctx.error && h(Alert, null, ctx.error),
        ctx.loading
            ? h(Status, null, 'Laster dimensjoner …')
            : h('div', { className: 'dim-grid' }, dims.map(function(d) { return renderDimensionCard(ctx, d); })),
        h('div', { className: 'mobile-only card' }, renderQuerySettings(ctx, 'm'))
    );
}

export function renderVariablesActions(ctx) {
    return h(React.Fragment, null,
        h('div', { className: 'desktop-only' }, renderQuerySettings(ctx, 'd')),
        h(Button, {
            variant: 'primary', size: 'lg', block: true,
            disabled: ctx.loading || ctx.dimensions.length === 0,
            onClick: ctx.buildFinalQuery,
            trailingIcon: Icon.arrowRight()
        }, 'Vis data')
    );
}
