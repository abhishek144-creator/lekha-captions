export function createPageUrl(pageName: string) {
    const editorOrigin = import.meta.env.VITE_EDITOR_URL?.trim().replace(/\/$/, '');
    if (editorOrigin && ['dashboard', 'login'].includes(pageName.toLowerCase())) {
        const normalizedPage = pageName.charAt(0).toUpperCase() + pageName.slice(1);
        return `${editorOrigin}/${normalizedPage}`;
    }
    return '/' + pageName.replace(/ /g, '-');
}
