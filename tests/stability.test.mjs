import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WindowManager } from '../js/window-manager.js';
import { protectArtwork } from '../js/artwork-overlay.js';
test('mobile windows are revealed before keyboard focus; desktop event order is unchanged',()=>{
    for(const mobile of [true,false]) {
        const events=[], manager=new EventTarget();let revealed=!mobile;
        const state={element:{hidden:false,style:{},classList:{toggle(){}},focus(){events.push(revealed?'focus':'hidden-focus');}},task:{setAttribute(){}},minimized:false};
        Object.assign(manager,{mobile,windows:new Map([['test',state]]),place(){},sound(){}});
        manager.addEventListener('focus',()=>{revealed=true;events.push('signal');});
        WindowManager.prototype.focus.call(manager,'test',true);
        assert.deepEqual(events,mobile?['signal','focus']:['focus','signal']);
    }
});
test('artwork skips CSS-hidden/CRT-disabled geometry, avoids repeated writes and disposes its RAF',()=>{
    const names=['document','requestAnimationFrame','cancelAnimationFrame','innerWidth','innerHeight','getComputedStyle'];
    const saved=Object.fromEntries(names.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
    let callback, reads=0,writes=0,clip='',visible=false,cancelled=false;
    const overlay={style:{get clipPath(){return clip;},set clipPath(value){clip=value;writes++;}}};
    const doc={hidden:false,documentElement:{dataset:{}},querySelector:()=>overlay};
    const img={hidden:false,parentElement:null,getClientRects:()=>visible?[{}]:[],getBoundingClientRect(){reads++;return {left:1,top:1,right:10,bottom:10};}};
    let dispose;
    try {
        Object.assign(globalThis,{document:doc,innerWidth:100,innerHeight:100,requestAnimationFrame:fn=>{callback=fn;return 1;},cancelAnimationFrame:()=>{cancelled=true;},getComputedStyle:()=>{throw Error('Unexpected hidden style read');}});
        dispose=protectArtwork({isConnected:true},()=>img);assert.equal(reads,0);
        visible=true;callback();assert.equal(reads,1);const afterVisible=writes;
        callback();assert.equal(writes,afterVisible);
        doc.documentElement.dataset.crtEffects='false';callback();assert.equal(reads,2);assert.equal(clip,'');
        doc.documentElement.dataset.crtEffects='true';doc.hidden=true;callback();assert.equal(reads,2);
        dispose();dispose=null;assert.ok(cancelled);assert.equal(clip,'');
    } finally {dispose?.();for(const key of names){if(saved[key])Object.defineProperty(globalThis,key,saved[key]);else delete globalThis[key];}}
});
