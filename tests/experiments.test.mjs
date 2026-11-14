import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateExperimentCatalog,publishedExperiments,orderedLogs,searchProjects,experimentRoute,safeExternal,localReference,loadExperimentCatalog} from '../js/experiment-catalog.js';
import {validateLocalReferences} from '../tools/validate-experiments.mjs';
const catalog=JSON.parse(readFileSync(new URL('../content/experiments.json',import.meta.url),'utf8'));
const copy=()=>structuredClone(catalog);
test('production records have valid metadata, source files and assets, with no invented dates',()=>{
    assert.equal(validateLocalReferences(validateExperimentCatalog(catalog)),catalog);
    assert.equal(catalog.projects.length,7);assert.equal(catalog.logs.length,7);
    assert.ok(catalog.logs.every(log=>log.date===null));
});
test('duplicate IDs, absent parents, broken references and required metadata are rejected',()=>{
    for(const mutate of [d=>d.projects.push(d.projects[0]),d=>d.logs.push(d.logs[0]),d=>d.logs[0].projectId='missing',d=>d.projects[0].logIds=['missing'],d=>d.projects[0].relatedProjects=['missing'],d=>delete d.logs[0].summary,d=>d.projects[0].status='finished',d=>d.logs[0].sources=[],d=>d.logs[0].article=[{type:'html',text:'<script>alert(1)</script>'}]]){const d=copy();mutate(d);assert.throws(()=>validateExperimentCatalog(d));}
});
test('invalid links, unsafe paths, bad dates and missing local assets fail validation',()=>{
    for(const mutate of [d=>d.projects[0].links=[{type:'external',label:'Bad',url:'javascript:alert(1)'}],d=>d.projects[0].links=[{type:'app',label:'Bad',appId:'missing'}],d=>d.logs[0].date='2026-02-30',d=>d.logs[0].date='2026-11-01',d=>d.projects[0].media[0].src='../private.png']){const d=copy();mutate(d);assert.throws(()=>validateExperimentCatalog(d));}
    const d=copy();d.projects[0].media[0].src='assets/missing.png';assert.throws(()=>validateLocalReferences(validateExperimentCatalog(d)));
    for(const path of ['assets/../secret','/etc/passwd','assets/%2e%2e/x','https://host/a.png','C:/private.png'])assert.equal(localReference(path),false);
    for(const url of ['data:text/html,bad','http://example.com','https://user:pass@example.com'])assert.equal(safeExternal(url),false);
});
test('drafts never render publicly and a public entry cannot belong to a draft project',()=>{
    const d=copy();d.logs[0].visibility='draft';const visible=publishedExperiments(validateExperimentCatalog(d));assert.equal(visible.logs.some(log=>log.id===d.logs[0].id),false);
    d.projects[0].visibility='draft';assert.equal(publishedExperiments(validateExperimentCatalog(d)).projects.some(p=>p.id===d.projects[0].id),false);
    d.logs[0].visibility='published';assert.throws(()=>validateExperimentCatalog(d));
});
test('search, filters, chronological dates and permanent routes',()=>{
    assert.ok(searchProjects(catalog,'shuffle').some(p=>p.id==='radio'));assert.equal(searchProjects(catalog,'','Audio').length,2);assert.equal(searchProjects(catalog,'not-a-match').length,0);
    const logs=[{id:'a',date:null},{id:'b',date:'2025-01-01'},{id:'c',date:'2026-01-01'}];assert.deepEqual(orderedLogs(logs).map(l=>l.id),['c','b','a']);
    assert.deepEqual(experimentRoute('#experiments/project/phone'),{kind:'project',id:'phone'});assert.equal(experimentRoute('#experiments/log/<script>').kind,'missing');
    const d=copy();d.logs[0].date='2026-01-01';d.logs[0].dateSource=d.logs[0].sources[0].path;assert.doesNotThrow(()=>validateExperimentCatalog(d));
});
test('loader separates missing deployment errors from local storage and filters drafts',async()=>{
    const original=globalThis.fetch;
    try {globalThis.fetch=async()=>({ok:false});await assert.rejects(loadExperimentCatalog(),/local storage does not need resetting/);
    const d=copy();d.logs[0].visibility='draft';globalThis.fetch=async()=>({ok:true,json:async()=>d});assert.equal((await loadExperimentCatalog()).logs.length,6);
    globalThis.fetch=async()=>({ok:true,json:async()=>({version:99})});await assert.rejects(loadExperimentCatalog(),/version 1/);
    } finally {globalThis.fetch=original;}
});
test('app uses safe text nodes and the shared registry/installed integration',()=>{
    const app=readFileSync(new URL('../js/experiment-app.js',import.meta.url),'utf8');assert.doesNotMatch(app,/innerHTML|insertAdjacentHTML|eval\(/);assert.match(app,/textContent/);
    const desktop=readFileSync(new URL('../js/desktop.js',import.meta.url),'utf8');assert.match(desktop,/apps.register\(experimentApp\(launch\)\)/);assert.match(desktop,/id: 'experiments', title: 'Experiment Logs'/);
});
