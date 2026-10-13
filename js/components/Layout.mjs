import { Icon, Logo } from './ui.mjs';
import { StepList, StepDots } from './StepList.mjs';

const h = React.createElement;

export const LINKS = {
    readme: 'https://github.com/jahili/helsestatistikk#readme',
    apiDocs: 'https://github.com/folkehelseinstituttet/Fhi.Statistikk.OpenAPI',
    github: 'https://github.com/jahili/helsestatistikk'
};

// Lenker ut av appen åpnes i ny fane og får en pil, så det er tydelig at de går til et annet nettsted.
function externalLink(href, text, className) {
    return h('a', { href: href, className: (className ? className + ' ' : '') + 'external-link', target: '_blank', rel: 'noopener noreferrer' },
        text, Icon.external(12), h('span', { className: 'sr-only' }, ' (åpnes i ny fane)'));
}

// «Om verktøyet» er en side i appen (#om).
function aboutLink(onAbout, className) {
    return h('a', {
        href: '#om',
        className: className,
        onClick: function(e) { if (onAbout) { e.preventDefault(); onAbout(); } }
    }, 'Om verktøyet');
}

export function Header(props) {
    const isDark = props.theme === 'dark';
    return h('header', { className: 'app-header' },
        h('div', { className: 'brand' },
            h(Logo),
            h('div', { className: 'brand-text' },
                h('span', { className: 'brand-title' }, 'Helsestatistikk'),
                h('span', { className: 'brand-subtitle' }, 'Statistikk fra FHI som figur, tabell og API-spørring')
            )
        ),
        h('nav', { className: 'header-nav', 'aria-label': 'Lenker' },
            aboutLink(props.onAbout, 'header-link'),
            externalLink(LINKS.apiDocs, 'API-dokumentasjon', 'header-link header-link-secondary'),
            externalLink(LINKS.github, 'GitHub', 'header-link'),
            h('button', {
                type: 'button',
                className: 'theme-btn',
                onClick: props.onToggleTheme,
                'aria-label': isDark ? 'Bytt til lyst tema' : 'Bytt til mørkt tema',
                title: isDark ? 'Lyst tema' : 'Mørkt tema'
            }, isDark ? Icon.sun(18) : Icon.moon(18))
        )
    );
}

export function Credits(props) {
    const text = h('p', { className: 'credits' + (props.className && !props.showLinks ? ' ' + props.className : '') },
        'Data fra ', externalLink('https://statistikk-data.fhi.no', 'FHI Statistikk'),
        ' · Laget av Jan Hiroshi Lintvedt',
        ' · ', h('a', { href: 'mailto:jhl@plotikon.com' }, 'jhl@plotikon.com')
    );
    if (!props.showLinks) return text;
    // På smale skjermer er header-lenkene skjult, så de vises her i stedet.
    return h('footer', { className: 'mobile-footer ' + (props.className || '') },
        h('nav', { className: 'mobile-footer-links', 'aria-label': 'Lenker' },
            aboutLink(props.onAbout),
            externalLink(LINKS.apiDocs, 'API-dokumentasjon'),
            externalLink(LINKS.github, 'GitHub')
        ),
        text
    );
}

// Sidekolonnen «Ditt utvalg»: stegliste, valgfritt tips og sticky handlingsfelt.
export function Sidebar(props) {
    return h('aside', { className: 'sidebar', 'aria-labelledby': 'sidebar-heading' },
        h('div', { className: 'sidebar-body' },
            h('h2', { id: 'sidebar-heading', className: 'section-label sidebar-heading' }, 'Ditt utvalg'),
            h(StepList, { step: props.step, items: props.items }),
            props.tip && h('div', { className: 'sidebar-tip' },
                h('span', { className: 'sidebar-tip-title' }, 'Tips'),
                h('span', null, props.tip)
            )
        ),
        h('div', { className: 'sidebar-actions' },
            props.actions,
            h(Credits, { className: 'desktop-only' })
        )
    );
}

export { StepDots };
