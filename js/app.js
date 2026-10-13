import { parseTableLabelsCSV } from './lib/csv.mjs';
import { getTableLabel, getTableCategory, flattenCategories, isTableMapped, fallbackTableLabel, hasReadableTitle } from './lib/tableLabels.mjs';
import { firstSentenceFromMetadata, labelFromMetadata } from './lib/metadata.mjs';
import { getGeographyGroups, geoLevelsOfDimensions } from './lib/geo.mjs';
import { findMetricDimension, buildQuery } from './lib/query.mjs';
import { generatePowerQueryCode } from './lib/powerquery.mjs';
import { expectedRows, isFiltered } from './lib/selection.mjs';
import { formatNumber } from './lib/format.mjs';
import { previewToCsv, csvFileName } from './lib/preview.mjs';
import { defaultSelection } from './lib/defaults.mjs';
import { encodeState, decodeState, applyUrlSelection } from './lib/urlState.mjs';
import { Header, Sidebar, StepDots, Credits } from './components/Layout.mjs';
import { Icon, Alert } from './components/ui.mjs';
import { renderSourceStep, renderSourceActions } from './components/SourceSelection.mjs';
import { renderTableStep, renderTableActions } from './components/TableSelection.mjs';
import { renderVariablesStep, renderVariablesActions } from './components/DimensionConfiguration.mjs';
import { renderDataStep, renderDataActions } from './components/DataStep.mjs';
import { renderMetadataModal, closeMetadataModal as closeMetadataModalImpl } from './components/MetadataModal.mjs';

const { useState, useEffect, useRef, createElement: h } = React;
const API_BASE = 'https://statistikk-data.fhi.no/api/open/v1';
const VIEW_LABELS = { figur: 'Figur', tabell: 'Tabell', api: 'API og Power BI' };
const EMPTY_CHART = { filters: {}, geoLevel: null, facet: null };

function readStoredTheme() {
    try {
        const t = localStorage.getItem('fhi-theme');
        return t === 'dark' || t === 'light' ? t : null;
    } catch (e) {
        return null;
    }
}

function systemPrefersDark() {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function FHIQueryBuilder() {
    const [step, setStep] = useState(1);
    const [sources, setSources] = useState([]);
    const [selectedSource, setSelectedSource] = useState(null);
    const [tables, setTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState(null);
    const [dimensions, setDimensions] = useState([]);
    const [queryConfig, setQueryConfig] = useState({});
    const [finalQuery, setFinalQuery] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [responseFormat, setResponseFormat] = useState('json-stat2');
    const [maxRowCount, setMaxRowCount] = useState('');
    const [loading, setLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(false);
    const [error, setError] = useState(null);
    const [globalSearch, setGlobalSearch] = useState('');
    const [allTables, setAllTables] = useState([]);
    const [tableSearch, setTableSearch] = useState('');
    const [outputFormat, setOutputFormat] = useState('json');
    const [geoSearch, setGeoSearch] = useState('');
    const [expandedCounties, setExpandedCounties] = useState({});
    const [tableMetadata, setTableMetadata] = useState(null);
    const [firstSentence, setFirstSentence] = useState('');
    const [showMetadataModal, setShowMetadataModal] = useState(false);
    const [expandedMunicipalities, setExpandedMunicipalities] = useState({});
    const [tableLabels, setTableLabels] = useState({});
    const [tableGeoLevels, setTableGeoLevels] = useState({});
    const [expandedCategories, setExpandedCategories] = useState({});
    const [geoMappingUrl] = useState('https://raw.githubusercontent.com/jahili/helsestatistikk/main/geo_mapping.csv');

    // Rene visningsvalg for det nye grensesnittet. Påvirker ikke spørringen.
    const [theme, setTheme] = useState(readStoredTheme);
    const [copiedKey, setCopiedKey] = useState(null);
    const [publisherFilter, setPublisherFilter] = useState('all');
    const [tableSort, setTableSort] = useState('theme');
    const [highlightedTable, setHighlightedTable] = useState(null);
    const [tablePreviewDims, setTablePreviewDims] = useState({});
    const [fallbackLabels, setFallbackLabels] = useState({});
    const requestedFallbacks = useRef({});
    const [valueSearch, setValueSearch] = useState({});
    const [wildcardDims, setWildcardDims] = useState({});
    const [wildcardDrafts, setWildcardDrafts] = useState({});
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [pendingCsv, setPendingCsv] = useState(false);
    // Data-steget: fane, figurvalg, tabellvisning og utvalget som ga dataene som vises.
    const [dataView, setDataView] = useState('figur');
    const [chartState, setChartState] = useState(EMPTY_CHART);
    const [tableMode, setTableMode] = useState('pivot');
    const [pivotCol, setPivotCol] = useState(null);
    const [appliedSelection, setAppliedSelection] = useState(null);
    const [notice, setNotice] = useState(null);
    const openSeq = useRef(0);
    const dataSeq = useRef(0);
    // Lenke-tilstand: valgene i URL-en leses ved oppstart, og skrives tilbake når de endres.
    const urlRequest = useRef(decodeState(window.location.hash));
    const [urlReady, setUrlReady] = useState(!urlRequest.current.sourceId);
    const [urlRevision, setUrlRevision] = useState(0);
    const lastHash = useRef(window.location.hash.replace(/^#/, ''));
    const globalSearchRef = useRef(null);
    const mainRef = useRef(null);
    const copyTimer = useRef(null);

    useEffect(() => {
        fetchSources();
        fetchTableLabels();
        fetchTableGeoLevels();
    }, []);

    useEffect(() => {
        function handleEscKey(e) {
            if (e.key === 'Escape' && showMetadataModal) closeMetadataModal();
        }
        document.addEventListener('keydown', handleEscKey);
        return function() {
            document.removeEventListener('keydown', handleEscKey);
        };
    }, [showMetadataModal]);

    useEffect(() => {
        setFirstSentence(firstSentenceFromMetadata(tableMetadata));
    }, [tableMetadata]);

    // Tema: lagret valg, ellers systemets innstilling.
    const effectiveTheme = theme || (systemPrefersDark() ? 'dark' : 'light');
    useEffect(() => {
        if (theme) document.documentElement.setAttribute('data-theme', theme);
        else document.documentElement.removeAttribute('data-theme');
    }, [theme]);

    function toggleTheme() {
        const next = effectiveTheme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        try { localStorage.setItem('fhi-theme', next); } catch (e) { /* lagring er valgfritt */ }
    }

    // Tastatursnarvei «/» fokuserer søket i steg 1.
    useEffect(() => {
        function handleSlash(e) {
            if (e.key !== '/' || step !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
            const tag = (e.target && e.target.tagName) || '';
            if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
            e.preventDefault();
            if (globalSearchRef.current) globalSearchRef.current.focus();
        }
        document.addEventListener('keydown', handleSlash);
        return function() { document.removeEventListener('keydown', handleSlash); };
    }, [step]);

    // Flytt fokus til innholdet ved stegbytte, slik at skjermlesere følger med.
    const firstRender = useRef(true);
    useEffect(() => {
        if (firstRender.current) { firstRender.current = false; return; }
        if (mainRef.current) mainRef.current.focus({ preventScroll: true });
        window.scrollTo(0, 0);
    }, [step]);

    // Steg 4: «Last ned som CSV» før forhåndsvisning er hentet laster ned når dataene kommer.
    useEffect(() => {
        if (pendingCsv && previewData) {
            setPendingCsv(false);
            downloadCsv();
        }
    }, [pendingCsv, previewData]);
    useEffect(() => {
        if (pendingCsv && error) setPendingCsv(false);
    }, [pendingCsv, error]);

    async function fetchSources() {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(API_BASE + '/Common/source');
            if (!response.ok) throw new Error('Kunne ikke hente kilder');
            const data = await response.json();
            setSources(data);

            const promises = data.map(async function(source) {
                try {
                    const resp = await fetch(API_BASE + '/' + source.id + '/Table');
                    if (resp.ok) {
                        const tables = await resp.json();
                        return tables.map(function(table) {
                            return Object.assign({}, table, { sourceId: source.id, sourceName: source.title || source.name });
                        });
                    }
                } catch (e) {
                    return [];
                }
                return [];
            });
            const results = await Promise.all(promises);
            const flatTables = results.reduce(function(acc, tables) { return acc.concat(tables); }, []);
            setAllTables(flatTables);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function fetchTableLabels() {
        try {
            const response = await fetch('./fhi_table_label_mapping.csv');
            if (!response.ok) throw new Error('Kunne ikke hente tabell-labels (status: ' + response.status + ')');
            const csvText = await response.text();
            setTableLabels(parseTableLabelsCSV(csvText));
        } catch (err) {
            console.error('Kunne ikke hente tabell-labels:', err.message);
        }
    }

    // Geografiske nivåer per tabell (N, F, K, B, LKS, R), laget av scripts/update-geo-levels.mjs.
    async function fetchTableGeoLevels() {
        try {
            const response = await fetch('./table_geo_levels.json');
            if (response.ok) setTableGeoLevels(await response.json());
        } catch (err) {
            console.error('Kunne ikke hente geografiske nivåer:', err.message);
        }
    }

    async function fetchTables(sourceId) {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(API_BASE + '/' + sourceId + '/Table');
            if (!response.ok) throw new Error('Kunne ikke hente tabeller');
            setTables(await response.json());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    // Henter dimensjonene og setter standardutvalget, med valgene fra en lenke oppå (urlDims).
    // Returnerer { dims, config, wildcardDims } eller null ved feil.
    async function fetchDimensions(sourceId, tableId, urlDims) {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(API_BASE + '/' + sourceId + '/Table/' + tableId + '/dimension');
            if (!response.ok) throw new Error('Kunne ikke hente dimensjoner');
            const data = await response.json();

            let dimensionsArray = data;
            if (data && typeof data === 'object' && !Array.isArray(data) && data.dimensions) {
                dimensionsArray = data.dimensions;
            }
            if (!Array.isArray(dimensionsArray)) {
                console.error('Uventet data format:', data);
                throw new Error('Kunne ikke finne dimensions i API-responsen');
            }

            dimensionsArray = dimensionsArray.map(function(dim) {
                if (dim.categories && !dim.category) {
                    dim.category = flattenCategories(dim.categories);
                }
                return dim;
            });

            const defaults = defaultSelection(dimensionsArray);
            const fromUrl = applyUrlSelection(dimensionsArray, defaults, urlDims || {});
            if (fromUrl.dropped > 0) {
                setNotice(fromUrl.dropped + ' verdi' + (fromUrl.dropped === 1 ? '' : 'er') + ' fra lenken finnes ikke lenger i tabellen og er hoppet over.');
            }
            setDimensions(dimensionsArray);
            setQueryConfig(fromUrl.config);
            setWildcardDims(fromUrl.wildcardDims);
            return { dims: dimensionsArray, config: fromUrl.config, wildcardDims: fromUrl.wildcardDims };
        } catch (err) {
            setError(err.message);
            setDimensions([]);
            return null;
        } finally {
            setLoading(false);
        }
    }

    // Steg 2: hent dimensjonene for tabellen som er markert i listen, slik at
    // detaljpanelet kan vise strukturen før brukeren går videre. Rører ikke
    // `dimensions`/`queryConfig`, som fortsatt settes av fetchDimensions i steg 3.
    async function fetchTablePreviewDims(sourceId, tableId) {
        const key = sourceId + '/' + tableId;
        if (tablePreviewDims[key] && tablePreviewDims[key].status !== 'error') return;
        setTablePreviewDims(function(prev) { return Object.assign({}, prev, { [key]: { status: 'loading' } }); });
        try {
            const response = await fetch(API_BASE + '/' + sourceId + '/Table/' + tableId + '/dimension');
            if (!response.ok) throw new Error('Kunne ikke hente dimensjoner');
            const data = await response.json();
            let dims = data && !Array.isArray(data) && data.dimensions ? data.dimensions : data;
            if (!Array.isArray(dims)) throw new Error('Kunne ikke finne dimensions i API-responsen');
            const geoLevels = geoLevelsOfDimensions(dims);
            dims = dims.map(function(dim) {
                const category = dim.category || (dim.categories ? flattenCategories(dim.categories) : null);
                return { code: dim.code, label: dim.label, count: category && category.index ? category.index.length : 0 };
            });
            setTablePreviewDims(function(prev) { return Object.assign({}, prev, { [key]: { status: 'ok', dims: dims, geoLevels: geoLevels } }); });
        } catch (err) {
            setTablePreviewDims(function(prev) { return Object.assign({}, prev, { [key]: { status: 'error', message: err.message } }); });
        }
    }

    async function fetchMetadata(sourceId, tableId, options) {
        const openModal = Boolean(options && options.openModal);
        try {
            const response = await fetch(API_BASE + '/' + sourceId + '/Table/' + tableId + '/metadata');
            if (!response.ok) throw new Error('Kunne ikke hente metadata');
            const data = await response.json();
            setTableMetadata(data);
            if (openModal) setShowMetadataModal(true);
        } catch (err) {
            if (openModal) setError(err.message);
        }
    }

    function fetchPreview() {
        if (finalQuery) fetchData(finalQuery, selectedSource, selectedTable);
    }

    // Henter dataene for en spørring som JSON-stat2. Svar på eldre forespørsler ignoreres.
    async function fetchData(query, source, table) {
        const seq = ++dataSeq.current;
        setDataLoading(true);
        setError(null);
        try {
            const previewQuery = JSON.parse(JSON.stringify(query));
            previewQuery.response.format = 'json-stat2';

            const response = await fetch(
                API_BASE + '/' + source.id + '/Table/' + table.tableId + '/data',
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(previewQuery) }
            );

            if (!response.ok) {
                try {
                    const errorData = await response.json();
                    if (errorData.errors) {
                        const errorMessages = [];
                        for (const field in errorData.errors) {
                            errorMessages.push(field + ': ' + errorData.errors[field][0]);
                        }
                        throw new Error('Validationsfeil: ' + errorMessages.join(', '));
                    }
                    throw new Error(errorData.message || 'Kunne ikke hente data');
                } catch (parseError) {
                    throw new Error('Kunne ikke hente preview: ' + response.statusText + ' - ' + parseError.message);
                }
            }

            const contentType = response.headers.get('content-type');
            let data;
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else if (contentType && contentType.includes('text/csv')) {
                data = { csvText: await response.text() };
            } else {
                data = await response.json();
            }
            if (seq === dataSeq.current) setPreviewData(data);
        } catch (err) {
            if (seq === dataSeq.current) setError(err.message || 'Feil ved henting av data');
        } finally {
            if (seq === dataSeq.current) setDataLoading(false);
        }
    }

    // Åpner en tabell i steg 3 med standardutvalget, og henter dataene i bakgrunnen så «Vis data» går raskt.
    // restore: valg fra en lenke ({ dims, step, view, format, maxRowCount, chart }); lenker går rett til dataene.
    async function selectSourceAndTable(source, table, restore) {
        const seq = ++openSeq.current;
        const format = (restore && restore.format) || responseFormat;
        const max = restore && restore.maxRowCount ? restore.maxRowCount : maxRowCount;
        const targetStep = restore ? (restore.step === 3 ? 3 : 4) : 3;
        setSelectedSource(source);
        setSelectedTable(table);
        setDimensions([]);
        setQueryConfig({});
        setFinalQuery(null);
        setPreviewData(null);
        setAppliedSelection(null);
        setTableSearch('');
        setGlobalSearch('');
        setShowMetadataModal(false);
        setNotice(null);
        setError(null);
        fetchMetadata(source.id, table.tableId);
        setStep(targetStep);
        // Visningsvalg som hører til forrige tabell
        setHighlightedTable(table);
        setValueSearch({});
        setWildcardDims({});
        setWildcardDrafts({});
        setGeoSearch('');
        setChartState(restore && restore.chart ? restore.chart : EMPTY_CHART);
        setPivotCol(null);
        if (restore) {
            if (restore.view) setDataView(restore.view);
            if (restore.format) setResponseFormat(restore.format);
            if (restore.maxRowCount) setMaxRowCount(restore.maxRowCount);
        }

        const result = await fetchDimensions(source.id, table.tableId, restore && restore.dims);
        if (!result || seq !== openSeq.current) return;
        const query = buildQuery(result.dims, result.config, format, max);
        setFinalQuery(query);
        setAppliedSelection({ config: result.config, wildcardDims: result.wildcardDims });
        fetchData(query, source, table);
    }

    function selectSource(source) {
        setSelectedSource(source);
        setSelectedTable(null);
        setDimensions([]);
        setQueryConfig({});
        setFinalQuery(null);
        setPreviewData(null);
        setTableSearch('');
        setExpandedCategories({});
        setAppliedSelection(null);
        setNotice(null);
        openSeq.current++;
        dataSeq.current++;
        setDataLoading(false);
        tablesSourceId.current = source.id;
        fetchTables(source.id);
        setStep(2);
        setHighlightedTable(null);
    }

    function selectTable(table) {
        selectSourceAndTable(selectedSource, table);
    }

    function highlightTable(table) {
        setHighlightedTable(table);
    }

    // Steg 2: detaljpanelet viser dimensjonene til markert tabell.
    useEffect(() => {
        if (step === 2 && selectedSource && highlightedTable) {
            fetchTablePreviewDims(selectedSource.id, highlightedTable.tableId);
        }
    }, [step, selectedSource, highlightedTable]);

    // Tabeller som mangler i label-filen og bare har et internt navn i API-et
    // (f.eks. «INNVAND_INNVKAT»), får navn fra første setning i metadata-beskrivelsen.
    const labelsLoaded = Object.keys(tableLabels).length > 0;
    useEffect(() => {
        if (!labelsLoaded || !selectedSource) return;
        const candidates = (step === 2 ? tables : []).concat([selectedTable, highlightedTable].filter(Boolean));
        candidates.forEach(function(table) {
            if (isTableMapped(tableLabels, table) || hasReadableTitle(table)) return;
            if (requestedFallbacks.current[table.tableId]) return;
            requestedFallbacks.current[table.tableId] = true;
            fetch(API_BASE + '/' + selectedSource.id + '/Table/' + table.tableId + '/metadata')
                .then(function(r) { return r.ok ? r.json() : null; })
                .then(function(meta) {
                    const label = labelFromMetadata(meta);
                    if (label) setFallbackLabels(function(prev) { return Object.assign({}, prev, { [table.tableId]: label }); });
                })
                .catch(function() { /* beholder API-tittelen */ });
        });
    }, [labelsLoaded, step, tables, selectedSource, selectedTable, highlightedTable]);

    // Tabellisten tilhører kilden den ble hentet for. Kom brukeren til steg 3 via
    // søket i steg 1, er listen ikke hentet ennå, så hent den når steg 2 åpnes.
    const tablesSourceId = useRef(null);
    useEffect(() => {
        if (step === 2 && selectedSource && tablesSourceId.current !== selectedSource.id) {
            tablesSourceId.current = selectedSource.id;
            fetchTables(selectedSource.id);
        }
    }, [step, selectedSource]);

    // Lenke: når kildene og tabellene er hentet, gå til kilden/tabellen i URL-en med valgene derfra.
    useEffect(() => {
        if (urlReady || loading || sources.length === 0) return;
        const request = urlRequest.current;
        setUrlReady(true);
        const source = sources.find(function(s) { return s.id === request.sourceId; });
        if (!source) {
            setNotice('Kilden «' + request.sourceId + '» fra lenken finnes ikke i FHI-API-et.');
            return;
        }
        if (request.tableId == null) {
            selectSource(source);
            return;
        }
        const table = allTables.find(function(t) { return t.sourceId === source.id && String(t.tableId) === String(request.tableId); });
        if (!table) {
            selectSource(source);
            setNotice('Tabell ' + request.tableId + ' fra lenken finnes ikke lenger i ' + (source.title || source.name) +
                '. FHI gir ofte tabeller ny id når de får ny årgang eller struktur. Velg tabellen på nytt i listen.');
            return;
        }
        selectSourceAndTable(source, table, request);
    }, [urlReady, loading, sources, allTables, urlRevision]);

    // En ny lenke limt inn i samme fane (bare fragmentet endres) gjenopprettes på samme måte.
    useEffect(() => {
        function handleHashChange() {
            const hash = window.location.hash.replace(/^#/, '');
            if (hash === lastHash.current) return;
            lastHash.current = hash;
            urlRequest.current = decodeState(hash);
            if (!urlRequest.current.sourceId) { startOver(); return; }
            setUrlReady(false);
            setUrlRevision(function(n) { return n + 1; });
        }
        window.addEventListener('hashchange', handleHashChange);
        return function() { window.removeEventListener('hashchange', handleHashChange); };
    });

    // Skriv valgene til URL-en. Steg 4 bruker utvalget som ga dataene, steg 3 utvalget under arbeid.
    useEffect(() => {
        if (!urlReady) return;
        let hash = '';
        if (step >= 2 && selectedSource) {
            const onTable = step >= 3 && selectedTable;
            const selection = step === 4 ? appliedSelection : { config: queryConfig, wildcardDims: wildcardDims };
            hash = encodeState({
                sourceId: selectedSource.id,
                tableId: onTable ? selectedTable.tableId : null,
                step: step,
                view: dataView,
                format: responseFormat,
                maxRowCount: maxRowCount,
                dimensions: onTable && selection ? dimensions : [],
                queryConfig: selection ? selection.config : {},
                wildcardDims: selection ? selection.wildcardDims : {},
                chart: step === 4 ? chartState : null
            });
        }
        if (hash === lastHash.current) return;
        lastHash.current = hash;
        const url = window.location.pathname + window.location.search + (hash ? '#' + hash : '');
        window.history.replaceState(null, '', url);
    }, [urlReady, step, selectedSource, selectedTable, dimensions, queryConfig, wildcardDims, appliedSelection,
        dataView, responseFormat, maxRowCount, chartState]);

    function updateDimensionConfig(dimCode, updates) {
        setQueryConfig(function(prev) {
            const newConfig = Object.assign({}, prev);
            newConfig[dimCode] = Object.assign({}, prev[dimCode], updates);
            return newConfig;
        });
    }

    function resetAllDimensions() {
        setQueryConfig(defaultSelection(dimensions));
        setWildcardDims({});
        setWildcardDrafts({});
    }

    // Steg 3 «Vis data»: bygg spørringen fra utvalget og hent dataene på nytt.
    function buildFinalQuery() {
        const query = buildQuery(dimensions, queryConfig, responseFormat, maxRowCount);
        const unchanged = finalQuery && JSON.stringify(query) === JSON.stringify(finalQuery) && (previewData || dataLoading);
        setFinalQuery(query);
        setAppliedSelection({ config: queryConfig, wildcardDims: wildcardDims });
        setNotice(null);
        setStep(4);
        if (unchanged) return;
        setPreviewData(null);
        fetchData(query, selectedSource, selectedTable);
    }

    // Svarformatet gjelder bare spørringen som kopieres; dataene i appen hentes alltid som JSON-stat2.
    function changeResponseFormat(format) {
        setResponseFormat(format);
        setFinalQuery(function(prev) {
            return prev ? Object.assign({}, prev, { response: Object.assign({}, prev.response, { format: format }) }) : prev;
        });
    }

    function updateChartState(updates) {
        setChartState(function(prev) { return Object.assign({}, prev, updates); });
    }

    function copyLink() {
        copyToClipboard(window.location.href, 'link');
    }

    function startOver() {
        openSeq.current++;
        dataSeq.current++;
        setNotice(null);
        setError(null);
        setAppliedSelection(null);
        setLoading(false);
        setDataLoading(false);
        setStep(1);
        setSelectedSource(null);
        setSelectedTable(null);
        setDimensions([]);
        setQueryConfig({});
        setFinalQuery(null);
        setPreviewData(null);
        setHighlightedTable(null);
    }

    function copyToClipboard(text, key) {
        const done = function() {
            setCopiedKey(key || 'default');
            clearTimeout(copyTimer.current);
            copyTimer.current = setTimeout(function() { setCopiedKey(null); }, 2000);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, function() { setError('Kunne ikke kopiere til utklippstavlen'); });
        }
    }

    function downloadCsv() {
        if (!previewData) {
            setPendingCsv(true);
            fetchPreview();
            return;
        }
        const csvContent = previewToCsv(previewData, findMetricDimension);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.setAttribute('href', URL.createObjectURL(blob));
        link.setAttribute('download', csvFileName(selectedSource && selectedSource.id, selectedTable && selectedTable.tableId));
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function closeMetadataModal() {
        closeMetadataModalImpl(setShowMetadataModal);
    }

    const boundGetTableLabel = (table) => isTableMapped(tableLabels, table)
        ? getTableLabel(tableLabels, table)
        : fallbackTableLabel(table, fallbackLabels);
    const getGeoLevels = (table, sourceId) => {
        const levels = table && tableGeoLevels[(sourceId || table.sourceId) + '/' + table.tableId];
        return Array.isArray(levels) ? levels : null;
    };
    const isUnmapped = (table) => labelsLoaded && !isTableMapped(tableLabels, table);
    const boundGetTableCategory = (table) => getTableCategory(tableLabels, table);
    const boundGeneratePowerQueryCode = () => generatePowerQueryCode(
        finalQuery, API_BASE, selectedSource && selectedSource.id, selectedTable && selectedTable.tableId
    );

    const rows = expectedRows(dimensions, queryConfig);
    const filteredCount = dimensions.filter(function(dim) { return isFiltered(dim, queryConfig[dim.code]); }).length;
    const selectionChanged = Boolean(appliedSelection) && (
        JSON.stringify(appliedSelection.config) !== JSON.stringify(queryConfig) ||
        JSON.stringify(appliedSelection.wildcardDims || {}) !== JSON.stringify(wildcardDims));
    const dataFileBase = csvFileName(selectedSource && selectedSource.id, selectedTable && selectedTable.tableId).replace(/\.csv$/, '');

    // Alt stegkomponentene trenger, samlet ett sted.
    const ctx = {
        API_BASE, step, setStep, loading, dataLoading, error,
        sources, allTables, tables, selectedSource, selectedTable, highlightedTable,
        dimensions, queryConfig, finalQuery, previewData, responseFormat, maxRowCount,
        globalSearch, tableSearch, outputFormat, geoSearch, expandedCounties, expandedMunicipalities,
        expandedCategories, firstSentence, geoMappingUrl, copiedKey, publisherFilter, tableSort,
        tablePreviewDims, valueSearch, wildcardDims, wildcardDrafts, showAdvanced, pendingCsv, rows, filteredCount, effectiveTheme,
        dataView, chartState, tableMode, pivotCol, appliedSelection, selectionChanged, notice, dataFileBase,
        globalSearchRef,
        selectSource, selectSourceAndTable, selectTable, highlightTable, updateDimensionConfig, resetAllDimensions,
        buildFinalQuery, fetchPreview, fetchMetadata, copyToClipboard, copyLink, downloadCsv, startOver,
        setGlobalSearch, setTableSearch, setOutputFormat, setGeoSearch, setExpandedCounties, setExpandedMunicipalities,
        setExpandedCategories, setResponseFormat: changeResponseFormat, setMaxRowCount, setPublisherFilter, setTableSort,
        setValueSearch, setWildcardDims, setWildcardDrafts, setShowAdvanced,
        setDataView, updateChartState, setTableMode, setPivotCol, setNotice,
        getTableLabel: boundGetTableLabel, getTableCategory: boundGetTableCategory, isUnmapped, getGeoLevels,
        generatePowerQueryCode: boundGeneratePowerQueryCode, getGeographyGroups, findMetricDimension
    };

    // I steg 2 kan en annen tabell være markert enn den som er åpnet; da går «Gå til» Utvalg til den markerte.
    const highlightDiffers = step === 2 && Boolean(highlightedTable) &&
        (!selectedTable || String(highlightedTable.tableId) !== String(selectedTable.tableId));

    const stepItems = [
        {
            num: 1, title: 'Kilde',
            summary: step === 1
                ? 'Velg et register eller søk etter tabell'
                : selectedSource && [selectedSource.title || selectedSource.name, h('code', { key: 'c', className: 'code-inline' }, selectedSource.id)],
            available: true,
            onSelect: function() { setStep(1); }
        },
        {
            num: 2, title: 'Tabell',
            summary: step === 2
                ? (highlightedTable ? boundGetTableLabel(highlightedTable) : 'Velg en tabell fra listen')
                : selectedTable && [boundGetTableLabel(selectedTable), h('code', { key: 'c', className: 'code-inline' }, selectedTable.tableId)],
            available: Boolean(selectedSource),
            onSelect: function() { if (selectedSource) setStep(2); }
        },
        {
            num: 3, title: 'Utvalg',
            summary: dimensions.length
                ? formatNumber(rows.total) + ' verdier · ' + filteredCount + ' av ' + dimensions.length + ' dimensjoner avgrenset'
                : (selectedTable ? 'Laster dimensjoner …' : 'Velg verdier i hver dimensjon'),
            available: Boolean(selectedTable) || highlightDiffers,
            onSelect: function() {
                if (highlightDiffers) selectTable(highlightedTable);
                else if (selectedTable) setStep(3);
            }
        },
        {
            num: 4, title: 'Data',
            summary: step === 4 && dataLoading ? 'Henter data …' : (finalQuery ? VIEW_LABELS[dataView] : 'Figur, tabell og spørring'),
            available: Boolean(finalQuery) && !highlightDiffers,
            onSelect: function() {
                if (!finalQuery || highlightDiffers) return;
                setStep(4);
                if (!previewData && !dataLoading) fetchPreview();
            }
        }
    ];

    let main = null;
    let actions = null;
    let tip = null;
    if (step === 1) {
        main = renderSourceStep(ctx);
        actions = renderSourceActions(ctx);
        tip = 'Vet du hva tabellen heter? Søk på tvers av alle kilder og hopp rett til utvalget.';
    } else if (step === 2) {
        main = renderTableStep(ctx);
        actions = renderTableActions(ctx);
    } else if (step === 3) {
        main = renderVariablesStep(ctx);
        actions = renderVariablesActions(ctx);
    } else if (step === 4) {
        main = renderDataStep(ctx);
        actions = renderDataActions(ctx);
    }

    return h('div', { className: 'app' },
        h('a', { href: '#main-content', className: 'skip-link' }, 'Gå til hovedinnhold'),
        renderMetadataModal(showMetadataModal, tableMetadata, closeMetadataModal),
        h(Header, { theme: effectiveTheme, onToggleTheme: toggleTheme }),
        h('div', { className: 'app-body' },
            h(Sidebar, { step: step, items: stepItems, tip: tip, actions: actions }),
            h('main', { id: 'main-content', ref: mainRef, tabIndex: -1, className: 'content content-step' + step, 'aria-label': 'Hovedinnhold' },
                h(StepDots, { step: step, items: stepItems }),
                step !== 4 && notice && h(Alert, { tone: 'warning' }, notice),
                main,
                h(Credits, { className: 'mobile-only', showLinks: true })
            )
        ),
        h('div', { className: 'toast', role: 'status', 'aria-live': 'polite' },
            copiedKey ? h('span', { className: 'toast-inner' }, Icon.check(14), copiedKey === 'link' ? 'Lenken er kopiert' : 'Kopiert til utklippstavlen') : null
        )
    );
}

function mount() {
    ReactDOM.createRoot(document.getElementById('root')).render(h(FHIQueryBuilder));
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
} else {
    mount();
}
