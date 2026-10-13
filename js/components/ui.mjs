// Basiskomponenter for designspråk A. Rene presentasjonsfunksjoner uten egen state.
import { GEO_LEVEL_NAMES } from '../lib/geo.mjs';

const h = React.createElement;

function cx() {
    return Array.prototype.filter.call(arguments, Boolean).join(' ');
}

function svg(size, children, extra) {
    return h('svg', Object.assign({
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': 'true', focusable: 'false'
    }, extra || {}), children);
}

export const Icon = {
    search: (size) => svg(size || 18, [h('circle', { key: 1, cx: 11, cy: 11, r: 7 }), h('path', { key: 2, d: 'M20 20l-4-4' })]),
    arrowRight: (size) => svg(size || 16, h('path', { d: 'M5 12h14M13 6l6 6-6 6' }), { strokeWidth: 2.4 }),
    check: (size) => svg(size || 14, h('path', { d: 'M5 12l5 5 9-10' }), { strokeWidth: 3 }),
    chevronDown: (size) => svg(size || 14, h('path', { d: 'M6 9l6 6 6-6' }), { strokeWidth: 2.4 }),
    chevronRight: (size) => svg(size || 14, h('path', { d: 'M9 6l6 6-6 6' }), { strokeWidth: 2.4 }),
    close: (size) => svg(size || 11, h('path', { d: 'M6 6l12 12M18 6L6 18' }), { strokeWidth: 3 }),
    copy: (size) => svg(size || 16, [
        h('rect', { key: 1, x: 8, y: 8, width: 12, height: 12, rx: 2 }),
        h('path', { key: 2, d: 'M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2' })
    ]),
    download: (size) => svg(size || 18, h('path', { d: 'M12 4v12M6 11l6 6 6-6M5 20h14' }), { strokeWidth: 2.2 }),
    table: (size) => svg(size || 28, [
        h('rect', { key: 1, x: 3, y: 4, width: 18, height: 16, rx: 2 }),
        h('path', { key: 2, d: 'M3 10h18M9 10v10M15 10v10' })
    ], { strokeWidth: 1.8 }),
    moon: (size) => svg(size || 18, h('path', { d: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z' })),
    sun: (size) => svg(size || 18, [
        h('circle', { key: 1, cx: 12, cy: 12, r: 4 }),
        h('path', { key: 2, d: 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' })
    ]),
    info: (size) => svg(size || 16, [
        h('circle', { key: 1, cx: 12, cy: 12, r: 9 }),
        h('path', { key: 2, d: 'M12 11v5M12 8h.01' })
    ]),
    external: (size) => svg(size || 12, h('path', { d: 'M7 17L17 7M9 7h8v8' })),
    warning: (size) => svg(size || 16, [
        h('path', { key: 1, d: 'M12 3l10 18H2L12 3z' }),
        h('path', { key: 2, d: 'M12 10v5M12 18h.01' })
    ]),
    link: (size) => svg(size || 16, [
        h('path', { key: 1, d: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1' }),
        h('path', { key: 2, d: 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1' })
    ]),
    chart: (size) => svg(size || 16, h('path', { d: 'M4 4v16h16M8 15l4-4 3 3 5-6' })),
    code: (size) => svg(size || 16, h('path', { d: 'M9 7l-5 5 5 5M15 7l5 5-5 5' })),
    sliders: (size) => svg(size || 16, h('path', { d: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M6 15v4' }))
};

export function Logo() {
    return h('svg', {
        className: 'logo', width: 30, height: 30, viewBox: '0 0 30 30', fill: 'none',
        stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true'
    },
        h('path', { d: 'M10 5 C6 5 6 9 6 11 C6 13 4 15 3 15 C4 15 6 17 6 19 C6 21 6 25 10 25' }),
        h('path', { d: 'M20 5 C24 5 24 9 24 11 C24 13 26 15 27 15 C26 15 24 17 24 19 C24 21 24 25 20 25' }),
        h('path', { d: 'M12 19 V14 M15 19 V11 M18 19 V16', strokeOpacity: 0.55 })
    );
}

// variant: primary | secondary | outline | ghost | link
export function Button(props) {
    const variant = props.variant || 'secondary';
    return h('button', {
        type: props.type || 'button',
        className: cx('btn', 'btn-' + variant, props.size && 'btn-' + props.size, props.block && 'btn-block', props.className),
        onClick: props.onClick,
        disabled: props.disabled,
        title: props.title,
        'aria-label': props.ariaLabel,
        'aria-describedby': props.ariaDescribedBy,
        'aria-expanded': props.ariaExpanded
    }, props.icon, props.children, props.trailingIcon);
}

// Segmentkontroll med aria-pressed. options: [{ value, label }]
export function Segment(props) {
    return h('div', {
        className: cx('segment', props.size && 'segment-' + props.size, props.className),
        role: 'group',
        'aria-label': props.label,
        style: { gridTemplateColumns: 'repeat(' + props.options.length + ', minmax(0, 1fr))' }
    },
        props.options.map(function(opt) {
            const pressed = opt.value === props.value;
            return h('button', {
                key: opt.value,
                type: 'button',
                className: 'segment-btn',
                'aria-pressed': pressed ? 'true' : 'false',
                onClick: function() { if (!pressed) props.onChange(opt.value); }
            }, opt.label);
        })
    );
}

// variant: neutral (grå, statisk) | selected (fylt, med ×) | filter (av/på-knapp)
export function Chip(props) {
    const variant = props.variant || 'neutral';
    if (variant === 'filter') {
        return h('button', {
            type: 'button',
            className: 'chip chip-filter',
            'aria-pressed': props.pressed ? 'true' : 'false',
            onClick: props.onClick
        }, props.children);
    }
    return h('span', { className: cx('chip', 'chip-' + variant) },
        h('span', { className: 'chip-label' }, props.children),
        props.onRemove && h('button', {
            type: 'button',
            className: 'chip-remove',
            'aria-label': props.removeLabel || 'Fjern',
            onClick: props.onRemove
        }, Icon.close())
    );
}

export function Badge(props) {
    return h('span', {
        className: cx('badge', props.selected && 'badge-selected', props.className),
        title: props.title
    }, props.children);
}

export function Card(props) {
    return h(props.as || 'div', Object.assign({}, props.attrs, {
        className: cx('card', props.selected && 'card-selected', props.className)
    }), props.children);
}

export function StepHeading(props) {
    return h('div', { className: 'step-heading' },
        h('div', { className: 'step-heading-text' },
            h('span', { className: 'step-eyebrow' }, props.eyebrow),
            h('h1', { id: props.id }, props.title),
            props.subtitle && h('p', { className: 'step-subtitle' }, props.subtitle)
        ),
        props.actions && h('div', { className: 'step-heading-actions' }, props.actions)
    );
}

export function SearchField(props) {
    return h('div', { className: cx('search-field', props.size && 'search-field-' + props.size) },
        Icon.search(props.size === 'lg' ? 18 : 16),
        h('label', { htmlFor: props.id, className: 'sr-only' }, props.label),
        h('input', {
            id: props.id,
            ref: props.inputRef,
            type: 'search',
            autoComplete: 'off',
            placeholder: props.placeholder,
            value: props.value,
            onChange: function(e) { props.onChange(e.target.value); },
            onKeyDown: props.onKeyDown
        }),
        props.shortcut && h('kbd', { className: 'kbd', 'aria-hidden': 'true' }, props.shortcut)
    );
}

export function Alert(props) {
    return h('div', {
        className: cx('alert', props.tone && 'alert-' + props.tone),
        role: props.tone === 'warning' ? 'status' : 'alert'
    }, Icon.warning(16), h('span', null, props.children));
}

export function Status(props) {
    return h('p', { className: 'status-text', role: 'status', 'aria-live': 'polite' }, props.children);
}

// Geografiske nivåer som korte merker (N F K B LKS R), med fullt navn som verktøytips.
export function GeoLevels(props) {
    const levels = props.levels || [];
    if (!levels.length) return null;
    const names = levels.map(function(l) { return GEO_LEVEL_NAMES[l] || l; });
    return h('span', { className: cx('geo-tags', props.className), title: 'Geografi: ' + names.join(', '), 'aria-label': 'Geografi: ' + names.join(', ') },
        levels.map(function(l) { return h('span', { key: l, className: 'geo-tag', 'aria-hidden': 'true' }, l); })
    );
}
