// Ren logikk for hvor mange verdier en dimensjonskonfigurasjon gir.
// Brukes til tellere og «forventet antall rader», endrer ikke spørringen.

// Tidsdimensjon: koden er AAR, eller et ord i navnet ender på «år» (År, Dødsår, Skoleår).
// «Dødsårsak» skal ikke regnes med, så vi ser på hele ord.
export function isTimeDimension(dimension) {
    if (dimension.code === 'AAR') return true;
    const words = String(dimension.label || '').toLowerCase().split(/[^a-zæøå0-9]+/);
    return words.some(function(w) { return w.length >= 2 && w.slice(-2) === 'år'; });
}

export function categoryCodes(dimension) {
    return (dimension && dimension.category && Array.isArray(dimension.category.index)) ? dimension.category.index : [];
}

// «03*» matcher «0301», «*» matcher alt. Andre tegn sammenlignes bokstavelig.
export function matchesWildcard(code, pattern) {
    const escaped = String(pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp('^' + escaped + '$').test(String(code));
}

export function selectedCount(dimension, config) {
    const codes = categoryCodes(dimension);
    const total = codes.length;
    if (!config) return total;
    if (config.filter === 'item') return config.selectedCategories ? config.selectedCategories.length : 0;
    if (config.filter === 'top') {
        const n = parseInt(config.topCount || '5', 10);
        return isNaN(n) ? 0 : Math.max(0, Math.min(n, total));
    }
    const patterns = config.values && config.values.length > 0 ? config.values : ['*'];
    if (patterns.indexOf('*') !== -1) return total;
    return codes.filter(function(code) {
        return patterns.some(function(p) { return matchesWildcard(code, p); });
    }).length;
}

export function isFiltered(dimension, config) {
    return selectedCount(dimension, config) !== categoryCodes(dimension).length;
}

export function expectedRows(dimensions, queryConfig) {
    const factors = (dimensions || []).map(function(dim) {
        return selectedCount(dim, queryConfig ? queryConfig[dim.code] : null);
    });
    const total = factors.reduce(function(acc, n) { return acc * n; }, factors.length ? 1 : 0);
    return { total: total, factors: factors };
}
