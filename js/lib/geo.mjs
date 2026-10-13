// Tallet først i en geokode, med ledende null der den mangler: «0101 Halden (2008-2019)» → «0101», «3» → «03», «301» → «0301».
// Gir null for koder uten tall først (f.eks. «Landet», «Total», «ZZ»).
export function geoKey(code) {
    const digits = (String(code).match(/^(\d+)(\s|$)/) || [])[1];
    if (!digits) return null;
    return digits.length % 2 === 1 ? '0' + digits : digits;
}

// Enheter som ikke finnes lenger, har sluttår i navnet: «01 Østfold (2008-2019)». Gjeldende har «(2024->)» eller ingen periode.
export function isExpiredGeoLabel(label) {
    return /\(\d{4}\s*-\s*\d{4}\)\s*$/.test(String(label || ''));
}

// Fylke › kommune › bydel/levekårssone for geografidimensjoner. Grupperingen bruker geoKey, så den virker også
// for kilder som skriver navn og gyldighetsperiode i koden (KPR: «0101 Halden (2008-2019)») eller dropper ledende null.
export function getGeographyGroups(dimension) {
    if (!isGeographyDimension(dimension)) return null;
    if (!dimension.category || !dimension.category.index) return null;

    const categories = dimension.category.index;
    const labels = dimension.category.label || {};
    const municipalities = [], counties = [], districts = [], zones = [], others = [];

    categories.forEach(function(code) {
        const key = geoKey(code);
        const label = labels[code] || code;
        const item = { code: code, label: label, key: key, expired: isExpiredGeoLabel(label) };
        // «0» er hele landet, ikke et fylke.
        if (!key || code === '0') others.push(item);
        else if (key.length === 2) counties.push(item);
        else if (key.length === 4) municipalities.push(item);
        else if (key.length === 6) districts.push(item);
        // Levekårssoner (LKS): kommunenummer + 6 sifre.
        else if (key.length === 10) zones.push(item);
        else others.push(item);
    });

    // Gjeldende fylker først, utgåtte (med sluttår) etter; ellers samme rekkefølge som i API-et.
    counties.sort(function(a, b) { return a.expired - b.expired; });

    const hierarchy = {};
    counties.forEach(function(county) {
        hierarchy[county.code] = {
            municipalities: municipalities.filter(function(m) { return m.key.startsWith(county.key); }),
            districts: {},
            zones: {}
        };
    });

    // Bydeler og levekårssoner under kommunen sin
    counties.forEach(function(county) {
        hierarchy[county.code].municipalities.forEach(function(mun) {
            hierarchy[county.code].districts[mun.code] = districts.filter(function(d) { return d.key.startsWith(mun.key); });
            hierarchy[county.code].zones[mun.code] = zones.filter(function(z) { return z.key.startsWith(mun.key); });
        });
    });

    return {
        municipalities: municipalities,
        counties: counties,
        districts: districts,
        zones: zones,
        others: others,
        hierarchy: hierarchy
    };
}

// Geografiske nivåer i tabelloversikten. Kildene koder geografi ulikt (GEO, FYLKE, BOFYLKE_K, BOSTED, Geografi;
// hele landet som 0, ZZ, Total eller 9000), så nivået tolkes fra både navn og kodeformat.
export const GEO_LEVEL_NAMES = {
    N: 'Hele landet', F: 'Fylker', K: 'Kommuner', B: 'Bydeler', LKS: 'Levekårssoner', R: 'Helseregioner'
};
const LEVEL_ORDER = ['N', 'F', 'K', 'B', 'LKS', 'R'];

export function isGeographyDimension(dim) {
    if (!dim) return false;
    if (dim.code === 'GEO') return true;
    return /geo|fylke|bosted|bustad|kommune|bydel/i.test(String(dim.code) + ' ' + String(dim.label || ''));
}

// Tallet først i koden teller («01 Østfold (2008-2019)» er 01), og ledende null kan mangle («301» er Oslo kommune).
// Gir 'N', 'F', 'K', 'B', 'LKS', 'R' eller null.
export function levelOfCategory(code, label) {
    const l = String(label || '').trim().toLowerCase();
    const digits = (String(code).match(/^(\d+)(\s|$)/) || [])[1];
    if (/^(hele|heile) landet$|^landet$|^norge$/.test(l) || digits === '0') return 'N';
    if (/region|helseforetak/.test(l)) return 'R';
    if (!digits) return null;
    if (digits.length >= 9) return 'LKS';
    if (digits.length >= 5) return 'B';
    if (digits.length >= 3) return 'K';
    return 'F';
}

function flatten(categories, out) {
    (categories || []).forEach(function(c) {
        out.push(c);
        flatten(c.children, out);
    });
    return out;
}

// dims: dimensjoner slik /dimension gir dem (med categories-treet, eller category { index, label }).
// Returnerer forkortelsene i fast rekkefølge, f.eks. ['N', 'F', 'K', 'B'].
export function geoLevelsOfDimensions(dims) {
    const found = {};
    (dims || []).filter(isGeographyDimension).forEach(function(dim) {
        const items = Array.isArray(dim.categories)
            ? flatten(dim.categories, []).map(function(c) { return { code: c.value, label: c.label }; })
            : ((dim.category && dim.category.index) || []).map(function(code) {
                return { code: code, label: dim.category.label && dim.category.label[code] };
            });
        items.forEach(function(item) {
            const level = levelOfCategory(item.code, item.label);
            if (level) found[level] = true;
        });
    });
    return LEVEL_ORDER.filter(function(l) { return found[l]; });
}
