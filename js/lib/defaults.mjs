// Standardutvalg når en tabell åpnes: nok data til en meningsfull figur, men ikke hele kuben.
// Bygger samme konfigurasjonsform som steg 3 bruker ({ filter, values, selectedCategories }).
import { categoryCodes, isTimeDimension, expectedRows } from './selection.mjs';
import { geoLevel } from './jsonstat.mjs';
import { isGeographyDimension, isExpiredGeoLabel } from './geo.mjs';

const RECENT_YEARS = 10;
const FEW_YEARS = 5;
const SMALL_DIMENSION = 12;
const MAX_ROWS = 30000;

const all = function() { return { filter: 'all', values: ['*'], selectedCategories: [] }; };
const items = function(codes) { return { filter: 'item', values: ['*'], selectedCategories: codes.slice() }; };

function isMetric(dim) {
    const label = String(dim.label || '').toLowerCase();
    return dim.code === 'MEASURE_TYPE' || dim.code === 'ContentsCode' || label.indexOf('måltall') !== -1;
}

function isGeo(dim) {
    return isGeographyDimension(dim);
}

// Øverste nivå i kategoritreet, f.eks. «Begge kjønn» eller «Alle aldre».
function rootCodes(dim) {
    const roots = Array.isArray(dim.categories) ? dim.categories.map(function(c) { return c.value; }).filter(Boolean) : [];
    const codes = categoryCodes(dim);
    return roots.filter(function(c) { return codes.indexOf(c) !== -1; });
}

function summaryCodes(dim) {
    const roots = rootCodes(dim);
    if (roots.length > 0 && roots.length <= SMALL_DIMENSION && roots.length < categoryCodes(dim).length) return roots;
    return categoryCodes(dim).slice(0, 1);
}

// Hele landet og gjeldende fylker (ikke utgåtte, som «01 Østfold (2008-2019)» i KPR).
function geoOverview(dim) {
    const labels = (dim.category && dim.category.label) || {};
    return categoryCodes(dim).filter(function(c) {
        const level = geoLevel(c, labels[c]);
        return (level === 'land' || level === 'fylke') && !isExpiredGeoLabel(labels[c]);
    });
}

export function defaultSelection(dimensions) {
    const dims = Array.isArray(dimensions) ? dimensions : [];
    const config = {};

    dims.forEach(function(dim) {
        const codes = categoryCodes(dim);
        if (codes.length <= 1 || isMetric(dim)) {
            config[dim.code] = all();
        } else if (isTimeDimension(dim)) {
            config[dim.code] = codes.length <= RECENT_YEARS ? all() : items(codes.slice(-RECENT_YEARS));
        } else if (isGeo(dim)) {
            const overview = geoOverview(dim);
            config[dim.code] = codes.length > 30 && overview.length > 1 ? items(overview) : all();
        } else {
            config[dim.code] = codes.length <= SMALL_DIMENSION ? all() : items(summaryCodes(dim));
        }
    });

    // Fortsatt for stort: færre år først, deretter oppsummeringsnivå for de andre dimensjonene.
    const tooBig = function() { return expectedRows(dims, config).total > MAX_ROWS; };
    if (tooBig()) {
        dims.forEach(function(dim) {
            const codes = categoryCodes(dim);
            if (isTimeDimension(dim) && codes.length > FEW_YEARS) config[dim.code] = items(codes.slice(-FEW_YEARS));
        });
    }
    if (tooBig()) {
        dims.forEach(function(dim) {
            if (isMetric(dim) || isTimeDimension(dim) || categoryCodes(dim).length <= 1) return;
            if (isGeo(dim)) {
                const overview = geoOverview(dim);
                config[dim.code] = items(overview.length ? overview : categoryCodes(dim).slice(0, 1));
            } else {
                config[dim.code] = items(summaryCodes(dim));
            }
        });
    }
    return config;
}
