// Valgene i appen som URL-fragment (#kilde=nokkel&tabell=366&v.GEO=0,03&vis=figur), slik at visninger kan deles.
// Dimensjoner får prefikset «v.» og låste figurvalg «f.», så de ikke kolliderer med de faste nøklene.
import { categoryCodes } from './selection.mjs';

const VIEWS = ['figur', 'tabell', 'api'];
const FORMATS = ['json-stat2', 'csv2', 'csv3'];

function list(values) {
    return values.map(encodeURIComponent).join(',');
}

function unlist(text) {
    return text === '' ? [] : text.split(',').map(function(v) { return decodeURIComponent(v); });
}

function encodeConfig(config, wildcard) {
    if (!config) return '*';
    if (config.filter === 'top') return 'top:' + (parseInt(config.topCount, 10) || 5);
    if (config.filter === 'item') return list(config.selectedCategories || []);
    const values = config.values && config.values.length ? config.values : ['*'];
    if (wildcard && !(values.length === 1 && values[0] === '*')) return 'w:' + list(values);
    return '*';
}

function decodeConfig(text) {
    if (text === '*') return { filter: 'all', values: ['*'], selectedCategories: [] };
    if (text.indexOf('top:') === 0) {
        const n = parseInt(text.slice(4), 10);
        return { filter: 'top', values: ['*'], selectedCategories: [], topCount: String(n > 0 ? n : 5) };
    }
    if (text.indexOf('w:') === 0) {
        const values = unlist(text.slice(2)).filter(Boolean);
        return { filter: 'all', values: values.length ? values : ['*'], selectedCategories: [], wildcard: true };
    }
    return { filter: 'item', values: ['*'], selectedCategories: unlist(text) };
}

// state: { sourceId, tableId, step, view, format, maxRowCount, dimensions, queryConfig, wildcardDims, chart: { filters, geoLevel, facet } }
export function encodeState(state) {
    const parts = [];
    const add = function(key, value) { parts.push(encodeURIComponent(key) + '=' + value); };
    if (!state || !state.sourceId) return '';
    add('kilde', encodeURIComponent(state.sourceId));
    if (state.tableId == null) return parts.join('&');
    add('tabell', encodeURIComponent(state.tableId));
    if (state.step === 3) add('steg', 'utvalg');
    (state.dimensions || []).forEach(function(dim) {
        const wildcard = state.wildcardDims && state.wildcardDims[dim.code];
        add('v.' + dim.code, encodeConfig(state.queryConfig && state.queryConfig[dim.code], wildcard));
    });
    if (state.view && state.view !== 'figur') add('vis', state.view);
    if (state.format && state.format !== 'json-stat2') add('format', state.format);
    if (state.maxRowCount) add('max', encodeURIComponent(state.maxRowCount));
    const chart = state.chart || {};
    Object.keys(chart.filters || {}).forEach(function(code) {
        add('f.' + code, encodeURIComponent(chart.filters[code]));
    });
    if (chart.geoLevel) add('niva', encodeURIComponent(chart.geoLevel));
    if (chart.facet) add('del', encodeURIComponent(chart.facet));
    return parts.join('&');
}

export function decodeState(hash) {
    const text = String(hash || '').replace(/^#/, '');
    const result = { sourceId: null, tableId: null, step: null, view: null, format: null, maxRowCount: null, dims: {}, hasSelection: false,
        chart: { filters: {}, geoLevel: null, facet: null } };
    if (!text) return result;
    text.split('&').forEach(function(pair) {
        const eq = pair.indexOf('=');
        if (eq < 1) return;
        let key, raw;
        try {
            key = decodeURIComponent(pair.slice(0, eq));
            raw = pair.slice(eq + 1);
        } catch (e) {
            return;
        }
        const value = function() { try { return decodeURIComponent(raw); } catch (e) { return ''; } };
        if (key === 'kilde') result.sourceId = value();
        else if (key === 'tabell') result.tableId = value();
        else if (key === 'steg') result.step = value() === 'utvalg' ? 3 : null;
        else if (key === 'vis') result.view = VIEWS.indexOf(value()) !== -1 ? value() : null;
        else if (key === 'format') result.format = FORMATS.indexOf(value()) !== -1 ? value() : null;
        else if (key === 'max') result.maxRowCount = /^\d+$/.test(value()) ? value() : null;
        else if (key === 'niva') result.chart.geoLevel = value();
        else if (key === 'del') result.chart.facet = value();
        else if (key.indexOf('f.') === 0) result.chart.filters[key.slice(2)] = value();
        else if (key.indexOf('v.') === 0) {
            try {
                result.dims[key.slice(2)] = decodeConfig(raw);
                result.hasSelection = true;
            } catch (e) { /* ugyldig verdi hoppes over */ }
        }
    });
    return result;
}

// Legger valgene fra lenken oppå standardutvalget. Koder som ikke finnes i tabellen lenger, hoppes over.
// Returnerer { config, wildcardDims, dropped } der dropped er antall verdier som ikke fantes.
export function applyUrlSelection(dimensions, defaults, urlDims) {
    const config = Object.assign({}, defaults);
    const wildcardDims = {};
    let dropped = 0;
    (dimensions || []).forEach(function(dim) {
        const fromUrl = urlDims && urlDims[dim.code];
        if (!fromUrl) return;
        const codes = categoryCodes(dim);
        if (fromUrl.filter === 'item') {
            const valid = fromUrl.selectedCategories.filter(function(c) { return codes.indexOf(c) !== -1; });
            dropped += fromUrl.selectedCategories.length - valid.length;
            if (valid.length === 0 && fromUrl.selectedCategories.length > 0) return;
            config[dim.code] = { filter: 'item', values: ['*'], selectedCategories: valid };
        } else if (fromUrl.filter === 'top') {
            const n = Math.min(parseInt(fromUrl.topCount, 10) || 5, Math.max(1, codes.length));
            config[dim.code] = { filter: 'top', values: ['*'], selectedCategories: [], topCount: String(n) };
        } else {
            config[dim.code] = { filter: 'all', values: fromUrl.values, selectedCategories: [] };
            if (fromUrl.wildcard) wildcardDims[dim.code] = true;
        }
    });
    return { config: config, wildcardDims: wildcardDims, dropped: dropped };
}
