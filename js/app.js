import { parseTableLabelsCSV } from './lib/csv.mjs';
import { getTableLabel, getTableCategory, flattenCategories } from './lib/tableLabels.mjs';
import { getGeographyGroups } from './lib/geo.mjs';
import { findMetricDimension, buildQuery } from './lib/query.mjs';
import { generatePowerQueryCode } from './lib/powerquery.mjs';
import { expectedRows, isFiltered } from './lib/selection.mjs';
import { formatNumber } from './lib/format.mjs';
import { previewToCsv, csvFileName } from './lib/preview.mjs';
import { Header, Sidebar, StepDots, Credits } from './components/Layout.mjs';
import { Icon } from './components/ui.mjs';
import { renderSourceStep, renderSourceActions } from './components/SourceSelection.mjs';
import { renderTableStep, renderTableActions } from './components/TableSelection.mjs';
import { renderVariablesStep, renderVariablesActions } from './components/DimensionConfiguration.mjs';
import { renderQueryStep, renderQueryActions } from './components/QueryResult.mjs';
import { renderMetadataModal, closeMetadataModal as closeMetadataModalImpl } from './components/MetadataModal.mjs';

const { useState, useEffect, useRef, createElement: h } = React;
const API_BASE = 'https://statistikk-data.fhi.no/api/open/v1';
const FORMAT_LABELS = { 'json-stat2': 'JSON-stat2', 'csv2': 'CSV · navn', 'csv3': 'CSV · koder' };

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
    const [expandedCategories, setExpandedCategories] = useState({});
    const [geoMappingUrl] = useState('https://raw.githubusercontent.com/janhli/FHI-API-Query-Builder/main/geo_mapping.csv');

    // Rene visningsvalg for det nye grensesnittet. Påvirker ikke spørringen.
    const [theme, setTheme] = useState(readStoredTheme);
    const [copiedKey, setCopiedKey] = useState(null);
    const [publisherFilter, setPublisherFilter] = useState('all');
    const [tableSort, setTableSort] = useState('theme');
    const [highlightedTable, setHighlightedTable] = useState(null);
    const [tablePreviewDims, setTablePreviewDims] = useState({});
    const [valueSearch, setValueSearch] = useState({});
    const [wildcardDims, setWildcardDims] = useState({});
    const [wildcardDrafts, setWildcardDrafts] = useState({});
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [pendingCsv, setPendingCsv] = useState(false);
    const globalSearchRef = useRef(null);
    const mainRef = useRef(null);
    const copyTimer = useRef(null);

    useEffect(() => {
        fetchSources();
        fetchTableLabels();
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
        let sentence = '';
        if (tableMetadata && tableMetadata.paragraphs && Array.isArray(tableMetadata.paragraphs)) {
            for (let i = 0; i < tableMetadata.paragraphs.length; i++) {
                if (tableMetadata.paragraphs[i].header !== 'Geografi') {
                    let text = tableMetadata.paragraphs[i].content;
                    if (typeof text === 'string') {
                        const match = text.match(/^[^!?]*?\.(?=\s[A-Z]|$)|^[^!?]*?[!?]/);
                        if (match) {
                            sentence = match[0]
                                .replace(/<\/(p|div|li|h[1-6]|br)\s*>/gi, ' ')
                                .replace(/<[^>]*>/g, '')
                                .replace(/\s+/g, ' ')
                                .trim();
                            break;
                        }
                    }
                }
            }
        }
        setFirstSentence(sentence);
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

    async function fetchDimensions(sourceId, tableId) {
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

            setDimensions(dimensionsArray);

            const initialConfig = {};
            dimensionsArray.forEach(function(dim) {
                initialConfig[dim.code] = { filter: 'all', values: ['*'], selectedCategories: [] };
            });
            setQueryConfig(initialConfig);
        } catch (err) {
            setError(err.message);
            setDimensions([]);
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
            dims = dims.map(function(dim) {
                const category = dim.category || (dim.categories ? flattenCategories(dim.categories) : null);
                return { code: dim.code, label: dim.label, count: category && category.index ? category.index.length : 0 };
            });
            setTablePreviewDims(function(prev) { return Object.assign({}, prev, { [key]: { status: 'ok', dims: dims } }); });
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

    async function fetchPreview() {
        if (!finalQuery) return;
        setLoading(true);
        setError(null);
        try {
            const previewQuery = JSON.parse(JSON.stringify(finalQuery));
            previewQuery.response.format = 'json-stat2';

            const response = await fetch(
                API_BASE + '/' + selectedSource.id + '/Table/' + selectedTable.tableId + '/data',
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
            setPreviewData(data);
        } catch (err) {
            setError(err.message || 'Feil ved henting av preview');
        } finally {
            setLoading(false);
        }
    }

    function selectSourceAndTable(source, table) {
        setSelectedSource(source);
        setSelectedTable(table);
        setDimensions([]);
        setQueryConfig({});
        setFinalQuery(null);
        setPreviewData(null);
        setTableSearch('');
        setGlobalSearch('');
        setShowMetadataModal(false);
        fetchDimensions(source.id, table.tableId);
        fetchMetadata(source.id, table.tableId);
        setStep(3);
        // Visningsvalg som hører til forrige tabell
        setHighlightedTable(table);
        setValueSearch({});
        setWildcardDims({});
        setWildcardDrafts({});
        setGeoSearch('');
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

    // Tabellisten tilhører kilden den ble hentet for. Kom brukeren til steg 3 via
    // søket i steg 1, er listen ikke hentet ennå, så hent den når steg 2 åpnes.
    const tablesSourceId = useRef(null);
    useEffect(() => {
        if (step === 2 && selectedSource && tablesSourceId.current !== selectedSource.id) {
            tablesSourceId.current = selectedSource.id;
            fetchTables(selectedSource.id);
        }
    }, [step, selectedSource]);

    function updateDimensionConfig(dimCode, updates) {
        setQueryConfig(function(prev) {
            const newConfig = Object.assign({}, prev);
            newConfig[dimCode] = Object.assign({}, prev[dimCode], updates);
            return newConfig;
        });
    }

    function resetAllDimensions() {
        dimensions.forEach(function(dim) {
            updateDimensionConfig(dim.code, { filter: 'all', values: ['*'], selectedCategories: [] });
        });
        setWildcardDims({});
        setWildcardDrafts({});
    }

    function buildFinalQuery() {
        setFinalQuery(buildQuery(dimensions, queryConfig, responseFormat, maxRowCount));
        setStep(4);
    }

    function startOver() {
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

    const boundGetTableLabel = (table) => getTableLabel(tableLabels, table);
    const boundGetTableCategory = (table) => getTableCategory(tableLabels, table);
    const boundGeneratePowerQueryCode = () => generatePowerQueryCode(
        finalQuery, API_BASE, selectedSource && selectedSource.id, selectedTable && selectedTable.tableId
    );

    const rows = expectedRows(dimensions, queryConfig);
    const filteredCount = dimensions.filter(function(dim) { return isFiltered(dim, queryConfig[dim.code]); }).length;

    // Alt stegkomponentene trenger, samlet ett sted.
    const ctx = {
        API_BASE, step, setStep, loading, error,
        sources, allTables, tables, selectedSource, selectedTable, highlightedTable,
        dimensions, queryConfig, finalQuery, previewData, responseFormat, maxRowCount,
        globalSearch, tableSearch, outputFormat, geoSearch, expandedCounties, expandedMunicipalities,
        expandedCategories, firstSentence, geoMappingUrl, copiedKey, publisherFilter, tableSort,
        tablePreviewDims, valueSearch, wildcardDims, wildcardDrafts, showAdvanced, pendingCsv, rows, filteredCount,
        globalSearchRef,
        selectSource, selectSourceAndTable, selectTable, highlightTable, updateDimensionConfig, resetAllDimensions,
        buildFinalQuery, fetchPreview, fetchMetadata, copyToClipboard, downloadCsv, startOver,
        setGlobalSearch, setTableSearch, setOutputFormat, setGeoSearch, setExpandedCounties, setExpandedMunicipalities,
        setExpandedCategories, setResponseFormat, setMaxRowCount, setPublisherFilter, setTableSort,
        setValueSearch, setWildcardDims, setWildcardDrafts, setShowAdvanced,
        getTableLabel: boundGetTableLabel, getTableCategory: boundGetTableCategory,
        generatePowerQueryCode: boundGeneratePowerQueryCode, getGeographyGroups, findMetricDimension
    };

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
            num: 3, title: 'Variabler',
            summary: step === 3
                ? (dimensions.length ? filteredCount + ' av ' + dimensions.length + ' dimensjoner filtrert' : 'Laster dimensjoner …')
                : finalQuery && formatNumber(rows.total) + ' rader · ' + FORMAT_LABELS[finalQuery.response.format],
            available: Boolean(selectedTable),
            onSelect: function() { if (selectedTable) setStep(3); }
        },
        {
            num: 4, title: 'Spørring',
            summary: 'Klar til bruk',
            available: Boolean(finalQuery),
            onSelect: function() { if (finalQuery) setStep(4); }
        }
    ];

    let main = null;
    let actions = null;
    let tip = null;
    if (step === 1) {
        main = renderSourceStep(ctx);
        actions = renderSourceActions(ctx);
        tip = 'Vet du hva tabellen heter? Søk på tvers av alle kilder og hopp rett til steg 03.';
    } else if (step === 2) {
        main = renderTableStep(ctx);
        actions = renderTableActions(ctx);
    } else if (step === 3) {
        main = renderVariablesStep(ctx);
        actions = renderVariablesActions(ctx);
    } else if (step === 4) {
        main = renderQueryStep(ctx);
        actions = renderQueryActions(ctx);
    }

    return h('div', { className: 'app' },
        h('a', { href: '#main-content', className: 'skip-link' }, 'Gå til hovedinnhold'),
        renderMetadataModal(showMetadataModal, tableMetadata, closeMetadataModal),
        h(Header, { theme: effectiveTheme, onToggleTheme: toggleTheme }),
        h('div', { className: 'app-body' },
            h(Sidebar, { step: step, items: stepItems, tip: tip, actions: actions }),
            h('main', { id: 'main-content', ref: mainRef, tabIndex: -1, className: 'content content-step' + step, 'aria-label': 'Hovedinnhold' },
                h(StepDots, { step: step, items: stepItems }),
                main,
                h(Credits, { className: 'mobile-only', showLinks: true })
            )
        ),
        h('div', { className: 'toast', role: 'status', 'aria-live': 'polite' },
            copiedKey ? h('span', { className: 'toast-inner' }, Icon.check(14), 'Kopiert til utklippstavlen') : null
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
