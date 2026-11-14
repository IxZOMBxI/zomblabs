// Focused Experiment Logs integration check. Isolated Chromium profile; no user data.
// node tests/experiments-browser.mjs <chrome executable> <artifact directory>
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { resolve, extname, join } from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const [executable, artifacts]=process.argv.slice(2);if(!executable||!artifacts)throw Error('Supply Chromium executable and writable artifact directory');
const root=resolve('.'), mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.mp3':'audio/mpeg'};
const server=createServer(async(req,res)=>{try{
    const url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const path=resolve(root,'.'+url);if(path!==root&&!path.startsWith(root+'\\')&&!path.startsWith(root+'/'))throw Error();
    const file=path===root?join(root,'index.html'):path;res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
    res.end(await readFile(file));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const profile=await mkdtemp(join(artifacts,'experiments-profile-'));
const child=spawn(executable,['--headless=new','--disable-gpu','--mute-audio','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let ws, counter=0;const pending=new Map(), errors=[];
async function until(fn,label,limit=20000){const start=Date.now();while(Date.now()-start<limit){try{const value=await fn();if(value)return value;}catch{}await delay(100);}throw Error('Timeout: '+label);}
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++counter;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+JSON.stringify(r.exceptionDetails.exception));return r.result.value;}
const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
async function screenshot(name){const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(artifacts,name+'.png'),Buffer.from(r.data,'base64'));}
async function activate(selector){const r=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...r});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...r});}
try {
    const port=await until(async()=>Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]),'browser startup');
    const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();ws=new WebSocket(pages[0].webSocketDebuggerUrl);
    await new Promise(r=>ws.addEventListener('open',r,{once:true}));
    ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
    await send('Runtime.enable');await send('Page.enable');await send('Emulation.setFocusEmulationEnabled',{enabled:true});
    const base=`http://127.0.0.1:${server.address().port}`;
    // Isolated test profile: disable automatic catalog calls, never touch real visitor history.
    await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('zombos.phone.v1',JSON.stringify({version:1,history:[],delivery:[],recoveryHold:true}));`});
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:base+'/#experiments/project/zombos'});
    await until(()=>evaluate(`document.querySelector('#loginButton')&&!document.querySelector('#loginButton').disabled`),'login');
    await click('#loginButton');await until(()=>evaluate(`document.querySelector('.experiment-detail h2')?.textContent==='ZombOS'`),'deep link after boot',30000);
    await evaluate(`document.getElementById('storageRecoveryNotice').hidden=true`);
    assert.equal(await evaluate(`document.querySelectorAll('#desktopIcons [data-app="experiments"],#startMenu [data-app="experiments"],#mobileHome [data-app="experiments"]').length`),3);
    await until(()=>evaluate(`document.querySelector('.experiment-logs img')?.naturalWidth>0`),'existing project image');
    await click('[aria-label="Maximize Experiment Logs"]');assert.equal(await evaluate(`document.querySelector('.experiment-logs').closest('.zomb-window').getBoundingClientRect().width>1000`),true);
    await click('[aria-label="Restore Experiment Logs"]');
    await click('[aria-label="Minimize Experiment Logs"]');assert.equal(await evaluate(`document.querySelector('.experiment-logs').closest('.zomb-window').hidden`),true);
    await click('#startMenu [data-app="experiments"]');assert.equal(await evaluate(`document.querySelectorAll('.experiment-logs').length`),1);
    for(const [width,height,mobile] of [[1280,900,false],[390,844,true],[844,390,true]]) {
        await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await delay(150);
        await evaluate(`location.hash='#experiments'`);await until(()=>evaluate(`document.querySelectorAll('.experiment-cards article').length===7`),'archive');
        const bounds=await evaluate(`(()=>{const el=document.querySelector('.experiment-logs'),r=el.getBoundingClientRect();return {overflow:el.scrollWidth>el.clientWidth+1,bottom:r.bottom,height:innerHeight}})()`);assert.equal(bounds.overflow,false);assert.ok(bounds.bottom<=bounds.height);
        await evaluate(`(()=>{const input=document.querySelector('.experiment-filters input');input.value='shuffle';input.dispatchEvent(new Event('input'));})()`);
        assert.ok(await evaluate(`[...document.querySelectorAll('.experiment-cards h2')].some(n=>n.textContent==='Zomb Labs RADIO')`));
        await evaluate(`(()=>{const input=document.querySelector('.experiment-filters input');input.value='no such project';input.dispatchEvent(new Event('input'));})()`);
        assert.equal(await evaluate(`document.querySelector('.experiment-cards').textContent.includes('No matching projects')`),true);
        await evaluate(`(()=>{const input=document.querySelector('.experiment-filters input'),select=document.querySelector('.experiment-filters select');input.value='';select.value='Audio';select.dispatchEvent(new Event('change'));})()`);
        assert.equal(await evaluate(`document.querySelectorAll('.experiment-cards article').length`),2);
        await activate('.experiment-cards a[href="#experiments/project/radio"]');await until(()=>evaluate(`document.querySelector('.experiment-detail h2')?.textContent==='Zomb Labs RADIO'`),'project');
        await activate('a[href="#experiments/log/radio-implementation"]');await until(()=>evaluate(`document.querySelector('.experiment-detail h2')?.textContent.includes('catalog-backed')`),'log');
        assert.ok(await evaluate(`document.querySelector('.experiment-detail').textContent.includes('Shuffle starts enabled')`));
        await screenshot('experiments-log-'+width);
        await activate('.experiment-links button');await until(()=>evaluate(`document.querySelector('.radio')`),'linked Radio');
        await click('#startMenu [data-app="experiments"]');
        const theme=await evaluate(`(()=>{const custom={version:3,name:'Test archive',colors:ZombThemeSchema.palette('amber')};custom.colors.windowBackground='#123456';custom.colors.textPrimary='#fedcba';ZombSettings.apply({theme:'custom',custom});const s=getComputedStyle(document.querySelector('.experiment-logs'));return [s.backgroundColor,s.color];})()`);
        assert.deepEqual(theme,['rgb(18, 52, 86)','rgb(254, 220, 186)']);await evaluate(`ZombSettings.apply({theme:'toxic'})`);
        await evaluate(`location.hash='#experiments/project/not-found'`);await until(()=>evaluate(`document.querySelector('.experiment-logs').textContent.includes('Record not found')`),'missing record');
        await click('[aria-label="Close Experiment Logs"]');assert.equal(await evaluate(`document.querySelector('.experiment-logs')===null`),true);
        await click(mobile?'#mobileHome [data-app="experiments"]':'#startMenu [data-app="experiments"]');await until(()=>evaluate(`document.querySelector('.experiment-logs')?.textContent.includes('Record not found')`),'reopen');
        await evaluate(`location.hash='#experiments'`);await until(()=>evaluate(`document.querySelector('.experiment-filters')`),'archive return');
        await evaluate(`(()=>{const select=document.querySelector('.experiment-filters select');select.value='';select.dispatchEvent(new Event('change'));})()`);
        await screenshot('experiments-archive-'+width);
    }
    // Test-only injected records exercise safety/media/error states without publishing fake entries.
    const fixture=await evaluate(`(async()=>{
        const {experimentApp}=await import('./js/experiment-app.js');const {validateExperimentCatalog,publishedExperiments}=await import('./js/experiment-catalog.js');
        const data=await(await fetch('./content/experiments.json')).json();data.projects[0].title='<img src=x onerror=alert(1)>';data.projects[0].media.push({type:'video',src:'assets/test-only-missing.webm',alt:'Test video',caption:'Test only'});
        const box=document.createElement('div');document.body.append(box);history.replaceState(null,'','#experiments/project/zombos');
        let signal;const dispose=experimentApp(()=>{},async options=>{signal=options.signal;return publishedExperiments(validateExperimentCatalog(data));}).mount(box);await new Promise(r=>setTimeout(r,50));
        const safe=box.querySelector('h2').textContent==='<img src=x onerror=alert(1)>' && !box.querySelector('[onerror]');const video=box.querySelector('video');const media=video.controls && video.preload==='none';dispose();const cleaned=signal.aborted && box.childNodes.length===0;box.remove();
        const empty=document.createElement('div');document.body.append(empty);history.replaceState(null,'','#experiments');const closeEmpty=experimentApp(()=>{},async()=>({projects:[],logs:[]})).mount(empty);await new Promise(r=>setTimeout(r,0));const noData=empty.textContent.includes('No matching projects');closeEmpty();empty.remove();
        const failed=document.createElement('div');document.body.append(failed);const closeFailed=experimentApp(()=>{},async()=>{throw Error('Test failure')}).mount(failed);await new Promise(r=>setTimeout(r,0));const error=failed.textContent.includes('Test failure') && failed.querySelector('button').textContent==='Retry';closeFailed();failed.remove();
        return {safe,media,cleaned,noData,error};
    })()`);assert.deepEqual(fixture,{safe:true,media:true,cleaned:true,noData:true,error:true});
    assert.deepEqual(errors,[]);console.log('PASS Experiment Logs: integration, deep links, lifecycle, search/filter, project/log navigation, source artwork, app links, themes, desktop/portrait/landscape, safe rendering, media cleanup, empty/error states.');
} finally {try{if(ws?.readyState===1)await send('Browser.close');}catch{}ws?.close();child.kill();server.close();}
