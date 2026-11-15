// Focused Calendar integration check. Isolated Chromium profile; no user data.
// node tests/calendar-browser.mjs <chrome executable> <artifact directory>
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
    assert.equal(await evaluate(`document.querySelector('.horde-calendar')`),null,'No auto launch');
    assert.equal(await evaluate(`document.querySelectorAll('#desktopIcons [data-app="calendar"],#startMenu [data-app="calendar"],#mobileHome [data-app="calendar"]').length`),3);
    await click('#startMenu [data-app="calendar"]');await until(()=>evaluate(`document.querySelector('.calendar-month')`),'empty calendar');
    assert.equal(await evaluate(`document.querySelector('.calendar-day-events').textContent.includes('No events announced')`),true);
    await click('[aria-label="Close Calendar"]');
    await evaluate(`(()=>{
      const now=new Date(), date=offset=>new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+offset)).toISOString().slice(0,10);
      const target=date(1),other=date(8);window.__calendarTarget=target;
      const data={version:1,events:[{id:'fixture-event',title:'Fixture release',description:'Browser-only fixture',category:'Music Release',start:target+'T12:00:00',timeZone:'UTC',platform:'Test venue',url:'https://kick.com/zomblabs',status:'scheduled',visibility:'published'}],schedules:[{id:'fixture-weekly',title:'Fixture weekly',description:'Browser-only weekly fixture',weekdays:[new Date(target+'T00:00:00Z').getUTCDay()],time:'18:00:00',timeZone:'UTC',startDate:date(0),endDate:date(60),visibility:'published'}],exceptions:[{id:'fixture-cancel',scheduleId:'fixture-weekly',originalDate:target,status:'canceled',visibility:'published'},{id:'fixture-move',scheduleId:'fixture-weekly',originalDate:other,status:'rescheduled',start:date(9)+'T19:00:00',visibility:'published'}]};
      const original=window.fetch;window.fetch=(input,options)=>String(input).includes('content/calendar.json')?Promise.resolve(new Response(JSON.stringify(data),{status:200})):original(input,options);
    })()`);
    await click('#startMenu [data-app="calendar"]');await until(()=>evaluate(`document.querySelector('.calendar-month')`),'fixture calendar');
    for(const [width,height,mobile] of [[1280,900,false],[390,844,true],[844,390,true]]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await send('Emulation.setTouchEmulationEnabled',{enabled:mobile});await delay(150);
      await evaluate(`document.querySelectorAll('.horde-calendar nav button')[0].click()`);
      const heading=await evaluate(`document.querySelector('.horde-calendar h2').textContent`);
      await evaluate(`[...document.querySelectorAll('.horde-calendar button')].find(b=>b.textContent==='Next month').click()`);
      assert.notEqual(await evaluate(`document.querySelector('.horde-calendar h2').textContent`),heading);
      await evaluate(`[...document.querySelectorAll('.horde-calendar button')].find(b=>b.textContent==='Today').click()`);
      assert.equal(await evaluate(`document.querySelector('.horde-calendar h2').textContent`),heading);
      // Tomorrow can be in the next month.
      await evaluate(`if(!document.querySelector('[data-date="'+window.__calendarTarget+'"]'))[...document.querySelectorAll('.horde-calendar button')].find(b=>b.textContent==='Next month').click()`);
      const target=await evaluate(`window.__calendarTarget`);
      const selector=`[data-date="${target}"]`;
      if(mobile) {
        const point=await evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
        await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(150);
      } else await activate(selector);
      assert.equal(await evaluate(`document.querySelector('.calendar-day-events').textContent.includes('canceled')`),true);
      await activate('.calendar-day-events button');assert.ok(await evaluate(`document.querySelector('.calendar-detail').textContent.includes('America/Los_Angeles')`));
      const link=await evaluate(`(()=>{const a=document.querySelector('.calendar-detail a');return {url:a.href,target:a.target,rel:a.rel}})()`);
      assert.equal(link.url,'https://kick.com/zomblabs');assert.equal(link.target,'_blank');assert.ok(link.rel.includes('noopener'));
      await screenshot('calendar-detail-'+width);
      await evaluate(`document.querySelectorAll('.horde-calendar nav button')[1].click()`);
      assert.equal(await evaluate(`document.querySelector('.calendar-events [data-status="canceled"]')`),null);
      assert.ok(await evaluate(`document.querySelectorAll('.calendar-events li').length>1`));
      assert.ok(await evaluate(`document.querySelector('.calendar-events [data-status="rescheduled"]')!==null`));
      assert.equal(await evaluate(`(()=>{const app=document.querySelector('.horde-calendar'),root=document.querySelector('.retro-desktop');return app.scrollWidth<=app.clientWidth+1 && root.scrollHeight<=root.clientHeight+1})()`),true);
      assert.equal(await evaluate(`[...document.querySelectorAll('.horde-calendar button')].some(b=>/Add Event|Edit|Delete|Submit|Add to Calendar/.test(b.textContent))`),false);
      await evaluate(`ZombSettings.apply({theme:'amber'})`);assert.equal(await evaluate(`getComputedStyle(document.querySelector('.horde-calendar')).color`),'rgb(255, 209, 106)');
      await evaluate(`(()=>{const custom={version:3,name:'Calendar test',colors:ZombThemeSchema.palette()};custom.colors.windowBackground='#123456';custom.colors.textPrimary='#fedcba';ZombSettings.apply({theme:'custom',custom});})()`);
      assert.deepEqual(await evaluate(`(()=>{const s=getComputedStyle(document.querySelector('.horde-calendar'));return [s.backgroundColor,s.color]})()`),['rgb(18, 52, 86)','rgb(254, 220, 186)']);await evaluate(`ZombSettings.apply({theme:'toxic'})`);
      await screenshot('calendar-upcoming-'+width);
    }
    await click('[aria-label="Close Calendar"]');assert.equal(await evaluate(`document.querySelector('.horde-calendar')`),null);
    await click('#startMenu [data-app="settings"]');assert.equal(await evaluate(`document.querySelectorAll('.settings-app > nav button').length`),3);
    await click('[aria-label="Close Settings"]');
    const fallback=await evaluate(`(async()=>{const {calendarApp}=await import('./js/calendar-app.js');const box=document.createElement('div');document.body.append(box);const dispose=calendarApp(async()=>{throw Error('Fixture catalog unavailable')}).mount(box);await new Promise(r=>setTimeout(r,0));const ok=box.textContent.includes('Fixture catalog unavailable') && box.querySelector('button').textContent==='Retry';dispose();box.remove();return ok;})()`);assert.equal(fallback,true);
    const tba=await evaluate(`(async()=>{const {calendarApp}=await import('./js/calendar-app.js');const box=document.createElement('div');document.body.append(box);const dispose=calendarApp(async()=>({version:1,events:[{id:'tba',title:'TBA fixture',description:'Test',date:'2026-11-19',category:'Livestream',platform:'Kick',status:'scheduled',visibility:'published'}],schedules:[],exceptions:[]}),{now:()=>Date.parse('2026-11-19T12:00:00Z'),timeZone:'America/Los_Angeles'}).mount(box);await new Promise(r=>setTimeout(r,0));const month=box.querySelector('.calendar-day-events').textContent.includes('2026-11-19 · Time TBA');box.querySelector('.calendar-day-events button').click();const detail=box.querySelector('.calendar-detail').textContent;box.querySelectorAll('nav button')[1].click();const upcoming=box.querySelector('.calendar-events').textContent.includes('Time TBA');dispose();box.remove();return month && upcoming && detail.includes('Time TBA') && !detail.includes('Source schedule:') && !detail.includes('00:00');})()`);assert.equal(tba,true);
    assert.deepEqual(errors,[]);console.log('PASS Calendar: no auto launch; desktop/mobile registration, empty state, month/today navigation, touch date selection, local details, links, upcoming cancellation exclusion, rescheduled occurrences, themes, portrait/landscape, no desktop scrolling, close and Settings compatibility.');
} finally {try{if(ws?.readyState===1)await send('Browser.close');}catch{}ws?.close();child.kill();server.close();}
