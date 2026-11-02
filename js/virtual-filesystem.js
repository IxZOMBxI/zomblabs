// Public, fictional, read-only data. Never store real secrets in this tree.
export const filesystemEntries = [
    { path: 'C:\\', name: 'C:', type: 'folder', description: 'ZombOS virtual drive' },
    ...['Desktop', 'Documents', 'Music', 'Broadcasts', 'Laboratory', 'Archives', 'System'].map(name => ({ path: `C:\\${name}`, name, type: 'folder' })),
    { path: 'C:\\Documents\\Guides', name: 'Guides', type: 'folder' },
    { path: 'C:\\Documents\\Guides\\About.txt', name: 'About.txt', type: 'text', content: 'ZombOS File Explorer\n\nThis is a fictional, read-only virtual filesystem delivered by this website. It cannot access files on your computer.\n\nDouble-click a folder to browse it. Use Open or Enter on touch and keyboard. Music and Broadcasts shortcuts open Radio. Hidden content is public website data, not a security boundary.' },
    { path: 'C:\\Music\\Radio', name: 'Radio', type: 'music', description: 'Open the Radio application' },
    { path: 'C:\\Broadcasts\\Radio', name: 'Radio', type: 'broadcast', description: 'Open Radio for recorded broadcasts' }
];

export function normalizePath(value) {
    const source = String(value).trim().replaceAll('/', '\\');
    if (!/^c:(\\|$)/i.test(source)) return null;
    const parts = [];
    for (const part of source.slice(2).split('\\')) {
        if (!part || part === '.') continue;
        if (part === '..') parts.pop();
        else parts.push(part);
    }
    return 'C:\\' + parts.join('\\');
}
export function parentPath(path) {
    const normalized = normalizePath(path);
    if (!normalized || normalized === 'C:\\') return null;
    const index = normalized.lastIndexOf('\\');
    return index === 2 ? 'C:\\' : normalized.slice(0, index);
}
export class VirtualFilesystem extends EventTarget {
    constructor(entries = filesystemEntries) {
        super();
        this.entries = new Map();
        this.discoveries = new Set();
        for (const entry of entries) {
            const path = normalizePath(entry.path);
            if (!path || this.entries.has(path.toLowerCase())) throw new Error('Invalid or duplicate virtual path');
            this.entries.set(path.toLowerCase(), Object.freeze({ ...entry, path }));
        }
    }
    resolve(path, showHidden = false) {
        const normalized = normalizePath(path);
        if (!normalized) return null;
        const entry = this.entries.get(normalized.toLowerCase());
        if (!entry || entry.hidden && !showHidden || entry.unlock && !this.discoveries.has(entry.unlock)) return null;
        const parent = parentPath(normalized);
        if (parent && this.resolve(parent, showHidden)?.type !== 'folder') return null;
        return entry;
    }
    list(path, showHidden = false) {
        const directory = this.resolve(path, showHidden);
        if (directory?.type !== 'folder') return null;
        return [...this.entries.values()].filter(entry => parentPath(entry.path)?.toLowerCase() === directory.path.toLowerCase() && this.resolve(entry.path, showHidden))
            .sort((a,b) => Number(b.type === 'folder') - Number(a.type === 'folder') || a.name.localeCompare(b.name));
    }
    discover(key) { this.discoveries.add(key); this.dispatchEvent(new Event('change')); }
}
