import { canonicalPublicPath } from '../lib/publicRoutes'

export function createPageUrl(pageName: string) {
    const editorOrigin = import.meta.env.VITE_EDITOR_URL?.trim().replace(/\/$/, '');
    if (editorOrigin && ['dashboard', 'login'].includes(pageName.toLowerCase())) {
        return `${editorOrigin}${pageName.toLowerCase() === 'dashboard' ? '/Dashboard' : '/login'}`;
    }
    const path = '/' + pageName.replace(/ /g, '-');
    return canonicalPublicPath(path) || path;
}
