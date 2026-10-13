// «Om verktøyet» (#om). Teksten ligger i om.html, så den kan redigeres uten å røre koden.
// Bare enkle tagger slipper gjennom; kildelisten hentes fra FHI-API-et og settes inn der <div data-kilder> står.
import { parseHtmlToTree, decodeEntities, safeHref } from '../lib/html.mjs';
import { LINKS } from './Layout.mjs';
import { Button, StepHeading, GeoLevels, Icon } from './ui.mjs';

const { useState, useEffect, createElement: h } = React;
const BLOCK_PARENTS = ['root', 'ul', 'ol'];

let textPromise = null;
function loadText() {
    if (!textPromise) {
        textPromise = fetch('./om.html').then(function(r) {
            if (!r.ok) throw new Error('status ' + r.status);
            return r.text();
        }).catch(function(err) {
            textPromise = null;
            throw err;
        });
    }
    return textPromise;
}

function external(href, children) {
    return h('a', { href: href, target: '_blank', rel: 'noopener noreferrer', className: 'external-link' },
        children, Icon.external(12), h('span', { className: 'sr-only' }, ' (åpnes i ny fane)'));
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

// Gjør treet fra parseHtmlToTree om til React-elementer, med bare tillatte tagger.
function renderNodes(nodes, ctx, parent) {
    return nodes.map(function(node, i) {
        if (typeof node === 'string') {
            // Mellomrom mellom listepunkter og avsnitt er ikke innhold.
            if (BLOCK_PARENTS.indexOf(parent) !== -1 && !node.trim()) return null;
            return decodeEntities(node);
        }
        const attrs = node.attrs || {};
        const children = function() { return renderNodes(node.children, ctx, node.tag); };
        switch (node.tag) {
            case 'h2': return h('h2', { key: i, className: 'about-title' }, children());
            case 'h3': return h('h3', { key: i, className: 'about-subtitle' }, children());
            case 'p': return h('p', { key: i, className: attrs.class === 'ingress' ? 'about-lead' : 'about-text' }, children());
            case 'ul': return h('ul', { key: i, className: 'about-list' }, children());
            case 'ol': return h('ol', { key: i, className: 'about-steps' }, children());
            case 'li': return h('li', { key: i }, children());
            case 'strong': case 'b': return h('strong', { key: i }, children());
            case 'em': case 'i': return h('em', { key: i }, children());
            case 'br': return h('br', { key: i });
            case 'a': {
                const href = safeHref(attrs.href);
                if (!href) return h(React.Fragment, { key: i }, children());
                return /^https?:/i.test(href)
                    ? h(React.Fragment, { key: i }, external(href, children()))
                    : h('a', { key: i, href: href }, children());
            }
            case 'span':
                return 'data-geonivaer' in attrs
                    ? h(GeoLevels, { key: i, levels: ['N', 'F', 'K', 'B', 'LKS'] })
                    : h(React.Fragment, { key: i }, children());
            case 'div':
                return 'data-kilder' in attrs
                    ? h(React.Fragment, { key: i }, renderSources(ctx))
                    : h(React.Fragment, { key: i }, children());
            default:
                // Ukjente tagger: behold teksten, dropp taggen.
                return h(React.Fragment, { key: i }, children());
        }
    });
}

function AboutPage(props) {
    const ctx = props.ctx;
    const [text, setText] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(function() {
        let active = true;
        loadText().then(
            function(t) { if (active) setText(t); },
            function() { if (active) setFailed(true); }
        );
        return function() { active = false; };
    }, []);

    let body;
    if (failed) {
        body = h('p', { className: 'about-text' }, 'Kunne ikke laste teksten. Les om verktøyet i ', external(LINKS.readme, 'README på GitHub'), '.');
    } else if (text === null) {
        body = h('p', { className: 'side-text' }, 'Laster …');
    } else {
        body = renderNodes(parseHtmlToTree(text.replace(/<!--[\s\S]*?-->/g, '')), ctx, 'root');
    }

    return h('div', { className: 'about-page' },
        h(StepHeading, {
            eyebrow: 'OM VERKTØYET',
            title: 'Om Helsestatistikk',
            actions: [h(Button, { key: 'tilbake', size: 'sm', onClick: ctx.closeAbout }, 'Tilbake til verktøyet')]
        }),
        body
    );
}

export function renderAboutPage(ctx) {
    return h(AboutPage, { ctx: ctx });
}
