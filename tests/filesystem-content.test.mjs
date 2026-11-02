import assert from 'node:assert/strict';
import { filesystemContent } from '../js/filesystem-content.js';
import { VirtualFilesystem } from '../js/virtual-filesystem.js';
const shortcuts = [{id:'radio',title:'Radio'}, {id:'future',title:'Future App'}];
const catalog = [
    {id:'one',section:'music',src:'https://example.test/media/tracks/Caf%C3%A9%20%23%20100%25.mp3',artwork:'https://example.test/media/artwork/Caf%C3%A9%20%23.png'},
    {id:'two',section:'music',src:'https://example.test/media/tracks/Second.mp3',artwork:'https://example.test/media/artwork/Caf%C3%A9%20%23.png'},
    {id:'broadcast',section:'broadcasts',src:'https://example.test/media/broadcasts/Show.mp3'}
];
const fs = new VirtualFilesystem(filesystemContent(shortcuts,catalog));
assert.deepEqual(fs.list('C:/').map(e=>e.name),['Desktop','Documents','Music','Pictures','Videos']);
assert.equal(fs.list('C:/Documents').length,0);
assert.equal(fs.list('C:/Videos').length,0);
assert.deepEqual(fs.list('C:/Desktop').map(e=>e.appId).sort(),['future','radio']);
assert.equal(fs.list('C:/Music').length,2);
assert.ok(fs.list('C:/Music').some(e=>e.name==='Café # 100%.mp3'));
assert.equal(fs.list('C:/Pictures').length,1);
assert.equal(fs.list('C:/Pictures')[0].src,catalog[0].artwork);
fs.replace(filesystemContent(shortcuts,[]));
assert.equal(fs.list('C:/Music').length,0);
assert.equal(fs.list('C:/Pictures').length,0);
console.log('PASS five root folders, shortcut projection, media filenames/URLs, artwork deduplication, empty catalog');
