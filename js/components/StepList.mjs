import { Icon } from './ui.mjs';
import { stepNumber } from '../lib/format.mjs';

const h = React.createElement;

// items: [{ num, title, summary, available, onSelect }]
// Status utledes fra aktivt steg: ferdig (num < step), aktivt (num === step), ikke nådd (num > step).
function stepState(num, step) {
    if (num < step) return 'done';
    if (num === step) return 'active';
    return 'todo';
}

function stateLabel(state) {
    if (state === 'done') return ' (fullført)';
    if (state === 'active') return ' (aktivt steg)';
    return ' (ikke startet)';
}

function circle(num, state) {
    return h('span', { className: 'step-circle', 'aria-hidden': 'true' },
        state === 'done' ? Icon.check(14) : stepNumber(num)
    );
}

export function StepList(props) {
    const step = props.step;
    return h('ol', { className: 'step-list', 'aria-label': 'Steg i spørringen' },
        props.items.map(function(item) {
            const state = stepState(item.num, step);
            // Et steg som ikke er nådd, men som har data (bruker har gått tilbake), kan fortsatt åpnes.
            const canJump = state === 'todo' && item.available;
            return h('li', {
                key: item.num,
                className: 'step-row step-' + state + (canJump ? ' step-available' : ''),
                'aria-current': state === 'active' ? 'step' : undefined
            },
                circle(item.num, state),
                h('span', { className: 'step-text' },
                    h('span', { className: 'step-title' },
                        h('span', { className: 'sr-only' }, 'Steg ' + item.num + ': '),
                        item.title,
                        h('span', { className: 'sr-only' }, stateLabel(state))
                    ),
                    (state !== 'todo' || canJump) && item.summary && h('span', { className: 'step-summary' }, item.summary)
                ),
                (state === 'done' || canJump) && h('button', {
                    type: 'button',
                    className: 'btn btn-link step-change',
                    onClick: item.onSelect,
                    'aria-label': (state === 'done' ? 'Endre ' : 'Gå til ') + item.title.toLowerCase()
                }, state === 'done' ? 'Endre' : 'Gå til')
            );
        })
    );
}

// Kompakt stegrad for smale skjermer.
export function StepDots(props) {
    const step = props.step;
    const active = props.items.find(function(i) { return i.num === step; });
    return h('nav', { className: 'step-dots', 'aria-label': 'Steg' },
        h('ol', null,
            props.items.map(function(item) {
                const state = stepState(item.num, step);
                const clickable = state === 'done' || (state === 'todo' && item.available);
                const content = [circle(item.num, state), h('span', { key: 'l', className: 'sr-only' }, item.title + stateLabel(state))];
                return h('li', { key: item.num, className: 'step-dot step-' + state, 'aria-current': state === 'active' ? 'step' : undefined },
                    clickable
                        ? h('button', { type: 'button', onClick: item.onSelect }, content)
                        : h('span', null, content)
                );
            })
        ),
        active && h('span', { className: 'step-dots-label', 'aria-hidden': 'true' }, stepNumber(active.num) + ' · ' + active.title)
    );
}
