const MONTHS_SHORT = ['jan.', 'feb.', 'mars', 'apr.', 'mai', 'juni', 'juli', 'aug.', 'sep.', 'okt.', 'nov.', 'des.'];
const MONTHS_LONG = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];

// Leser bare dato-delen av en ISO-streng, så tidssonen ikke flytter datoen.
function parseDatePart(iso) {
    if (typeof iso !== 'string') return null;
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const month = parseInt(match[2], 10) - 1;
    if (month < 0 || month > 11) return null;
    return { year: match[1], month: month, day: parseInt(match[3], 10) };
}

// «1. okt. 2026»
export function formatDateShort(iso) {
    const d = parseDatePart(iso);
    return d ? d.day + '. ' + MONTHS_SHORT[d.month] + ' ' + d.year : '';
}

// «1. oktober 2026»
export function formatDateLong(iso) {
    const d = parseDatePart(iso);
    return d ? d.day + '. ' + MONTHS_LONG[d.month] + ' ' + d.year : '';
}

// 12345 -> «12 345» (smalt mellomrom som tusenskille)
export function formatNumber(n) {
    if (typeof n !== 'number' || !isFinite(n)) return String(n);
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// 1 -> «01»
export function stepNumber(n) {
    return String(n).padStart(2, '0');
}

// https://statistikk-data.fhi.no/api/open/v1/daar/Table/643/data -> …/open/v1/daar/Table/643/data
export function shortenApiUrl(url) {
    if (typeof url !== 'string') return '';
    return url.replace(/^https?:\/\/[^/]+\/api/, '…');
}
