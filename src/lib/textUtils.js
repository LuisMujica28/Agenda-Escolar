/**
 * Utility to strip HTML tags and decode entities for snippet/preview displays.
 * Keeps text clean and readable without leaking tags like <i>, <b>, <u>, <p>.
 */
export function stripHtml(html) {
    if (!html) return '';
    if (typeof html !== 'string') return String(html);

    if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const text = doc.body.innerText || doc.body.textContent || '';
            return text.replace(/\s+/g, ' ').trim();
        } catch (e) {
            // fallback if DOMParser fails
        }
    }

    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}
