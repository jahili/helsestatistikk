// «Om verktøyet» (#om): hva Helsestatistikk er, hvordan det brukes, hva man bør vite om tallene, og kildene.
// Kildelisten hentes fra FHI-API-et, så den holder seg oppdatert.
import { LINKS } from './Layout.mjs';
import { Button, StepHeading, GeoLevels, Icon } from './ui.mjs';

const h = React.createElement;

function external(href, text) {
    return h('a', { href: href, target: '_blank', rel: 'noopener noreferrer', className: 'external-link' },
        text, Icon.external(12), h('span', { className: 'sr-only' }, ' (åpnes i ny fane)'));
}

function section(id, title, children) {
    return h('section', { className: 'about-section', 'aria-labelledby': id },
        h('h2', { id: id, className: 'about-title' }, title),
        children);
}

function renderSources(ctx) {
    if (!ctx.sources.length) return h('p', { className: 'side-text' }, 'Laster kildene fra FHI …');
    const counts = {};
    ctx.allTables.forEach(function(t) { counts[t.sourceId] = (counts[t.sourceId] || 0) + 1; });
    return h('ul', { className: 'about-sources' },
        ctx.sources.map(function(source) {
            return h('li', { key: source.id, className: 'about-source' },
                h('div', { className: 'about-source-head' },
                    h('h3', { className: 'about-source-title' }, source.title || source.name),
                    counts[source.id] && h('span', { className: 'about-source-count' }, counts[source.id] + ' tabeller')
                ),
                source.description && h('p', { className: 'about-source-text' }, source.description),
                h('p', { className: 'about-source-meta' },
                    source.publishedBy ? 'Publisert av ' + source.publishedBy : null,
                    source.publishedBy && source.aboutUrl ? ' · ' : null,
                    source.aboutUrl && external(source.aboutUrl, 'Les mer'))
            );
        })
    );
}

export function renderAboutPage(ctx) {
    return h('div', { className: 'about-page' },
        h(StepHeading, {
            eyebrow: 'OM VERKTØYET',
            title: 'Om Helsestatistikk',
            subtitle: 'Finn, se og last ned folkehelsestatistikk fra norske helseregistre.',
            actions: [h(Button, { key: 'tilbake', size: 'sm', onClick: ctx.closeAbout }, 'Tilbake til verktøyet')]
        }),
        h('p', { className: 'about-lead' },
            'Helsestatistikk henter tallene direkte fra Folkehelseinstituttets åpne statistikkløsning, så du ser alltid ',
            'det som sist er publisert. Du kan vise tallene som figur eller tabell, laste dem ned og dele en lenke til akkurat ',
            'den visningen du har laget.'),

        section('om-bruk', 'Slik bruker du det', h('ol', { className: 'about-steps' },
            h('li', null, h('strong', null, 'Velg kilde. '), 'Et register eller en statistikk, for eksempel Dødsårsaksregisteret eller Folkehelsestatistikk. Du kan også søke etter en tabell på tvers av alle kildene.'),
            h('li', null, h('strong', null, 'Velg tabell. '), 'Merkene viser hvilke geografiske nivåer tabellen har tall for: ',
                h(GeoLevels, { levels: ['N', 'F', 'K', 'B', 'LKS'] }), ' står for hele landet, fylker, kommuner, bydeler og levekårssoner.'),
            h('li', null, h('strong', null, 'Velg utvalg. '), 'Hvilke år, steder og grupper du vil se. Appen foreslår et utvalg som gir en oversiktlig figur, og du kan velge flere eller færre.'),
            h('li', null, h('strong', null, 'Se dataene. '), 'Som figur eller tabell. Last ned tallene som CSV (for Excel), figuren som bilde, eller kopier en lenke som åpner nøyaktig samme visning.')
        ), h('p', { className: 'about-text' },
            'Vil du hente tallene automatisk, for eksempel i Power BI eller Excel, finner du ferdige spørringer under «API og Power BI» i siste steg.')),

        section('om-tall', 'Dette bør du vite om tallene', h('ul', { className: 'about-list' },
            h('li', null, 'Tallene er publisert av Folkehelseinstituttet (FHI), og for Folkehelsestatistikk av Helsedirektoratet. Helsestatistikk viser dem slik de er publisert, uten å endre dem.'),
            h('li', null, 'Når det er få tilfeller, skjules noen tall for å beskytte personvernet. De vises med et symbol, for eksempel «:», og ikke som 0. Forklaringen står under figuren og tabellen.'),
            h('li', null, 'FHI oppdaterer statistikken løpende. Når en tabell får ny årgang eller ny inndeling, kan den få nytt tabellnummer. En gammel lenke viser da en melding om at tabellen ikke finnes lenger.'),
            h('li', null, 'Geografien følger inndelingen tabellen er laget for. Etter kommune- og fylkessammenslåinger kan eldre tall ligge under tidligere navn, merket med årene de gjaldt, for eksempel «Østfold (2008–2019)».'),
            h('li', null, 'Tallene kan brukes fritt under ', external('https://data.norge.no/nlod/no/1.0', 'Norsk lisens for offentlige data (NLOD)'),
                '. Oppgi kilden, for eksempel «Kilde: Folkehelseinstituttet».')
        )),

        section('om-kilder', 'Kildene', h(React.Fragment, null,
            h('p', { className: 'about-text' }, 'Helsestatistikk har tabeller fra disse registrene og statistikkene:'),
            renderSources(ctx))),

        section('om-verktoy', 'Om verktøyet', h(React.Fragment, null,
            h('p', { className: 'about-text' },
                'Helsestatistikk er et privat prosjekt laget av Jan Hiroshi Lintvedt. Det er ikke laget av eller tilknyttet Folkehelseinstituttet. ',
                'Har du spørsmål eller finner du feil, send en e-post til ', h('a', { href: 'mailto:jhl@plotikon.com' }, 'jhl@plotikon.com'),
                ' eller meld fra på ', external(LINKS.github + '/issues', 'GitHub'), '.'),
            h('p', { className: 'about-text' },
                'Teknisk dokumentasjon finner du i ', external(LINKS.readme, 'README på GitHub'),
                ', og FHIs egen beskrivelse av API-et i ', external(LINKS.apiDocs, 'API-dokumentasjonen'), '.')
        ))
    );
}
