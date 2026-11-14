import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { SystemSounds } from '../js/system-sounds.js';
import { PhoneService } from '../js/phone-service.js';

function setup() {
    let time = 0, repeats = new Map(), sequence = 0;
    const param = () => ({value:0, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){}});
    const context = {state:'running', currentTime:0, destination:{}, oscillators:[],
        createGain: () => ({gain:param(), connect(){}, disconnect(){}}),
        createOscillator() { const node = {frequency:param(), connect(){}, disconnect(){}, start(){}, stop(){this.stopped=true;}}; this.oscillators.push(node); return node; },
        close: async () => {}, resume: async () => {context.state='running';}};
    const sounds = new SystemSounds({createContext:()=>context, now:()=>time, repeat:fn=>{repeats.set(++sequence,fn); return sequence;}, cancel:id=>repeats.delete(id)});
    return {sounds, context, repeats, advance:()=>{time+=3000;}};
}
test('default ring timers retain the browser global receiver', () => {
    const originalSet = globalThis.setInterval, originalClear = globalThis.clearInterval;
    let started = 0, cleared = 0;
    try {
        globalThis.setInterval = function () { assert.equal(this, globalThis); started++; return 42; };
        globalThis.clearInterval = function (id) { assert.equal(this, globalThis); assert.equal(id,42); cleared++; };
        const {context} = setup();
        const sounds = new SystemSounds({createContext:()=>context});
        sounds.unlock(); sounds.setPhoneMode('ringing'); assert.equal(started,1);
        sounds.setPhoneMode('connected'); assert.equal(cleared,1); sounds.dispose();
    } finally { globalThis.setInterval=originalSet; globalThis.clearInterval=originalClear; }
});
test('lazy audio, volume clamp, mute, cooldown and disposal', () => {
    const {sounds,context,advance} = setup();
    assert.equal(sounds.play('boot'),false); sounds.unlock();
    sounds.configure({systemSoundVolume:2}); assert.equal(sounds.master.gain.value,0.12);
    assert.equal(sounds.play('click'),true); assert.equal(sounds.play('click'),false);
    sounds.configure({systemSounds:false}); assert.equal(sounds.master.gain.value,0); assert.equal(sounds.nodes.size,0);
    advance(); assert.equal(sounds.play('open'),false);
    sounds.configure({systemSoundVolume:0}); assert.equal(sounds.play('open'),false);
    sounds.configure({systemSoundVolume:0.5}); assert.equal(sounds.master.gain.value,0.06);
    sounds.setPhoneMode('connected'); assert.equal(sounds.play('click'),false);
    sounds.setPhoneMode('idle'); assert.equal(sounds.play('notification'),true);
    sounds.dispose(); advance(); assert.equal(sounds.play('open'),false);
    assert.ok(context.oscillators.every(node=>node.stopped));
});
test('delegated activation emits once, semantic actions supersede clicks, untrusted events ignored', async () => {
    const {sounds,context,advance} = setup(), handlers = new Map();
    const unbind = sounds.bind({addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name)});
    const event = {isTrusted:true,target:{closest:selector=>selector.startsWith('button') ? {} : null}};
    const settle = () => new Promise(resolve => setTimeout(resolve, 5));
    handlers.get('click')(event); await settle(); assert.equal(context.oscillators.length,1);
    advance(); handlers.get('click')(event); sounds.play('open'); await settle(); assert.equal(context.oscillators.length,3);
    advance(); handlers.get('click')({...event,isTrusted:false}); await settle(); assert.equal(context.oscillators.length,3);
    unbind(); assert.equal(handlers.size,0);
});
test('Phone ringing stops before recording and on decline, timeout, inactivity and disposal', () => {
    for (const action of ['answer','decline','timeout','inactive','close','dispose']) {
        const {sounds,repeats,advance} = setup(); sounds.unlock();
        class Audio extends EventTarget {
            paused = true;
            load() {} removeAttribute() {} pause() { this.paused=true; }
            async play() { assert.equal(repeats.size,0); assert.equal(sounds.nodes.size,0); this.paused=false; }
        }
        let now = 0;
        const data=new Map(), storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
        const phone = new PhoneService({storage,sounds,audio:new Audio(),radio:{holdForPhone:()=>()=>{}},now:()=>now,monotonic:()=>now});
        phone.setCatalog([{section:'calls',callId:'test',caller:'Test',src:'test.mp3',delivery:{}}]);
        phone.setActive(true); phone.tick(); assert.equal(repeats.size,1);
        phone.emit(); assert.equal(repeats.size,1);
        if (action==='timeout') { now=31000; phone.tick(); }
        else if (action==='inactive') phone.setActive(false);
        else if (action==='close') phone.closeWindow();
        else phone[action]();
        assert.equal(repeats.size,0,action); assert.equal(sounds.nodes.size,0,action);
        advance(); sounds.dispose(); phone.dispose();
    }
});
test('ring mute/unmute, inactive stop and blocked autoplay', async () => {
    const {sounds,context,repeats,advance} = setup();
    sounds.setPhoneMode('ringing'); assert.equal(repeats.size,0);
    sounds.unlock(); assert.equal(repeats.size,1);
    sounds.configure({systemSounds:false}); assert.equal(repeats.size,0);
    advance(); sounds.configure({}); assert.equal(repeats.size,1);
    sounds.setActive(false); assert.equal(repeats.size,0); assert.equal(sounds.nodes.size,0);
    context.state='suspended'; context.resume=()=>Promise.reject(Error('blocked'));
    sounds.unlock(); await Promise.resolve(); await Promise.resolve(); assert.equal(sounds.play('click'),false);
});
test('sound preferences restore independently and reject invalid values', () => {
    let saved = JSON.stringify({theme:'toxic',crtEffects:false,systemSounds:false,systemSoundVolume:0.6});
    const scope = {window:{ZombThemeSchema:{keys:[]}}, document:{documentElement:{dataset:{},style:{removeProperty(){}}}},localStorage:{getItem:()=>saved,setItem:(_,value)=>{saved=value;}}};
    const source = readFileSync(new URL('../js/settings-state.js',import.meta.url),'utf8');
    vm.runInNewContext(source,scope); const settings = scope.window.ZombSettings;
    assert.equal(settings.get().systemSounds,false); assert.equal(settings.get().systemSoundVolume,0.6);
    settings.apply({theme:'amber'}); assert.equal(settings.get().systemSoundVolume,0.6);
    assert.equal(settings.apply({systemSoundVolume:-1}),false);
    settings.apply({systemSounds:true,systemSoundVolume:0.4}); vm.runInNewContext(source,scope);
    assert.equal(scope.window.ZombSettings.get().systemSoundVolume,0.4); assert.equal(scope.window.ZombSettings.get().crtEffects,false);
});
