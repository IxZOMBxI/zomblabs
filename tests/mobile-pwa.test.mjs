import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isStandalone, MOBILE_QUERY } from '../js/mobile-shell.js';
import { mountPwaChrome } from '../js/pwa.js';
import { WindowManager } from '../js/window-manager.js';
test('manifest root paths, PNG dimensions, iOS metadata and no service worker',()=>{
    const manifest=JSON.parse(readFileSync(new URL('../manifest.webmanifest',import.meta.url),'utf8'));
    assert.equal(manifest.name,'ZombOS');assert.equal(manifest.display,'standalone');
    for(const key of ['id','scope','start_url'])assert.equal(manifest[key],'/');
    for(const icon of [...manifest.icons,{src:'/assets/pwa/zombos-180.png',sizes:'180x180'}]) {
        const png=readFileSync(new URL('..'+icon.src,import.meta.url));assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a');
        assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`,icon.sizes);
    }
    const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
    assert.match(html,/viewport-fit=cover/);assert.match(html,/apple-mobile-web-app-capable/);assert.match(html,/rel="manifest"/);
    const code=readFileSync(new URL('../js/pwa.js',import.meta.url),'utf8');assert.doesNotMatch(code,/serviceWorker\.register|caches\.|location\.reload/);
});
test('standalone detection supports modern display mode and iOS without selecting mobile',()=>{
    assert.equal(isStandalone({matchMedia:()=>({matches:true}),navigator:{}}),true);
    assert.equal(isStandalone({matchMedia:()=>({matches:false}),navigator:{standalone:true}}),true);
    assert.equal(isStandalone({matchMedia:()=>({matches:false}),navigator:{}}),false);
    assert.doesNotMatch(MOBILE_QUERY,/standalone/);
});
test('mobile placement does not overwrite desktop position, size or maximize state',()=>{
    const manager=Object.create(WindowManager.prototype);manager.mobile=true;manager.workspace={clientWidth:390,clientHeight:700};
    const state={x:30,y:50,width:600,height:450,maximized:false,element:{style:{},offsetWidth:600,offsetHeight:450}};
    manager.place(state);assert.deepEqual(state.element.style,{left:'0px',top:'0px',width:'390px',height:'700px'});
    assert.equal(state.width,600);assert.equal(state.height,450);assert.equal(state.x,30);assert.equal(state.y,50);assert.equal(state.maximized,false);
    manager.mobile=false;manager.workspace={clientWidth:1200,clientHeight:800};manager.place(state);
    assert.equal(state.element.style.width,'600px');assert.equal(state.element.style.left,'30px');
});
test('chrome color tracks mobile theme only and removes listeners',()=>{
    let matches=false, callback, disconnected=false, removed=false;
    const meta={content:'#030704'}, media={get matches(){return matches;},addEventListener:(_,fn)=>{callback=fn;},removeEventListener:()=>{removed=true;}};
    const env={matchMedia:()=>media,getComputedStyle:()=>({getPropertyValue:()=> '#123456'}),MutationObserver:class {constructor(fn){this.fn=fn;}observe(){}disconnect(){disconnected=true;}}};
    const dispose=mountPwaChrome(env,{documentElement:{},querySelector:()=>meta});assert.equal(meta.content,'#030704');
    matches=true;callback();assert.equal(meta.content,'#123456');dispose();assert.ok(disconnected&&removed);
});
