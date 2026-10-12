export function getGeographyGroups(dimension) {
    if (dimension.code !== 'GEO') return null;
    if (!dimension.category || !dimension.category.index) return null;

    const categories = dimension.category.index;
    const labels = dimension.category.label;
    const municipalities = [], counties = [], districts = [], zones = [], others = [];

    categories.forEach(function(code) {
        const item = { code: code, label: labels[code] };
        if (code.length === 6) {
            districts.push(item);
        } else if (code.length === 2) {
            counties.push(item);
        } else if (code.length === 4) {
            municipalities.push(item);
        } else if (code.length === 10) {
            // Levekårssoner (LKS): kommunenummer + 6 sifre.
            zones.push(item);
        } else {
            others.push(item);
        }
    });

    // Build hierarchy
    const hierarchy = {};
    counties.forEach(function(county) {
        hierarchy[county.code] = {
            municipalities: municipalities.filter(function(m) {
                return m.code.startsWith(county.code);
            }),
            districts: {},
            zones: {}
        };
    });

    // Add districts and levekårssoner to municipalities
    municipalities.forEach(function(mun) {
        const countyCode = mun.code.substring(0, 2);
        if (hierarchy[countyCode]) {
            hierarchy[countyCode].districts[mun.code] = districts.filter(function(d) {
                return d.code.startsWith(mun.code);
            });
            hierarchy[countyCode].zones[mun.code] = zones.filter(function(z) {
                return z.code.startsWith(mun.code);
            });
        }
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
