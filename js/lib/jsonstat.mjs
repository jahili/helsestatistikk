// Gjør et JSON-stat2-datasett om til en «lang» tabell og velger figurtype ut fra hvilke dimensjoner som varierer.
// Rent og uten DOM, så det kan testes med node --test.
import { isTimeDimension } from './selection.mjs';

const MAX_SERIES_LINE = 10;
const MAX_SERIES_BAR = 6;

// category.index kan være en liste med koder eller et objekt { kode: posisjon }.
function orderedCodes(category) {
    const index = category && category.index;
    if (Array.isArray(index)) return index.map(String);
    if (index && typeof index === 'object') {
        return Object.keys(index).sort(function(a, b) { return index[a] - index[b]; });
    }
    return Object.keys((category && category.label) || {});
}

function roleOf(ds, id) {
    const role = ds.role || {};
    const dim = ds.dimension[id];
    const has = function(r) { return Array.isArray(role[r]) && role[r].indexOf(id) !== -1; };
    if (has('metric') || id === 'MEASURE_TYPE' || id === 'ContentsCode') return 'metric';
    if (has('time') || isTimeDimension({ code: id, label: dim.label })) return 'time';
    if (has('geo') || id === 'GEO') return 'geo';
    return null;
}

// Returnerer { dimensions, rows, flags } eller null.
// dimensions: [{ id, label, role: 'time'|'geo'|'metric'|null, categories: [{ code, label, unit }] }]
// rows: [{ <dimId>: kode, ..., value: tall eller null, flag: symbol eller null }]
// flags: { symbol: forklaring } fra extension.flags
export function jsonStatToRows(ds) {
    if (!ds || !Array.isArray(ds.id) || !ds.dimension || !Array.isArray(ds.value)) return null;

    const dimensions = ds.id.map(function(id) {
        const dim = ds.dimension[id] || {};
        const category = dim.category || {};
        const labels = category.label || {};
        const units = category.unit || {};
        return {
            id: id,
            label: dim.label || id,
            role: roleOf(ds, id),
            categories: orderedCodes(category).map(function(code) {
                return { code: code, label: labels[code] != null ? String(labels[code]) : code, unit: units[code] || null };
            })
        };
    });

    const sizes = dimensions.map(function(d) { return d.categories.length; });
    const rows = [];
    for (let i = 0; i < ds.value.length; i++) {
        const row = {};
        let rest = i;
        for (let j = sizes.length - 1; j >= 0; j--) {
            row[dimensions[j].id] = dimensions[j].categories[rest % sizes[j]].code;
            rest = Math.floor(rest / sizes[j]);
        }
        const raw = ds.value[i];
        if (typeof raw === 'number' && isFinite(raw)) {
            row.value = raw;
            row.flag = null;
        } else {
            row.value = null;
            row.flag = raw == null ? null : String(raw);
        }
        rows.push(row);
    }

    const ext = ds.extension && ds.extension.flags;
    const flags = ext && ext.label && typeof ext.label === 'object' ? Object.assign({}, ext.label) : {};
    return { dimensions: dimensions, rows: rows, flags: flags };
}

// Velger figur ut fra dimensjonene som har mer enn én verdi.
// Returnerer { type: 'line'|'bar'|'none', x, series, filters, reason }
// - x: dimensjonen langs aksen (tid for linje, kategori for søyle)
// - series: dimensjonen som gir farge, eller null
// - filters: dimensjoner som må låses til én verdi i figuren (inkl. måltall)
export function chartPlan(data) {
    if (!data || !data.rows.length) return { type: 'none', x: null, series: null, filters: [], reason: 'Ingen data å vise.' };

    const varying = data.dimensions.filter(function(d) { return d.categories.length > 1; });
    const metric = varying.filter(function(d) { return d.role === 'metric'; });
    const others = varying.filter(function(d) { return d.role !== 'metric'; });
    const filters = metric.slice();
    const byCount = function(a, b) { return a.categories.length - b.categories.length; };

    if (!others.length) {
        return { type: 'none', x: null, series: null, filters: filters, reason: 'Utvalget har bare én verdi per måltall. Velg flere år eller kategorier for å få en figur.' };
    }

    const time = others.find(function(d) { return d.role === 'time'; });
    if (time) {
        const rest = others.filter(function(d) { return d !== time; }).sort(byCount);
        const series = rest.length && rest[0].categories.length <= MAX_SERIES_LINE ? rest[0] : null;
        return {
            type: 'line', x: time, series: series,
            filters: filters.concat(rest.filter(function(d) { return d !== series; })),
            reason: null
        };
    }

    // Uten tid: søyler langs dimensjonen med flest verdier (geografi foretrekkes), farge for den med færrest.
    const sorted = others.slice().sort(function(a, b) {
        if ((a.role === 'geo') !== (b.role === 'geo')) return a.role === 'geo' ? -1 : 1;
        return b.categories.length - a.categories.length;
    });
    const x = sorted[0];
    const rest = sorted.slice(1).sort(byCount);
    const series = rest.length && rest[0].categories.length <= MAX_SERIES_BAR ? rest[0] : null;
    return {
        type: 'bar', x: x, series: series,
        filters: filters.concat(rest.filter(function(d) { return d !== series; })),
        reason: null
    };
}

const MAX_BARS = 60;
export const GEO_LEVELS = [
    { id: 'land', label: 'Land' },
    { id: 'fylke', label: 'Fylker' },
    { id: 'kommune', label: 'Kommuner' },
    { id: 'bydel', label: 'Bydeler' }
];

// FHI sine geokoder: 0 = hele landet, 2 sifre = fylke, 4 = kommune, 6 = bydel.
export function geoLevel(code) {
    const c = String(code);
    if (c === '0') return 'land';
    if (/^\d{2}$/.test(c)) return 'fylke';
    if (/^\d{4}$/.test(c)) return 'kommune';
    if (/^\d{6}$/.test(c)) return 'bydel';
    return null;
}

// Nivåene som finnes i en geodimensjon, med antall. Tomt hvis det bare er ett nivå (da trengs ikke valget).
export function geoLevelsIn(dim) {
    if (!dim || dim.role !== 'geo') return [];
    const counts = {};
    dim.categories.forEach(function(c) {
        const level = geoLevel(c.code);
        if (level) counts[level] = (counts[level] || 0) + 1;
    });
    const levels = GEO_LEVELS.filter(function(l) { return counts[l.id]; })
        .map(function(l) { return { id: l.id, label: l.label, count: counts[l.id] }; });
    return levels.length > 1 ? levels : [];
}

// Fylker hvis de finnes, ellers første nivå under landet.
export function defaultGeoLevel(levels) {
    if (!levels.length) return null;
    const fylke = levels.find(function(l) { return l.id === 'fylke'; });
    if (fylke) return fylke.id;
    const local = levels.find(function(l) { return l.id !== 'land'; });
    return (local || levels[0]).id;
}

// Radene som skal tegnes, med etiketter. filterValues: { dimId: kode }; mangler en verdi, brukes første kategori.
// options.geoLevel: vis bare dette nivået (pluss hele landet) når x er geografi.
// Returnerer { points: [{ x, series, value, flag }], xDomain, seriesDomain, unit, missing, truncated }
export function chartPoints(data, plan, filterValues, options) {
    const level = options && options.geoLevel;
    let xCategories = plan.x.categories;
    if (level && plan.x.role === 'geo') {
        xCategories = xCategories.filter(function(c) {
            const l = geoLevel(c.code);
            return l === level || l === 'land';
        });
    }
    let truncated = null;
    if (plan.type === 'bar' && xCategories.length > MAX_BARS) {
        truncated = { shown: MAX_BARS, total: xCategories.length };
        xCategories = xCategories.slice(0, MAX_BARS);
    }
    const xCodes = new Set(xCategories.map(function(c) { return c.code; }));

    const chosen = {};
    plan.filters.forEach(function(d) {
        const wanted = filterValues && filterValues[d.id];
        chosen[d.id] = d.categories.some(function(c) { return c.code === wanted; }) ? wanted : d.categories[0].code;
    });
    const labelOf = function(dim, code) {
        const c = dim.categories.find(function(cat) { return cat.code === code; });
        return c ? c.label : code;
    };

    const points = [];
    let missing = 0;
    data.rows.forEach(function(row) {
        for (const id in chosen) if (row[id] !== chosen[id]) return;
        if (!xCodes.has(row[plan.x.id])) return;
        if (row.value === null) missing++;
        points.push({
            x: labelOf(plan.x, row[plan.x.id]),
            series: plan.series ? labelOf(plan.series, row[plan.series.id]) : null,
            value: row.value,
            flag: row.flag
        });
    });

    // Enhet: fra valgt måltall, eller fra det eneste måltallet.
    const metricDim = data.dimensions.find(function(d) { return d.role === 'metric'; });
    let unit = null;
    if (metricDim) {
        const code = chosen[metricDim.id] || metricDim.categories[0].code;
        const cat = metricDim.categories.find(function(c) { return c.code === code; });
        if (cat) unit = { label: (cat.unit && cat.unit.label) || cat.label, decimals: cat.unit && typeof cat.unit.decimals === 'number' ? cat.unit.decimals : null };
    }

    return {
        points: points,
        xDomain: xCategories.map(function(c) { return c.label; }),
        seriesDomain: plan.series ? plan.series.categories.map(function(c) { return c.label; }) : [],
        unit: unit,
        missing: missing,
        truncated: truncated
    };
}
