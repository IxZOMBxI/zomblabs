// Focused advertiser integration check. Isolated Chromium profile; no user data.
// node tests/advertiser-browser.mjs <chrome executable> <artifact directory>
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
const profile=await mkdtemp(join(artifacts,'calendar-profile-'));
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
    await send('Emulation.setTimezoneOverride',{timezoneId:'America/Los_Angeles'});
    await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('zombos.phone.v1',JSON.stringify({version:1,history:[],delivery:[],recoveryHold:true}));`});
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:base+'/'});await until(()=>evaluate(`document.querySelector('#loginButton')&&!document.querySelector('#loginButton').disabled`),'login');
    await click('#loginButton');await until(()=>evaluate(`!document.querySelector('#windowWorkspace').hidden`),'boot',30000);
    await evaluate(`document.getElementById('storageRecoveryNotice').hidden=true`);

    await click('#startMenu [data-app="zombnet"]');await until(()=>evaluate(`document.querySelector('.zombnet-page')`),'ZombNET launch');
    for(const [width,height,mobile] of [[1280,900,false],[390,844,true],[844,390,true]]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
      await send('Emulation.setTouchEmulationEnabled',{enabled:mobile});await delay(200);
      for(const site of ['crypt-crunch','dead-air','grim-glow']) {
        await evaluate(`(()=>{const box=document.querySelector('.zombnet');box.querySelector('input').value='zomb://${site}';box.querySelector('form').dispatchEvent(new Event('submit',{cancelable:true}));})()`);
        await until(()=>evaluate(`(()=>{const i=document.querySelector('.ad-art img');return i?.complete && i.naturalWidth>0})()`),'campaign artwork');
        assert.equal(await evaluate(`(()=>{const app=document.querySelector('.zombnet'),page=document.querySelector('.zombnet-page'),desktop=document.querySelector('.retro-desktop');return app.scrollWidth<=app.clientWidth+1 && page.scrollWidth<=page.clientWidth+1 && desktop.scrollHeight<=desktop.clientHeight+1})()`),true,'No overflow');
        await screenshot(site+'-'+width);
        if(mobile) {
          const point=await evaluate(`(()=>{const a=document.querySelector('.ad-copy a');a.scrollIntoView({block:'center'});const r=a.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
          await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(200);
        } else await activate('.ad-copy a');
        assert.equal(await evaluate(`!!document.querySelector('.ad-campaign')`),true,'Detail navigation');
      }
    }
    assert.deepEqual(errors,[]);console.log('PASS three advertiser sites: real desktop/mobile shell, portrait/landscape, artwork, touch detail navigation, no app or desktop overflow.');
} finally {try{if(ws?.readyState===1)await send('Browser.close');}catch{}ws?.close();child.kill();server.close();}
