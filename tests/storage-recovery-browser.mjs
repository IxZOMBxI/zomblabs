// Focused recovery UI integration check. Isolated Chromium profile; no user data.
// node tests/storage-recovery-browser.mjs <chrome executable> <artifact directory>
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
const profile=await mkdtemp(join(artifacts,'recovery-profile-'));
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
    await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:resolve(artifacts)});
    const base=`http://127.0.0.1:${server.address().port}`;
    if (process.argv.includes('--tabs-only')) {
        await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
        await send('Page.navigate',{url:base+'/'});
        await until(()=>evaluate(`document.querySelector('#loginButton')&&!document.querySelector('#loginButton').disabled`),'login');
        await click('#loginButton');
        await until(()=>evaluate(`document.querySelector('#windowWorkspace')&&!document.querySelector('#windowWorkspace').hidden`),'boot',25000);
        await click('#startMenu [data-app="settings"]');
        for (const [width,height,mobile] of [[1280,900,false],[390,844,true],[844,390,true]]) {
            await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile}); await delay(200);
            await click('[data-settings-category="appearance"]');
            const tabs=await evaluate(`(()=>{const root=document.querySelector('.settings-app').getBoundingClientRect();return [...document.querySelectorAll('.settings-app > nav button')].map(button=>{const r=button.getBoundingClientRect(),s=getComputedStyle(button),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {label:button.textContent,visible:r.width>0 && r.height>0 && r.left>=root.left && r.right<=root.right && r.top>=root.top && r.bottom<=root.bottom && r.bottom<=innerHeight && s.visibility==='visible' && s.display!=='none',clickable:hit===button || button.contains(hit)}})})()`);
            assert.deepEqual(tabs.map(tab=>tab.label),['Custom Theme Editor','UI Sounds','System Recovery']);
            assert.ok(tabs.every(tab=>tab.visible && tab.clickable),'All three tabs simultaneously visible and unobstructed');
            await evaluate(`document.querySelector('.crt-effects-control').scrollIntoView({block:'center'})`);
            const crt=await evaluate(`(()=>{const label=document.querySelector('.crt-effects-control'),input=label.querySelector('input'),text=label.querySelector('span'),a=input.getBoundingClientRect(),b=text.getBoundingClientRect();return {aligned:Math.abs((a.top+a.height/2)-(b.top+b.height/2))<2,horizontal:a.right<b.left,touch:label.getBoundingClientRect().height>=44,checked:input.checked}})()`);
            assert.ok(crt.aligned && crt.horizontal && crt.touch,'CRT checkbox and label centered in one touch-friendly row');
            await activate('.crt-effects-control span');
            assert.equal(await evaluate(`document.querySelector('.crt-effects-control input').checked`),!crt.checked,'Label toggles checkbox');
            assert.equal(await evaluate(`ZombSettings.get().crtEffects`),!crt.checked,'Label saves preference');
            await activate('.crt-effects-control input');
            assert.equal(await evaluate(`document.querySelector('.crt-effects-control input').checked`),crt.checked,'Checkbox toggles directly');
            assert.equal(await evaluate(`JSON.parse(localStorage.getItem('zombos.settings.v1')).crtEffects`),crt.checked,'CRT preference persists');
            await evaluate(`document.querySelectorAll('.theme-editor details').forEach(node=>node.open=true);document.querySelector('.settings-app').scrollTop=1000000`);
            assert.equal(await evaluate(`(()=>{const root=document.querySelector('.settings-app');return root.scrollTop>0 && root.scrollTop+root.clientHeight>=root.scrollHeight-2})()`),true,'Expanded theme editor scrolls to bottom');
            await evaluate(`document.querySelectorAll('.theme-editor details').forEach(node=>node.open=false);document.querySelector('.settings-app').scrollTop=0`);
            await screenshot('settings-tabs-'+width);
            for (const category of ['sounds','appearance','recovery']) {
                await activate(`[data-settings-category="${category}"]`);
                assert.equal(await evaluate(`document.querySelector('[data-settings-category="${category}"]').getAttribute('aria-pressed')`),'true');
            }
            assert.equal(await evaluate(`document.querySelector('.settings-panel .system-recovery h2')?.textContent`),'System Recovery');
            assert.equal(await evaluate(`location.pathname`),'/');
            await screenshot('settings-tabs-recovery-'+width);
            console.log('PASS three visible/clickable tabs, embedded recovery, aligned CRT label/checkbox toggles and persistence, scrolling: '+width+'x'+height);
        }
        assert.deepEqual(errors,[]);
    } else {
    await send('Page.navigate',{url:base+'/recovery.html'});
    await until(()=>evaluate(`document.querySelector('.system-recovery select')`),'recovery controls');
    await evaluate(`(()=>{
        const colors=ZombThemeSchema.palette(); for(const key of Object.keys(colors))colors[key]='#000000';
        localStorage.setItem('zombos.settings.v1',JSON.stringify({theme:'custom',custom:{version:3,name:'Unreadable palette',colors},systemSounds:false}));
        localStorage.setItem('zombos.phone.v1','{broken');
        localStorage.setItem('zombos.arcade.v1',JSON.stringify({'dead-sprint':50,bad:-1}));
        localStorage.setItem('zombos.zombnet.v1',JSON.stringify({bookmarks:[{url:'zomb://home',title:'Kept'},null],history:[]}));
        localStorage.setItem('unrelated','leave alone');
    })()`);
    await send('Page.reload',{ignoreCache:true});
    await until(()=>evaluate(`document.querySelector('.system-recovery ul')?.textContent.includes('PHONE: protected')`),'protected Phone');
    assert.equal(await evaluate(`localStorage.getItem('zombos.phone.v1')`),'{broken');
    assert.equal(await evaluate(`JSON.parse(localStorage.getItem('zombos.arcade.v1'))['dead-sprint']`),50);
    assert.equal(await evaluate(`JSON.parse(localStorage.getItem('zombos.zombnet.v1')).bookmarks.length`),1);
    for(const [width,height,mobile] of [[1280,900,false],[390,844,true],[844,390,true]]) {
        await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
        await delay(100);
        assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,'No horizontal overflow');
        assert.equal(await evaluate(`getComputedStyle(document.querySelector('.system-recovery button')).color`),'rgb(101, 255, 125)');
        assert.equal(await evaluate(`[...document.querySelectorAll('.system-recovery button')].every(button=>button.getBoundingClientRect().height>=44)`),true);
        await screenshot('recovery-'+width+'x'+height);
    }
    await activate('.system-recovery button:nth-of-type(1)');
    assert.equal(await evaluate(`document.querySelector('[role=status]').textContent.includes('Inspection complete')`),true);
    await click('.system-recovery button:nth-of-type(2)');
    const exported=await until(async()=>JSON.parse(await readFile(join(artifacts,'zombos-local-backup.json'),'utf8')),'backup download');
    assert.equal(exported.values['zombos.phone.v1'],'{broken'); assert.equal(exported.values.unrelated,undefined);
    await evaluate(`(()=>{const select=document.querySelector('.system-recovery select');select.value='zombos.arcade.v1';select.dispatchEvent(new Event('change'));document.querySelector('.system-recovery input').value='yes';})()`);
    await click('.system-recovery button:nth-of-type(3)');
    assert.equal(await evaluate(`document.querySelector('[role=status]').textContent.includes('Confirmation did not match')`),true);
    await evaluate(`document.querySelector('.system-recovery input').value='RESET Arcade scores'`);
    await click('.system-recovery button:nth-of-type(3)');
    await until(()=>evaluate(`document.querySelector('.system-recovery ul')?.textContent.includes('Arcade scores: empty')`),'individual reset reload');
    assert.equal(await evaluate(`localStorage.getItem('unrelated')`),'leave alone');
    assert.equal(await evaluate(`localStorage.getItem('zombos.phone.v1')`),'{broken');
    await send('Page.navigate',{url:base+'/'});
    await until(()=>evaluate(`document.querySelector('#loginButton')&&!document.querySelector('#loginButton').disabled`),'login');
    assert.equal(await evaluate(`!document.getElementById('storageRecoveryNotice').hidden`),true);
    assert.equal(await evaluate(`document.querySelector('#storageRecoveryNotice a').getAttribute('href')`),'recovery.html');
    await activate('[data-dismiss-recovery]');
    await click('#loginButton');await until(()=>evaluate(`document.querySelector('#windowWorkspace')&&!document.querySelector('#windowWorkspace').hidden`),'boot',25000);
    await click('#startMenu [data-app="settings"]');
    await until(()=>evaluate(`document.querySelector('.system-recovery-access')`),'Settings');
    for (const [width,height,mobile] of [[1280,900,false],[390,844,true],[844,390,true]]) {
        await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
        await send('Emulation.setTouchEmulationEnabled',{enabled:mobile}); await delay(150);
        for (const category of ['appearance','sounds','recovery']) {
            await click(`[data-settings-category="${category}"]`);
            await evaluate(`document.querySelectorAll('.theme-editor details').forEach(node=>node.open=true)`);
            const metrics=await evaluate(`(()=>{const root=document.querySelector('.settings-app'), r=root.getBoundingClientRect();return {height:root.clientHeight,scroll:root.scrollHeight,x:r.x+r.width/2,y:r.bottom-20,bottom:r.bottom}})()`);
            assert.ok(metrics.height>0);
            if(metrics.scroll>metrics.height) {
                await send('Input.dispatchMouseEvent',{type:'mouseWheel',x:metrics.x,y:metrics.y,deltaY:240,deltaX:0});
                await until(()=>evaluate(`document.querySelector('.settings-app').scrollTop>0`),'mouse wheel scroll');
                await evaluate(`document.querySelector('.settings-app').scrollTop=0;document.querySelector('.settings-app').focus()`);
                await send('Input.dispatchKeyEvent',{type:'keyDown',key:'End',code:'End',windowsVirtualKeyCode:35,modifiers:2});
                await send('Input.dispatchKeyEvent',{type:'keyUp',key:'End',code:'End',windowsVirtualKeyCode:35,modifiers:2});
                await until(()=>evaluate(`(()=>{const root=document.querySelector('.settings-app');return root.scrollTop+root.clientHeight>=root.scrollHeight-2})()`),'keyboard scroll to bottom');
                if(mobile) {
                    await evaluate(`document.querySelector('.settings-app').scrollTop=0`);
                    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:metrics.x,y:metrics.y}]});
                    for(let step=1;step<=5;step++) {await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:metrics.x,y:metrics.y-step*12}]});await delay(25);}
                    await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
                    await until(()=>evaluate(`document.querySelector('.settings-app').scrollTop>0`),'touch scroll');
                }
            }
            await evaluate(`document.querySelector('.settings-app').scrollTop=1000000`);
            assert.equal(await evaluate(`(()=>{const root=document.querySelector('.settings-app');return root.scrollTop+root.clientHeight>=root.scrollHeight-2})()`),true,category+' bottom is reachable');
            assert.equal(await evaluate(`(()=>{const root=document.querySelector('.settings-app').getBoundingClientRect(),bar=document.querySelector(document.documentElement.dataset.mobile==='true'?'#mobileNavigation':'#zombTaskbar');return root.bottom<=innerHeight && (!bar || root.bottom<=bar.getBoundingClientRect().top)})()`),true,'Scroll area stays above taskbar');
            if(category==='appearance') {
                for(const selector of ['[data-apply]','[data-save]','[data-default]','[data-export]','[data-import]']) {
                    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);
                    assert.equal(await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(),root=document.querySelector('.settings-app').getBoundingClientRect();return r.bottom<=root.bottom && r.bottom>root.top})()`),true,'Theme action reachable: '+selector);
                }
            }
        }
        await click('[data-settings-category="appearance"]');
        await evaluate(`document.querySelector('.settings-app').scrollTop=100000`);
        assert.equal(await evaluate(`(()=>{const nav=document.querySelector('.settings-app > nav').getBoundingClientRect(),root=document.querySelector('.settings-app').getBoundingClientRect();return nav.top>=root.top && nav.bottom<=root.bottom})()`),true,'Categories remain visible while scrolling');
        assert.deepEqual(await evaluate(`[...document.querySelectorAll('.settings-app > nav button')].map(b=>b.textContent)`),['Custom Theme Editor','UI Sounds','System Recovery']);
        if (mobile) {
            const point=await evaluate(`(()=>{const r=document.querySelector('.system-recovery-access').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
            await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
            await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        } else {
            await evaluate(`document.querySelector('.system-recovery-access').focus()`);
            await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
            await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
        }
        console.log('Checking Settings navigation at '+width+'x'+height);
        await until(()=>evaluate(`document.querySelector('.system-recovery-access').getAttribute('aria-pressed')==='true'`),'recovery activation');
        assert.equal(await evaluate(`document.querySelector('.settings-app .system-recovery ul').textContent.includes('PHONE: protected')`),true);
        assert.equal(await evaluate(`getComputedStyle(document.querySelector('.system-recovery-access')).color`),'rgb(101, 255, 125)');
        await evaluate(`(()=>{const select=document.querySelector('.settings-panel select');select.value='all';select.dispatchEvent(new Event('change'));})()`);
        assert.equal(await evaluate(`document.querySelector('.settings-panel').textContent.includes('RESET ALL ZOMBOS')`),true);
        await click('.settings-panel .system-recovery button:nth-of-type(3)');
        assert.equal(await evaluate(`document.querySelector('.settings-panel [role=status]').textContent.includes('Confirmation did not match')`),true);
        assert.equal(await evaluate(`localStorage.getItem('zombos.phone.v1')`),'{broken');
        await evaluate(`document.querySelector('.settings-panel input[type=text]').scrollIntoView({block:'center'})`);
        assert.equal(await evaluate(`(()=>{const input=document.querySelector('.settings-panel input[type=text]').getBoundingClientRect(), panel=document.querySelector('.settings-app').getBoundingClientRect();return input.top>=panel.top && input.bottom<=panel.bottom})()`),true,'Full reset confirmation is reachable');
        await screenshot('settings-recovery-'+width+'x'+height);
        await click('[data-settings-category="sounds"]');
        assert.equal(await evaluate(`document.querySelector('.settings-panel h2').textContent`),'UI Sounds');
    }
    await click('.system-recovery-access');
    await click('.settings-panel .system-recovery button:nth-of-type(2)');
    assert.equal(await evaluate(`document.querySelector('.settings-panel [role=status]').textContent.includes('Backup download requested')`),true);
    await send('Page.navigate',{url:base+'/recovery.html'});
    await until(()=>evaluate(`document.querySelector('.system-recovery select')`),'standalone recovery');
    await evaluate(`(()=>{const select=document.querySelector('.system-recovery select');select.value='all';select.dispatchEvent(new Event('change'));document.querySelector('.system-recovery input').value='RESET ALL ZOMBOS';})()`);
    await click('.system-recovery button:nth-of-type(3)');
    await until(()=>evaluate(`document.querySelector('.system-recovery ul')?.textContent.includes('PHONE: empty')`),'full reset reload');
    assert.equal(await evaluate(`localStorage.getItem('unrelated')`),'leave alone');
    assert.equal(await evaluate(`JSON.parse(localStorage.getItem('zombos.recovery.zombos.phone.v1'))[0]`),'{broken');
    assert.deepEqual(errors,[]);
    console.log('PASS desktop/mobile recovery, unreadable theme, partial repair, protected PHONE, export, confirmation, individual/full reset, unrelated key preservation, Settings integration; '+artifacts);
    }
} finally {try{if(ws?.readyState===1)await send('Browser.close');}catch{}ws?.close();child.kill();server.close();}
