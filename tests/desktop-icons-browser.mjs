// Focused desktop icon layout integration check. Isolated Chromium profile; no user data.
// node tests/desktop-icons-browser.mjs <chrome executable> <artifact directory>
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
const profile=await mkdtemp(join(artifacts,'icons-profile-'));
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
    await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('zombos.phone.v1',JSON.stringify({version:1,history:[],delivery:[],recoveryHold:true}));`});
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:base+'/'});
    await until(()=>evaluate(`document.querySelector('#loginButton')&&!document.querySelector('#loginButton').disabled`),'login');
    await click('#loginButton');await until(()=>evaluate(`!document.querySelector('#windowWorkspace').hidden && getComputedStyle(document.querySelector('#desktopScreen')).transform==='matrix(1, 0, 0, 1, 0, 0)'`),'desktop boot',30000);
    await evaluate(`document.getElementById('storageRecoveryNotice').hidden=true`);
    const order=await evaluate(`[...document.querySelectorAll('#desktopIcons button')].map(b=>b.dataset.app)`);
    for(const height of [1200,900,650,480,300,240,900]) {
        await send('Emulation.setDeviceMetricsOverride',{width:1280,height,deviceScaleFactor:1,mobile:false});await delay(150);
        const layout=await evaluate(`(()=>{const root=document.querySelector('#desktopIcons'),desktop=document.querySelector('.retro-desktop'),bar=document.querySelector('#zombTaskbar').getBoundingClientRect(),hint=document.querySelector('.desktop-hint').getBoundingClientRect();return {icons:[...root.children].map(b=>{const r=b.getBoundingClientRect();return {id:b.dataset.app,x:r.x,y:r.y,right:r.right,bottom:r.bottom}}),scroll:desktop.scrollHeight-desktop.clientHeight,iconScroll:root.scrollHeight-root.clientHeight,barTop:bar.top,barBottom:bar.bottom,hintTop:hint.top,top:root.getBoundingClientRect().top}})()`);
        assert.deepEqual(layout.icons.map(i=>i.id),order);
        assert.ok(layout.scroll<=1 && layout.iconScroll<=1,'No vertical icon/desktop scroll at '+height);
        assert.equal(layout.barBottom,height);assert.ok(layout.icons.every(i=>i.bottom<=layout.hintTop && i.bottom<=layout.barTop),'Icons clear footer and taskbar');
        for(let i=1;i<layout.icons.length;i++) {
            const previous=layout.icons[i-1],icon=layout.icons[i];
            if(Math.abs(icon.x-previous.x)<1)assert.ok(icon.y>=previous.bottom,'Vertical order without overlap');
            else {assert.ok(icon.x>=previous.right,'Next column to the right');assert.equal(icon.y,layout.top,'New column starts at top');}
        }
        if(height===900 || height===480) {assert.ok(new Set(layout.icons.map(i=>i.x)).size>1);await screenshot('icons-'+height);}
    }
    // Existing double-click and keyboard handlers are unchanged and still open apps.
    const point=await evaluate(`(()=>{const r=document.querySelector('#desktopIcons [data-app="settings"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...point});
    await until(()=>evaluate(`document.querySelector('.settings-app')`),'desktop double-click');await click('[aria-label="Close Settings"]');
    await evaluate(`document.querySelector('#desktopIcons [data-app="experiments"]').focus()`);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await until(()=>evaluate(`document.querySelector('.experiment-logs')`),'keyboard activation');await click('[aria-label="Close Experiment Logs"]');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await send('Emulation.setTouchEmulationEnabled',{enabled:true});await delay(150);
    await click('#mobileNavigation > button');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('#desktopScreen')).display`),'none');
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('#mobileHome [data-app]')].map(b=>b.dataset.app)`),order);
    await activate('#mobileHome [data-app="settings"]');await until(()=>evaluate(`document.querySelector('.settings-app')`),'mobile launcher');
    assert.equal(await evaluate(`document.querySelector('#mobileNavigation').hidden`),false);
    assert.deepEqual(errors,[]);console.log('PASS vertical columns at 1200/900/650/480/300/240px and resize back; no vertical scrolling or overlap; taskbar visible; ordering, double-click, keyboard and mobile launcher preserved.');
} finally {try{if(ws?.readyState===1)await send('Browser.close');}catch{}ws?.close();child.kill();server.close();}
