// Figur-fanen i steg 4, tegnet med Observable Plot (lastes fra CDN første gang den trengs).
// Valgene (låste verdier, geografisk nivå, oppdeling) eies av appen, så de kan lagres i lenken.
import { jsonStatToRows, chartPlan, chartPoints, geoLevelsIn, defaultGeoLevel, facetCandidates, sharedExtent } from '../lib/jsonstat.mjs';
import { Button, Icon, Segment } from './ui.mjs';

const { useState, useEffect, useMemo, useRef, createElement: h } = React;
const PLOT_URL = 'https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.17/+esm';
const PALETTE = ['#0F6B63', '#C2571A', '#3B5BA9', '#B8860B', '#8E3B8E', '#2E8B57', '#C0392B', '#5D6D7E', '#1F9AA8', '#7A5C3E'];
const DARK_PALETTE = ['#4FB8A8', '#E8894F', '#7E9BE0', '#D9B44A', '#C27BC2', '#5FBF86', '#E5776B', '#A3B1BD', '#5CC6D3', '#B89273'];
const EXPORT_FONT = "'Schibsted Grotesk', 'Segoe UI', Arial, sans-serif";
const PANEL_MIN_WIDTH = 280;
const PANEL_GAP = 16;

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

// Antall kolonner og bredde for små separate diagrammer.
function panelLayout(width, count) {
    const cols = Math.max(1, Math.min(count, Math.floor((width + PANEL_GAP) / (PANEL_MIN_WIDTH + PANEL_GAP))));
    return { cols: cols, width: Math.floor((width - PANEL_GAP * (cols - 1)) / cols) };
}

// opts: { forExport, palette, domain (felles verdiområde), compact (lite panel) }
function buildPlot(Plot, plan, result, width, flags, opts) {
    const palette = opts.palette;
    const fmt = numberFormat(result.unit && result.unit.decimals);
    const color = plan.series ? 'series' : palette[0];
    const tipTitle = function(p) {
        const shown = p.value == null ? (flags[p.flag] || 'Mangler verdi') : fmt(p.value);
        return (p.series ? p.series + ' · ' : '') + p.x + ': ' + shown;
    };
    const style = { fontFamily: opts.forExport ? EXPORT_FONT : 'inherit', fontSize: '12px', background: 'transparent', overflow: 'visible' };
    if (opts.forExport) style.color = '#15201E';
    const common = {
        width: width,
        style: style,
        color: plan.series ? { domain: result.seriesDomain, range: palette } : undefined,
        ariaLabel: plan.type === 'line' ? 'Linjediagram' : 'Søylediagram'
    };
    const points = result.points;
    const valueScale = { label: result.unit ? result.unit.label : null, grid: true, tickFormat: tickFormat, nice: true };
    const extent = opts.domain || sharedExtent([result], false);
    // Alle verdier like (f.eks. samme tall hvert år): aksen fra null, ellers får den bare ett tall.
    if (extent && extent[0] === extent[1]) valueScale.domain = [Math.min(0, extent[0]), Math.max(0, extent[1]) || 1];
    else if (opts.domain) valueScale.domain = opts.domain;

    if (plan.type === 'line') {
        const showDots = result.xDomain.length <= (opts.compact ? 15 : 30);
        const marks = [
            Plot.lineY(points, { x: 'x', y: 'value', stroke: color, z: plan.series ? 'series' : undefined, strokeWidth: opts.compact ? 1.75 : 2 }),
            showDots && Plot.dot(points, { x: 'x', y: 'value', fill: color, r: opts.compact ? 2 : 2.5 })
        ].filter(Boolean);
        if (!opts.forExport) marks.push(Plot.tip(points, Plot.pointerX({ x: 'x', y: 'value', title: tipTitle })));
        const height = opts.compact
            ? Math.round(Math.min(240, Math.max(170, width * 0.55)))
            : Math.round(Math.min(420, Math.max(260, width * 0.5)));
        return Plot.plot(Object.assign(common, {
            height: height,
            marginLeft: 56,
            marginBottom: opts.compact ? 24 : 36,
            x: { type: 'point', domain: result.xDomain, label: opts.compact ? null : plan.x.label, ticks: thinnedTicks(result.xDomain, width), padding: 0.3 },
            y: valueScale,
            marks: marks
        }));
    }

    // Liggende søyler; med farge-dimensjon grupperes søylene per kategori.
    const longest = result.xDomain.reduce(function(m, d) { return Math.max(m, estimateTextWidth(d)); }, 0);
    const marginLeft = Math.min(opts.compact ? 140 : 240, Math.max(60, Math.ceil(longest) + 16));
    const perCategory = plan.series ? result.seriesDomain.length * (opts.compact ? 10 : 14) + 10 : (opts.compact ? 20 : 26);
    const marks = [Plot.ruleX([0])];
    if (plan.series) {
        marks.unshift(Plot.barX(points, { x: 'value', y: 'series', fy: 'x', fill: 'series' }));
        if (!opts.forExport) marks.push(Plot.tip(points, Plot.pointerY({ x: 'value', y: 'series', fy: 'x', title: tipTitle })));
    } else {
        marks.unshift(Plot.barX(points, { x: 'value', y: 'x', fill: color }));
        if (!opts.forExport) marks.push(Plot.tip(points, Plot.pointerY({ x: 'value', y: 'x', title: tipTitle })));
    }
    const options = Object.assign(common, {
        height: result.xDomain.length * perCategory + 50,
        marginLeft: marginLeft,
        marginRight: 24,
        x: Object.assign(valueScale, { axis: 'top' }),
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

// Setter sammen tittel, forklaring, figur(er) og kildelinje til én frittstående SVG.
// panels: [{ title, svg }] — ett panel uten tittel for vanlig figur, flere for små separate diagrammer.
function composeExportSvg(panels, cols, info, seriesDomain) {
    const pad = 16;
    const panelWidth = Number(panels[0].svg.getAttribute('width'));
    const width = cols * panelWidth + (cols - 1) * PANEL_GAP + 2 * pad;
    const parts = [];
    let y = pad + 16;
    parts.push('<text x="' + pad + '" y="' + y + '" font-size="16" font-weight="600">' + escapeXml(info.title) + '</text>');
    if (info.subtitle) {
        y += 20;
        parts.push('<text x="' + pad + '" y="' + y + '" font-size="12" fill="#3D4845">' + escapeXml(info.subtitle) + '</text>');
    }
    if (seriesDomain.length) {
        y += 22;
        let x = pad;
        seriesDomain.forEach(function(name, i) {
            const w = 18 + estimateTextWidth(name) + 16;
            if (x + w > width - pad && x > pad) { x = pad; y += 18; }
            parts.push('<rect x="' + x + '" y="' + (y - 10) + '" width="12" height="12" rx="2" fill="' + PALETTE[i % PALETTE.length] + '"/>');
            parts.push('<text x="' + (x + 18) + '" y="' + y + '" font-size="12">' + escapeXml(name) + '</text>');
            x += w;
        });
    }
    let top = y + 14;
    for (let r = 0; r < panels.length; r += cols) {
        const row = panels.slice(r, r + cols);
        const titleHeight = row.some(function(p) { return p.title; }) ? 20 : 0;
        let rowHeight = 0;
        row.forEach(function(p, c) {
            const x = pad + c * (panelWidth + PANEL_GAP);
            if (p.title) parts.push('<text x="' + x + '" y="' + (top + 13) + '" font-size="13" font-weight="600">' + escapeXml(p.title) + '</text>');
            p.svg.setAttribute('x', x);
            p.svg.setAttribute('y', top + titleHeight);
            parts.push(new XMLSerializer().serializeToString(p.svg));
            rowHeight = Math.max(rowHeight, Number(p.svg.getAttribute('height')));
        });
        top += titleHeight + rowHeight + PANEL_GAP;
    }
    const footerY = top + 8;
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

// props: previewData, title, fileBase, sourceLabel, theme, chartState { filters, geoLevel, facet }, onChartState(updates)
export function ChartView(props) {
    const data = useMemo(function() { return jsonStatToRows(props.previewData); }, [props.previewData]);
    const plan = useMemo(function() { return chartPlan(data); }, [data]);
    const state = props.chartState || { filters: {}, geoLevel: null, facet: null };
    const filterValues = state.filters || {};
    const [Plot, setPlot] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [width, setWidth] = useState(0);
    const containerRef = useRef(null);
    const palette = props.theme === 'dark' ? DARK_PALETTE : PALETTE;

    // Nivåvalg for geografi gjelder bare søylediagram langs geografi.
    const levels = useMemo(function() { return plan.type === 'bar' ? geoLevelsIn(plan.x) : []; }, [plan]);
    const levelOptions = levels.filter(function(l) { return l.id !== 'land'; })
        .map(function(l) { return { value: l.id, label: l.label }; });
    const activeLevel = levels.some(function(l) { return l.id === state.geoLevel; }) ? state.geoLevel : defaultGeoLevel(levels);
    const facets = useMemo(function() { return facetCandidates(plan); }, [plan]);
    const facetDim = facets.find(function(d) { return d.id === state.facet; }) || null;

    // Ett resultat per panel; uten oppdeling er det bare ett, uten tittel.
    const panels = useMemo(function() {
        if (plan.type === 'none') return [];
        const opts = { geoLevel: activeLevel };
        if (!facetDim) return [{ title: null, result: chartPoints(data, plan, filterValues, opts) }];
        return facetDim.categories.map(function(c) {
            const values = Object.assign({}, filterValues, { [facetDim.id]: c.code });
            return { title: c.label, result: chartPoints(data, plan, values, opts) };
        });
    }, [data, plan, filterValues, activeLevel, facetDim]);
    const domain = useMemo(function() {
        return facetDim ? sharedExtent(panels.map(function(p) { return p.result; }), plan.type === 'bar') : null;
    }, [panels, facetDim, plan]);

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
        if (!el || !Plot || !panels.length || width < 50) return;
        if (!facetDim) {
            el.replaceChildren(buildPlot(Plot, plan, panels[0].result, width, data.flags, { palette: palette }));
            return;
        }
        const layout = panelLayout(width, panels.length);
        const grid = document.createElement('div');
        grid.className = 'chart-grid';
        grid.style.gridTemplateColumns = 'repeat(' + layout.cols + ', minmax(0, 1fr))';
        panels.forEach(function(p) {
            const panel = document.createElement('div');
            panel.className = 'chart-panel';
            const heading = document.createElement('h3');
            heading.className = 'chart-panel-title';
            heading.textContent = p.title;
            panel.appendChild(heading);
            panel.appendChild(buildPlot(Plot, plan, p.result, layout.width, data.flags, { palette: palette, domain: domain, compact: true }));
            grid.appendChild(panel);
        });
        el.replaceChildren(grid);
    }, [Plot, plan, panels, width, data, palette, facetDim, domain]);

    if (!data) return h('p', { className: 'side-text' }, 'Figur kan bare lages fra JSON-stat-data.');
    if (plan.type === 'none') return h('p', { className: 'side-text chart-note' }, plan.reason);

    const lockedDims = plan.filters.filter(function(d) { return d !== facetDim; });
    const chosenLabel = function(dim) {
        const code = filterValues[dim.id];
        const cat = dim.categories.find(function(c) { return c.code === code; }) || dim.categories[0];
        return cat.label;
    };
    // Dimensjoner med bare én verdi i utvalget (f.eks. ett år) vises ikke i figuren, så de står i undertittelen. Tid først.
    const fixedDims = data.dimensions.filter(function(d) { return d.categories.length === 1; })
        .sort(function(a, b) { return (b.role === 'time') - (a.role === 'time'); });
    const fixedText = fixedDims.map(function(d) { return d.label + ': ' + d.categories[0].label; });
    const subtitle = fixedText
        .concat(lockedDims.map(function(d) { return d.label + ': ' + chosenLabel(d); }))
        .concat(facetDim ? ['Delt opp etter ' + facetDim.label.toLowerCase()] : [])
        .join(' · ');
    const allPoints = panels.reduce(function(acc, p) { return acc.concat(p.result.points); }, []);
    const missing = panels.reduce(function(n, p) { return n + p.result.missing; }, 0);
    const truncated = panels[0].result.truncated;
    const seriesDomain = panels[0].result.seriesDomain;

    const exportChart = function(kind) {
        if (!Plot) return;
        let svg;
        const info = { title: props.title, subtitle: subtitle, source: props.sourceLabel };
        if (!facetDim) {
            svg = composeExportSvg([{ title: null, svg: buildPlot(Plot, plan, panels[0].result, Math.max(width, 640), data.flags, { forExport: true, palette: PALETTE }) }],
                1, info, seriesDomain);
        } else {
            const layout = panelLayout(Math.max(width, 900), panels.length);
            svg = composeExportSvg(panels.map(function(p) {
                return { title: p.title, svg: buildPlot(Plot, plan, p.result, layout.width, data.flags, { forExport: true, palette: PALETTE, domain: domain, compact: true }) };
            }), layout.cols, info, seriesDomain);
        }
        if (kind === 'svg') saveBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), props.fileBase + '.svg');
        else savePng(svg, props.fileBase + '.png', function() { setLoadError('Kunne ikke lage PNG. Prøv SVG i stedet.'); });
    };

    const missingFlags = Array.from(new Set(allPoints.filter(function(p) { return p.value == null && p.flag; })
        .map(function(p) { return data.flags[p.flag] || p.flag; })));
    const setFilter = function(dimId, value) {
        props.onChartState({ filters: Object.assign({}, filterValues, { [dimId]: value }) });
    };

    return h('div', { className: 'chart-view' },
        h('div', { className: 'chart-head' },
            h('h3', { className: 'chart-title' }, props.title),
            fixedText.length > 0 && h('p', { className: 'chart-context' }, fixedText.join(' · '))
        ),
        (lockedDims.length > 0 || levelOptions.length > 1 || facets.length > 0) && h('div', { className: 'chart-filters' },
            facets.length > 0 && h('div', { className: 'chart-filter' },
                h('label', { className: 'field-label', htmlFor: 'chart-facet' }, 'Del opp etter'),
                h('select', {
                    id: 'chart-facet',
                    className: 'text-input chart-select',
                    value: facetDim ? facetDim.id : '',
                    onChange: function(e) { props.onChartState({ facet: e.target.value || null }); }
                },
                    h('option', { value: '' }, 'Ingen oppdeling'),
                    facets.map(function(d) { return h('option', { key: d.id, value: d.id }, d.label + ' (' + d.categories.length + ' figurer)'); })
                )
            ),
            levelOptions.length > 1 && h('div', { className: 'chart-filter chart-filter-level' },
                h('span', { className: 'field-label' }, 'Geografisk nivå'),
                h(Segment, {
                    label: 'Geografisk nivå',
                    options: levelOptions,
                    value: activeLevel,
                    onChange: function(level) { props.onChartState({ geoLevel: level }); }
                })
            ),
            lockedDims.map(function(dim) {
                const id = 'chart-filter-' + dim.id;
                return h('div', { key: dim.id, className: 'chart-filter' },
                    h('label', { className: 'field-label', htmlFor: id }, dim.label),
                    h('select', {
                        id: id,
                        className: 'text-input chart-select',
                        value: dim.categories.some(function(c) { return c.code === filterValues[dim.id]; }) ? filterValues[dim.id] : dim.categories[0].code,
                        onChange: function(e) { setFilter(dim.id, e.target.value); }
                    }, dim.categories.map(function(c) { return h('option', { key: c.code, value: c.code }, c.label); }))
                );
            })
        ),
        plan.series && h('ul', { className: 'chart-legend', 'aria-label': 'Forklaring: ' + plan.series.label },
            seriesDomain.map(function(name, i) {
                return h('li', { key: name },
                    h('span', { className: 'chart-swatch', style: { background: palette[i % palette.length] } }),
                    name);
            })
        ),
        loadError && h('p', { className: 'side-text chart-note' }, loadError),
        !Plot && !loadError && h('p', { className: 'side-text' }, 'Laster figur …'),
        h('div', { ref: containerRef, className: 'chart-canvas', role: 'figure', 'aria-label': props.title }),
        missing > 0 && h('p', { className: 'help-text' },
            missing + ' verdi' + (missing === 1 ? '' : 'er') + ' mangler i figuren' +
            (missingFlags.length ? ' (' + missingFlags.join(', ').toLowerCase() + ')' : '') + '.'),
        truncated && h('p', { className: 'help-text' },
            'Figuren viser de første ' + truncated.shown + ' av ' + truncated.total + ' kategoriene. Velg færre verdier i steg 03 for å se resten, eller bruk tabellvisningen.'),
        h('div', { className: 'chart-actions' },
            h(Button, { size: 'sm', variant: 'outline', icon: Icon.download(16), disabled: !Plot, onClick: function() { exportChart('png'); } }, 'Last ned PNG'),
            h(Button, { size: 'sm', variant: 'outline', icon: Icon.download(16), disabled: !Plot, onClick: function() { exportChart('svg'); } }, 'Last ned SVG')
        )
    );
}
