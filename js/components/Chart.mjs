// Figurvisning av forhåndsvisningsdata med Observable Plot (lastes fra CDN første gang den trengs).
import { jsonStatToRows, chartPlan, chartPoints, geoLevelsIn, defaultGeoLevel } from '../lib/jsonstat.mjs';
import { Button, Icon, Segment } from './ui.mjs';

const { useState, useEffect, useMemo, useRef, createElement: h } = React;
const PLOT_URL = 'https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.17/+esm';
const PALETTE = ['#0F6B63', '#C2571A', '#3B5BA9', '#B8860B', '#8E3B8E', '#2E8B57', '#C0392B', '#5D6D7E', '#1F9AA8', '#7A5C3E'];
const DARK_PALETTE = ['#4FB8A8', '#E8894F', '#7E9BE0', '#D9B44A', '#C27BC2', '#5FBF86', '#E5776B', '#A3B1BD', '#5CC6D3', '#B89273'];
const EXPORT_FONT = "'Schibsted Grotesk', 'Segoe UI', Arial, sans-serif";

let plotPromise = null;
function loadPlot() {
    if (!plotPromise) {
        plotPromise = import(PLOT_URL).catch(function(err) {
            plotPromise = null;
            throw err;
        });
    }
    return plotPromise;
}

function numberFormat(decimals) {
    const nf = new Intl.NumberFormat('nb-NO', decimals == null ? { maximumFractionDigits: 2 } : { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return function(v) { return v == null ? '' : nf.format(v); };
}
const tickFormat = numberFormat(null);

function estimateTextWidth(text, px) {
    return String(text).length * (px || 12) * 0.58;
}

// Viser hver n-te etikett på x-aksen så de ikke overlapper.
function thinnedTicks(domain, width) {
    const longest = domain.reduce(function(m, d) { return Math.max(m, estimateTextWidth(d)); }, 0);
    const room = Math.max(1, Math.floor((width - 80) / (longest + 14)));
    const step = Math.ceil(domain.length / room);
    return domain.filter(function(_, i) { return i % step === 0; });
}

function buildPlot(Plot, plan, result, width, flags, forExport, palette) {
    const fmt = numberFormat(result.unit && result.unit.decimals);
    const color = plan.series ? 'series' : palette[0];
    const tipTitle = function(p) {
        const shown = p.value == null ? (flags[p.flag] || 'Mangler verdi') : fmt(p.value);
        return (p.series ? p.series + ' · ' : '') + p.x + ': ' + shown;
    };
    const style = { fontFamily: forExport ? EXPORT_FONT : 'inherit', fontSize: '12px', background: 'transparent', overflow: 'visible' };
    if (forExport) style.color = '#15201E';
    const common = {
        width: width,
        style: style,
        color: plan.series ? { domain: result.seriesDomain, range: palette } : undefined,
        ariaLabel: plan.type === 'line' ? 'Linjediagram' : 'Søylediagram'
    };
    const points = result.points;

    if (plan.type === 'line') {
        const showDots = result.xDomain.length <= 30;
        const marks = [
            Plot.lineY(points, { x: 'x', y: 'value', stroke: color, z: plan.series ? 'series' : undefined, strokeWidth: 2 }),
            showDots && Plot.dot(points, { x: 'x', y: 'value', fill: color, r: 2.5 })
        ].filter(Boolean);
        if (!forExport) marks.push(Plot.tip(points, Plot.pointerX({ x: 'x', y: 'value', title: tipTitle })));
        return Plot.plot(Object.assign(common, {
            height: Math.round(Math.min(420, Math.max(260, width * 0.5))),
            marginLeft: 56,
            marginBottom: 36,
            x: { type: 'point', domain: result.xDomain, label: plan.x.label, ticks: thinnedTicks(result.xDomain, width), padding: 0.3 },
            y: { label: result.unit ? result.unit.label : null, grid: true, tickFormat: tickFormat, nice: true },
            marks: marks
        }));
    }

    // Liggende søyler; med farge-dimensjon grupperes søylene per kategori.
    const longest = result.xDomain.reduce(function(m, d) { return Math.max(m, estimateTextWidth(d)); }, 0);
    const marginLeft = Math.min(240, Math.max(60, Math.ceil(longest) + 16));
    const perCategory = plan.series ? result.seriesDomain.length * 14 + 10 : 26;
    const marks = [Plot.ruleX([0])];
    if (plan.series) {
        marks.unshift(Plot.barX(points, { x: 'value', y: 'series', fy: 'x', fill: 'series' }));
        if (!forExport) marks.push(Plot.tip(points, Plot.pointerY({ x: 'value', y: 'series', fy: 'x', title: tipTitle })));
    } else {
        marks.unshift(Plot.barX(points, { x: 'value', y: 'x', fill: color }));
        if (!forExport) marks.push(Plot.tip(points, Plot.pointerY({ x: 'value', y: 'x', title: tipTitle })));
    }
    const options = Object.assign(common, {
        height: result.xDomain.length * perCategory + 50,
        marginLeft: marginLeft,
        marginRight: 24,
        x: { label: result.unit ? result.unit.label : null, grid: true, tickFormat: tickFormat, nice: true, axis: 'top' },
        marks: marks
    });
    if (plan.series) {
        options.fy = { domain: result.xDomain, label: null, padding: 0.15 };
        options.y = { domain: result.seriesDomain, axis: null };
    } else {
        options.y = { domain: result.xDomain, label: null };
    }
    return Plot.plot(options);
}

function escapeXml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Setter sammen tittel, forklaring, figur og kildelinje til én frittstående SVG.
function composeExportSvg(plotSvg, info, result) {
    const width = Number(plotSvg.getAttribute('width'));
    const plotHeight = Number(plotSvg.getAttribute('height'));
    const pad = 16;
    const parts = [];
    let y = pad + 16;
    parts.push('<text x="' + pad + '" y="' + y + '" font-size="16" font-weight="600">' + escapeXml(info.title) + '</text>');
    if (info.subtitle) {
        y += 20;
        parts.push('<text x="' + pad + '" y="' + y + '" font-size="12" fill="#3D4845">' + escapeXml(info.subtitle) + '</text>');
    }
    if (result.seriesDomain.length) {
        y += 22;
        let x = pad;
        result.seriesDomain.forEach(function(name, i) {
            const w = 18 + estimateTextWidth(name) + 16;
            if (x + w > width - pad && x > pad) { x = pad; y += 18; }
            parts.push('<rect x="' + x + '" y="' + (y - 10) + '" width="12" height="12" rx="2" fill="' + PALETTE[i % PALETTE.length] + '"/>');
            parts.push('<text x="' + (x + 18) + '" y="' + y + '" font-size="12">' + escapeXml(name) + '</text>');
            x += w;
        });
    }
    const plotTop = y + 14;
    const footerY = plotTop + plotHeight + 22;
    plotSvg.setAttribute('x', 0);
    plotSvg.setAttribute('y', plotTop);
    const plotMarkup = new XMLSerializer().serializeToString(plotSvg);
    parts.push(plotMarkup);
    parts.push('<text x="' + pad + '" y="' + footerY + '" font-size="11" fill="#5B6764">' + escapeXml(info.source) + '</text>');
    const height = footerY + pad;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '"' +
        ' font-family="' + escapeXml(EXPORT_FONT) + '" fill="#15201E">' +
        '<rect width="100%" height="100%" fill="#FFFFFF"/>' + parts.join('') + '</svg>';
}

function saveBlob(blob, fileName) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function() { URL.revokeObjectURL(link.href); }, 1000);
}

function savePng(svgText, fileName, onError) {
    const img = new Image();
    img.onload = function() {
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const c = canvas.getContext('2d');
        c.fillStyle = '#FFFFFF';
        c.fillRect(0, 0, canvas.width, canvas.height);
        c.scale(scale, scale);
        c.drawImage(img, 0, 0);
        canvas.toBlob(function(blob) {
            if (blob) saveBlob(blob, fileName);
            else onError();
        }, 'image/png');
    };
    img.onerror = onError;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
}

// props: previewData, title, fileBase, sourceLabel, theme
export function ChartView(props) {
    const data = useMemo(function() { return jsonStatToRows(props.previewData); }, [props.previewData]);
    const plan = useMemo(function() { return chartPlan(data); }, [data]);
    const [filterValues, setFilterValues] = useState({});
    const [geoLevel, setGeoLevel] = useState(null);
    const [Plot, setPlot] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [width, setWidth] = useState(0);
    const containerRef = useRef(null);
    const palette = props.theme === 'dark' ? DARK_PALETTE : PALETTE;

    // Nivåvalg for geografi gjelder bare søylediagram langs geografi.
    const levels = useMemo(function() { return plan.type === 'bar' ? geoLevelsIn(plan.x) : []; }, [plan]);
    const levelOptions = levels.filter(function(l) { return l.id !== 'land'; })
        .map(function(l) { return { value: l.id, label: l.label }; });
    const activeLevel = levels.some(function(l) { return l.id === geoLevel; }) ? geoLevel : defaultGeoLevel(levels);

    const result = useMemo(function() {
        return plan.type === 'none' ? null : chartPoints(data, plan, filterValues, { geoLevel: activeLevel });
    }, [data, plan, filterValues, activeLevel]);

    useEffect(function() {
        let active = true;
        loadPlot().then(
            function(mod) { if (active) setPlot(function() { return mod; }); },
            function() { if (active) setLoadError('Kunne ikke laste figurbiblioteket. Sjekk nettforbindelsen og prøv igjen.'); }
        );
        return function() { active = false; };
    }, []);

    useEffect(function() {
        const el = containerRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(function(entries) {
            setWidth(Math.floor(entries[0].contentRect.width));
        });
        observer.observe(el);
        return function() { observer.disconnect(); };
    }, [plan.type]);

    useEffect(function() {
        const el = containerRef.current;
        if (!el || !Plot || !result || width < 50) return;
        const chart = buildPlot(Plot, plan, result, width, data.flags, false, palette);
        el.replaceChildren(chart);
        return function() { chart.remove(); };
    }, [Plot, plan, result, width, data, palette]);

    if (!data) return h('p', { className: 'side-text' }, 'Figur kan bare lages fra JSON-stat-data.');
    if (plan.type === 'none') return h('p', { className: 'side-text chart-note' }, plan.reason);

    const chosenLabel = function(dim) {
        const code = filterValues[dim.id];
        const cat = dim.categories.find(function(c) { return c.code === code; }) || dim.categories[0];
        return cat.label;
    };
    const subtitle = plan.filters.map(function(d) { return d.label + ': ' + chosenLabel(d); }).join(' · ');
    const exportInfo = { title: props.title, subtitle: subtitle, source: props.sourceLabel };

    const exportChart = function(kind) {
        if (!Plot) return;
        const svg = composeExportSvg(buildPlot(Plot, plan, result, Math.max(width, 640), data.flags, true, PALETTE), exportInfo, result);
        if (kind === 'svg') saveBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), props.fileBase + '.svg');
        else savePng(svg, props.fileBase + '.png', function() { setLoadError('Kunne ikke lage PNG. Prøv SVG i stedet.'); });
    };

    const missingFlags = Array.from(new Set(result.points.filter(function(p) { return p.value == null && p.flag; })
        .map(function(p) { return data.flags[p.flag] || p.flag; })));

    return h('div', { className: 'chart-view' },
        (plan.filters.length > 0 || levelOptions.length > 1) && h('div', { className: 'chart-filters' },
            levelOptions.length > 1 && h('div', { className: 'chart-filter chart-filter-level' },
                h('span', { className: 'field-label' }, 'Geografisk nivå'),
                h(Segment, {
                    label: 'Geografisk nivå',
                    options: levelOptions,
                    value: activeLevel,
                    onChange: setGeoLevel
                })
            ),
            plan.filters.map(function(dim) {
                const id = 'chart-filter-' + dim.id;
                return h('div', { key: dim.id, className: 'chart-filter' },
                    h('label', { className: 'field-label', htmlFor: id }, dim.label),
                    h('select', {
                        id: id,
                        className: 'text-input chart-select',
                        value: filterValues[dim.id] || dim.categories[0].code,
                        onChange: function(e) {
                            const value = e.target.value;
                            setFilterValues(function(prev) { return Object.assign({}, prev, { [dim.id]: value }); });
                        }
                    }, dim.categories.map(function(c) { return h('option', { key: c.code, value: c.code }, c.label); }))
                );
            })
        ),
        plan.series && h('ul', { className: 'chart-legend', 'aria-label': 'Forklaring: ' + plan.series.label },
            result.seriesDomain.map(function(name, i) {
                return h('li', { key: name },
                    h('span', { className: 'chart-swatch', style: { background: palette[i % palette.length] } }),
                    name);
            })
        ),
        loadError && h('p', { className: 'side-text chart-note' }, loadError),
        !Plot && !loadError && h('p', { className: 'side-text' }, 'Laster figur …'),
        h('div', { ref: containerRef, className: 'chart-canvas', role: 'figure', 'aria-label': props.title }),
        result.missing > 0 && h('p', { className: 'help-text' },
            result.missing + ' verdi' + (result.missing === 1 ? '' : 'er') + ' mangler i figuren' +
            (missingFlags.length ? ' (' + missingFlags.join(', ').toLowerCase() + ')' : '') + '.'),
        result.truncated && h('p', { className: 'help-text' },
            'Figuren viser de første ' + result.truncated.shown + ' av ' + result.truncated.total + ' kategoriene. Velg færre verdier i steg 03 for å se resten, eller bruk tabellvisningen.'),
        h('div', { className: 'chart-actions' },
            h(Button, { size: 'sm', variant: 'outline', icon: Icon.download(16), disabled: !Plot, onClick: function() { exportChart('png'); } }, 'Last ned PNG'),
            h(Button, { size: 'sm', variant: 'outline', icon: Icon.download(16), disabled: !Plot, onClick: function() { exportChart('svg'); } }, 'Last ned SVG')
        )
    );
}
