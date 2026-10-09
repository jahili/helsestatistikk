import { parseHTML } from '../lib/html.mjs';
import { Icon } from './ui.mjs';

const h = React.createElement;
const { useEffect, useRef } = React;

export function closeMetadataModal(setShowMetadataModal) {
    setShowMetadataModal(false);
}

export function renderMetadataModal(showMetadataModal, tableMetadata, closeModalFn) {
    const closeButtonRef = useRef(null);

    useEffect(() => {
        if (showMetadataModal && closeButtonRef.current) {
            closeButtonRef.current.focus();
        }
    }, [showMetadataModal]);

    if (!showMetadataModal || !tableMetadata) return null;

    function parseRelatedMaterialLinks(text) {
        if (typeof text !== 'string') return text;

        const lines = text.split('\n').filter(line => line.trim());
        return lines.map(function(line, idx) {
            const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) {
                const url = urlMatch[1];
                const linkText = line.replace(url, '').replace(/:\s*$/, '').trim();
                return h('div', { key: idx, className: 'modal-related' },
                    h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, linkText || url)
                );
            }
            return h('div', { key: idx, className: 'modal-related' }, line);
        });
    }

    return h('div', {
        className: 'modal-backdrop',
        role: 'presentation',
        onClick: function(e) {
            if (e.target === e.currentTarget) {
                closeModalFn();
            }
        },
        onKeyDown: function(e) {
            if (e.key === 'Escape') {
                closeModalFn();
            }
        }
    },
        h('div', {
            className: 'modal',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-labelledby': 'modal-title'
        },
            h('div', { className: 'modal-head' },
                h('div', null,
                    h('span', { className: 'section-label' }, 'Om tabellen'),
                    h('h2', { id: 'modal-title', className: 'modal-title' }, tableMetadata.name || 'Tabellinformasjon')
                ),
                h('button', {
                    ref: closeButtonRef,
                    type: 'button',
                    className: 'icon-btn modal-close',
                    onClick: closeModalFn,
                    'aria-label': 'Lukk tabellinformasjon'
                }, Icon.close(14))
            ),
            h('div', { className: 'modal-body' },
                tableMetadata.isOfficialStatistics !== undefined && h('div', { className: 'modal-fact' },
                    h('span', null, 'Offisiell statistikk'),
                    h('span', null, tableMetadata.isOfficialStatistics ? 'Ja' : 'Nei')
                ),
                tableMetadata.paragraphs && Array.isArray(tableMetadata.paragraphs) && tableMetadata.paragraphs.map(function(paragraph, idx) {
                    // Skip Geografi
                    if (paragraph.header === 'Geografi') return null;

                    const isRelatedMaterial = paragraph.header === 'Relatert materiale';
                    const content = isRelatedMaterial ? parseRelatedMaterialLinks(paragraph.content) : parseHTML(paragraph.content, h);

                    return h('section', { key: idx, className: 'modal-section' },
                        h('h3', null, paragraph.header),
                        h('div', { className: 'modal-text' }, content)
                    );
                })
            )
        )
    );
}
