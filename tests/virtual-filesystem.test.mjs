import assert from 'node:assert/strict';
import { VirtualFilesystem, normalizePath, parentPath } from '../js/virtual-filesystem.js';
assert.equal(normalizePath('c:/Documents/../Music/'), 'C:\\Music');
assert.equal(normalizePath('https://example.com'), null);
assert.equal(parentPath('C:\\Documents'), 'C:\\');
const fs = new VirtualFilesystem([
    { path: 'C:\\', name: 'C:', type: 'folder' },
    { path: 'C:\\Hidden', name: 'Hidden', type: 'folder', hidden: true },
    { path: 'C:\\Hidden\\Child', name: 'Child', type: 'text' },
    { path: 'C:\\Locked', name: 'Locked', type: 'folder', unlock: 'test-discovery' }
]);
assert.equal(fs.list('C:\\').length, 0);
assert.equal(fs.resolve('C:\\Hidden\\Child'), null);
assert.equal(fs.list('C:\\', true).length, 1);
assert.ok(fs.resolve('c:\\hidden\\child', true));
let notifications = 0;
fs.addEventListener('change', () => notifications++);
fs.discover('test-discovery');
assert.equal(notifications, 1);
assert.equal(fs.list('C:\\').length, 1);
assert.equal(fs.list('C:\\Missing'), null);
assert.throws(() => new VirtualFilesystem([{path:'C:\\A'}, {path:'c:\\a'}]));
console.log('PASS normalization, duplicate rejection, hidden ancestry, unlock notifications, invalid paths');
