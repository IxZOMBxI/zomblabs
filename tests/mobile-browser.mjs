// Optional real Chromium integration check. Node 22+, no packages. Isolated profile.
// node tests/mobile-browser.mjs <chrome executable> <artifact directory> [baseline Git ref]
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { resolve, extname, join } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const [executable, artifacts, baselineRef='HEAD']=process.argv.slice(2);if(!executable||!artifacts)throw Error('Supply Chromium executable and writable artifact directory');
const root=resolve('.'), mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.mp3':'audio/mpeg'};
const server=createServer(async(req,res)=>{try{
    let url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const baseline=url.startsWith('/baseline/');if(baseline)url=url.slice(9);
    const path=resolve(root,'.'+url);if(path!==root&&!path.startsWith(root+'\\')&&!path.startsWith(root+'/'))throw Error();
    const file=path===root?join(root,'index.html'):path;res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
    res.end(baseline?execFileSync('git',['show',baselineRef+':'+file.slice(root.length+1).replaceAll('\\','/')],{maxBuffer:30000000,windowsHide:true}):await readFile(file));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const profile=await mkdtemp(join(artifacts,'m15-profile-'));
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
    await send('Runtime.enable');await send('Page.enable');
    console.log('Browser: '+(await send('Browser.getVersion')).product);
    await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__testAudio=[];const NativeAudio=window.Audio;window.Audio=function(...args){const audio=new NativeAudio(...args);window.__testAudio.push(audio);return audio;};`});
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    const base=`http://127.0.0.1:${server.address().port}`;
    const snapshot=()=>evaluate(`['body','.terminal','.retro-desktop','#zombTaskbar','.desktop-icon'].map(selector=>{const e=document.querySelector(selector),r=e.getBoundingClientRect(),s=getComputedStyle(e);return {selector,rect:[r.x,r.y,r.width,r.height],color:s.color,background:s.backgroundColor,font:s.font,display:s.display};})`);
    let desktop;
    for (const path of ['/baseline/','/']) {
        await send('Page.navigate',{url:base+path});await until(()=>evaluate(`document.querySelector('#loginButton')&&!document.querySelector('#loginButton').disabled&&document.querySelector('#windowWorkspace').hidden`),'desktop login');await click('#loginButton');await until(()=>evaluate(`!document.querySelector('#windowWorkspace').hidden`),'desktop boot',25000);
        await until(()=>evaluate(`getComputedStyle(document.querySelector('#desktopScreen')).transform==='matrix(1, 0, 0, 1, 0, 0)' && getComputedStyle(document.querySelector('#desktopScreen')).opacity==='1'`),'Boot transition settled');
        if(path==='/baseline/')desktop=await snapshot();else assert.deepEqual(await snapshot(),desktop,'Desktop baseline styles and geometry');
        await click('#startMenu [data-app="radio"]');
        const geometry=()=>evaluate(`(()=>{const r=document.querySelector('.zomb-window').getBoundingClientRect();return [r.x,r.y,r.width,r.height]})()`);
        const original=await geometry();await click('.zomb-window-controls button:nth-child(2)');
        assert.equal(await evaluate(`document.querySelector('.zomb-window').classList.contains('is-maximized')`),true);
        await click('.zomb-window-controls button:nth-child(2)');assert.deepEqual(await geometry(),original);
        await click('.zomb-window-controls button:first-child');assert.equal(await evaluate(`document.querySelector('.zomb-window').hidden`),true);
        await click('#runningApps button');assert.equal(await evaluate(`document.querySelector('.zomb-window').hidden`),false);
        await click('.zomb-window-controls button:last-child');assert.equal(await evaluate(`document.querySelectorAll('.zomb-window').length`),0);
    }
    console.log('PASS desktop baseline geometry/colors/font/display');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await send('Emulation.setTouchEmulationEnabled',{enabled:true});
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});
    await until(()=>evaluate(`!!document.querySelector('#mobileHome') && !document.querySelector('#loginButton').disabled && document.querySelector('#windowWorkspace').hidden`),'mobile initialization');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('#mobileNavigation')).display`),'none','No navigation before boot');
    await click('#loginButton');await until(()=>evaluate(`!document.querySelector('#mobileHome').hidden`),'boot',25000);
    assert.equal(await evaluate(`document.querySelectorAll('#mobileHome [data-app]').length`),9);await screenshot('m15-mobile-home');
    const manifest=await send('Page.getAppManifest');assert.deepEqual(manifest.errors,[]);assert.equal(JSON.parse(manifest.data).display,'standalone');
    await send('Emulation.setEmulatedMedia',{features:[{name:'display-mode',value:'standalone'}]});
    if(await evaluate(`matchMedia('(display-mode: standalone)').matches`)) await until(()=>evaluate(`document.documentElement.dataset.standalone==='true'`),'Standalone mode detection');
    else console.log('LIMITATION: Chrome media emulation does not simulate standalone; detection covered by unit tests, installed launch needs a device.');
    await send('Emulation.setEmulatedMedia',{features:[]});
    const launch=async id=>{await click('#mobileNavigation button');await click(`#mobileHome [data-app="${id}"]`);};
    await launch('radio');await until(()=>evaluate(`!!document.querySelector('.radio [data-library] button')`),'Radio catalog');await activate('.radio [data-play]');
    await until(()=>evaluate(`!window.__testAudio[0].paused`),'Radio playing');
    await launch('store');assert.equal(await evaluate(`window.__testAudio[0].paused`),false,'Radio survives mobile switch');
    await until(()=>evaluate(`!document.querySelector('.phone-notice').hidden`),'Incoming call without Phone window',20000);
    await activate('.phone-notice .phone-answer');await until(()=>evaluate(`!window.__testAudio[1].paused`),'Connected call');assert.equal(await evaluate(`window.__testAudio[0].paused`),true);
    await activate('.phone [data-end]');await until(()=>evaluate(`!window.__testAudio[0].paused`),'Radio resumes');
    await launch('radio');await activate('.radio [data-stop]');
    console.log('PASS real Radio playback during switching, incoming notice, Phone answer/end and Radio handoff');
    for(const id of ['social','updates','radio','phone','explorer','zombnet','arcade','store','settings']){
        await launch(id);await delay(100);
        assert.ok(await evaluate(`(()=>{const w=document.querySelector('.zomb-window.is-focused'),r=w.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight&&w.querySelector('.zomb-window-content').scrollWidth<=w.querySelector('.zomb-window-content').clientWidth+1})()`),id+' viewport');
    }
    await evaluate(`(()=>{const select=document.querySelector('[data-theme-choice]');select.value='amber';select.dispatchEvent(new Event('change'));})()`);
    assert.equal(await evaluate(`document.documentElement.dataset.theme`),'amber');assert.equal(await evaluate(`window.ZombSettings.get().theme`),'toxic','Preview must not persist');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('#mobileNavigation button')).color`),'rgb(255, 209, 106)');
    await click('[data-reset]');assert.equal(await evaluate(`document.documentElement.dataset.theme`),'toxic');
    await launch('store');await click('.store-card .store-actions button:last-child');assert.match(await evaluate(`document.querySelector('.store-cart h2').textContent`),/1 item/);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('.store-summary button')).every(b=>b.disabled)`),true);
    await evaluate(`window.ZombSettings.apply({theme:'custom',crtEffects:false,systemSounds:false,custom:{version:window.ZombThemeSchema.version,name:'Browser test',colors:{...window.ZombThemeSchema.palette('violet'),storeBackground:'#102030',storeText:'#abcdef'}}})`);
    await until(()=>evaluate(`getComputedStyle(document.querySelector('.zomb-store')).backgroundColor==='rgb(16, 32, 48)'`),'Store custom background');
    await launch('settings');
    await evaluate(`(()=>{const theme=window.ZombSettings.get().custom;theme.colors.storeBackground='#182838';const data=new DataTransfer();data.items.add(new File([JSON.stringify(theme)],'test-theme.json',{type:'application/json'}));const input=document.querySelector('[data-import]');input.files=data.files;input.dispatchEvent(new Event('change'));})()`);
    await until(()=>evaluate(`document.querySelector('[data-result]').textContent.includes('Imported preview')`),'Theme JSON import');
    assert.equal(await evaluate(`window.ZombSettings.get().custom.colors.storeBackground`),'#102030','Import is preview only');
    await click('[data-apply]');assert.equal(await evaluate(`window.ZombSettings.get().custom.colors.storeBackground`),'#182838');
    await evaluate(`(()=>{const create=URL.createObjectURL,click=HTMLAnchorElement.prototype.click;window.__exported=null;URL.createObjectURL=blob=>{window.__exported=blob;return create(blob);};HTMLAnchorElement.prototype.click=function(){};document.querySelector('[data-export]').click();URL.createObjectURL=create;HTMLAnchorElement.prototype.click=click;})()`);
    assert.equal(await evaluate(`window.__exported.text().then(text=>JSON.parse(text).colors.storeBackground)`),'#182838');
    await launch('store');
    await screenshot('m15-custom-store');
    await evaluate(`window.ZombSettings.apply({theme:'toxic',crtEffects:true})`);
    await screenshot('m15-mobile-store');
    await send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true});await delay(200);assert.equal(await evaluate(`document.documentElement.dataset.mobile`),'true');await screenshot('m15-landscape');
    await send('Emulation.setTouchEmulationEnabled',{enabled:false});await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await delay(200);
    assert.equal(await evaluate(`document.documentElement.dataset.mobile`),'false');assert.equal(await evaluate(`document.querySelector('#mobileHome').hidden`),true);
    assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('#zombTaskbar')).display`),'none');await screenshot('m15-desktop');
    await send('Page.reload',{ignoreCache:true});await until(()=>evaluate(`!document.querySelector('#loginButton')?.disabled && document.querySelector('#windowWorkspace')?.hidden && window.ZombSettings?.get().custom?.name==='Browser test'`),'Saved settings reload');
    assert.equal(await evaluate(`window.ZombSettings.get().custom.colors.storeBackground`),'#182838');assert.equal(await evaluate(`window.ZombSettings.get().systemSounds`),false);
    assert.equal(await evaluate(`JSON.parse(localStorage.getItem('zombos.store.demo.v1')).items[0].quantity`),1);
    console.log('PASS manifest, mobile live preview/cancel, v3 import/export, settings and backpack persistence');
    assert.deepEqual(errors,[]);console.log('PASS mobile boot, nine apps, app switching, portrait/landscape bounds, Store restrictions, desktop return; '+artifacts);
} finally {try{if(ws?.readyState===1)await send('Browser.close');}catch{}ws?.close();child.kill();server.close();}
