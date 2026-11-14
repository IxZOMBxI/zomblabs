import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import '../js/storage-recovery.js';
import { PhoneState } from '../js/phone-state.js';
import { PhoneScheduler } from '../js/phone-scheduler.js';
import { PhoneService } from '../js/phone-service.js';
import { normalizeCall } from '../js/phone-rules.js';
import { ZombnetState } from '../js/zombnet-state.js';
import { ArcadeScores } from '../js/arcade-scores.js';
import { BackpackState, BACKPACK_KEY } from '../js/backpack-state.js';
import { products } from '../js/product-catalog.js';
const api=globalThis.ZombStorage, PHONE='zombos.phone.v1', SETTINGS='zombos.settings.v1';
function memory(seed={}) {
    const data=new Map(Object.entries(seed));
    return {data,getItem:key=>data.get(key) ?? null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
}
const backup=(storage,key)=>JSON.parse(storage.getItem('zombos.recovery.'+key));
function settings(storage) {
    const context=vm.createContext({window:{},localStorage:storage,document:{documentElement:{dataset:{},style:{setProperty(){},removeProperty(){}}}}});
    for (const file of ['theme-schema.js','storage-recovery.js','settings-state.js']) vm.runInContext(readFileSync(new URL('../js/'+file,import.meta.url),'utf8'),context);
    return context;
}
const call=normalizeCall({callId:'welcome',caller:'Caller',title:'Recording',src:'recording.mp3',delivery:{once:true,delaySeconds:10,onAttempt:'consume',unlockOn:['ringing']}});

test('corrupt JSON and non-object state are protected, exported, and never overwrite unrelated data',()=>{
    for (const raw of ['{broken','null','[]','42']) {
        const storage=memory({'zombos.zombnet.v1':raw,unrelated:'private'});
        const state=new ZombnetState(storage);
        assert.equal(state.bookmark('zomb://home','Home'),false);
        assert.equal(storage.getItem(state.key),raw);
        assert.deepEqual(backup(storage,state.key),[raw]);
        const exported=api.exportState(storage);
        assert.equal(exported.values[state.key],raw); assert.equal(exported.values.unrelated,undefined);
        assert.equal(storage.getItem('unrelated'),'private');
    }
});

test('partial ZombNET and Arcade recovery retains valid bookmarks, history, and high scores',()=>{
    const storage=memory({'zombos.zombnet.v1':JSON.stringify({bookmarks:[{url:'zomb://home',title:'Saved'},null,{url:'javascript:alert(1)'}],history:[{url:'zomb://radio',title:42}]}),'zombos.arcade.v1':JSON.stringify({'dead-sprint':120,other:45,invalid:-1,bad:'90'})});
    const net=new ZombnetState(storage), scores=new ArcadeScores(storage);
    assert.deepEqual(net.bookmarks,[{url:'zomb://home',title:'Saved'}]);
    assert.equal(net.history[0].title,'zomb://radio'); assert.equal(scores.get('dead-sprint'),120); assert.equal(scores.get('other'),45);
    assert.equal(scores.record('dead-sprint',50),true); assert.equal(scores.get('dead-sprint'),120);
    assert.equal(backup(storage,net.key).length,1); assert.equal(backup(storage,scores.key).length,1);
});

test('legacy theme migration and partial color repair preserve custom identity and valid settings',()=>{
    for (const version of [1,2]) {
        const custom=JSON.parse(readFileSync(new URL(`./fixtures/theme-v${version}.json`,import.meta.url),'utf8'));
        const raw=JSON.stringify({theme:'custom',custom,crtEffects:false,showHiddenFiles:true});
        const storage=memory({[SETTINGS]:raw}), context=settings(storage), value=context.window.ZombSettings.get();
        assert.equal(value.custom.version,3); assert.equal(value.custom.name,custom.name);
        for (const [key,color] of Object.entries(custom.colors)) assert.equal(value.custom.colors[key],color);
        assert.equal(value.crtEffects,false); assert.equal(value.showHiddenFiles,true);
        assert.equal(backup(storage,SETTINGS)[0],raw);
    }
    const storage=memory({[SETTINGS]:JSON.stringify({theme:'custom',custom:{version:3,name:'My theme',colors:{accent:'#123456',storeText:'#abcdef',border:'bad'}},systemSounds:false,systemSoundVolume:'loud'})});
    const context=settings(storage), value=context.window.ZombSettings.get();
    assert.equal(value.custom.name,'My theme'); assert.equal(value.custom.colors.accent,'#123456'); assert.equal(value.custom.colors.storeText,'#abcdef');
    assert.equal(value.systemSounds,false); assert.equal(value.systemSoundVolume,0.25);
    assert.throws(()=>context.window.ZombThemeSchema.validate({version:3,name:'Unsafe import',colors:{accent:'#123456'}}));
});

test('unsupported versions remain untouched and protected from writes',()=>{
    const raw=JSON.stringify({version:99,history:[],delivery:[]}), storage=memory({[PHONE]:raw});
    const state=new PhoneState(storage); state.save();
    assert.equal(state.automaticBlocked,true); assert.equal(storage.getItem(PHONE),raw);
    const themeRaw=JSON.stringify({theme:'custom',custom:{version:99,name:'Future',colors:{}}});
    const themeStorage=memory({[SETTINGS]:themeRaw}), context=settings(themeStorage);
    assert.equal(context.window.ZombSettings.apply({theme:'amber'}),false);
    assert.equal(themeStorage.getItem(SETTINGS),themeRaw);
    assert.match(context.ZombStorage.inspect(themeStorage).find(row=>row.key===SETTINGS).message,/version/);
});

test('PHONE corruption pauses automatic delivery across reload while retaining valid unlocked and consumed records',()=>{
    const storage=memory(); let state=new PhoneState(storage);
    const row=state.begin(call,1000); state.finish(row,call,'declined',2000);
    const raw=JSON.parse(storage.getItem(PHONE)); raw.history.push({bad:true}); raw.delivery.push(['other',{consumed:true,unlocked:true,attempts:1,nextAt:'invalid'}]);
    storage.setItem(PHONE,JSON.stringify(raw));
    state=new PhoneState(storage); state.recover([call],3000);
    assert.equal(state.automaticBlocked,true); assert.equal(state.get(call.callId).consumed,true); assert.equal(state.get(call.callId).unlocked,true);
    assert.equal(state.get('other').consumed,true); assert.equal(state.get('other').unlocked,true);
    const scheduler=new PhoneScheduler(state); scheduler.catalog=[call]; scheduler.setActive(true,0); scheduler.advance(100000);
    assert.equal(scheduler.take(100000),undefined);
    const reloaded=new PhoneState(memory(Object.fromEntries(storage.data)));
    assert.equal(reloaded.automaticBlocked,true); assert.equal(reloaded.history.length,1); assert.equal(reloaded.get('welcome').unlocked,true);
});

test('valid PHONE attempts do not acquire a hold and completion evidence restores consumed state',()=>{
    const storage=memory(), state=new PhoneState(storage);
    const row=state.begin(call,1000); state.finish(row,call,'declined',2000);
    const restored=new PhoneState(storage); restored.recover([call],3000);
    assert.equal(restored.automaticBlocked,false); assert.equal(restored.get('welcome').consumed,true);
    const standard=normalizeCall({...call,callId:'standard',delivery:{once:true}});
    const completed=restored.begin(standard,4000); restored.answer(completed); restored.finish(completed,standard,'completed',5000);
    const raw=JSON.parse(storage.getItem(PHONE)); raw.delivery=raw.delivery.filter(([id])=>id!=='standard'); storage.setItem(PHONE,JSON.stringify(raw));
    const recovered=new PhoneState(storage); recovered.recover([call,standard],6000);
    assert.equal(recovered.get('standard').consumed,true); assert.equal(recovered.get('standard').unlocked,true);
});

test('backpack repair preserves usable quantities and absent catalog products without enabling checkout',()=>{
    const raw=JSON.stringify({version:1,mode:'demo',items:[{id:products[0].id,quantity:3},{id:'removed-product',quantity:4},{id:products[1].id,quantity:999},null]});
    const storage=memory({[BACKPACK_KEY]:raw}), bag=new BackpackState(products,storage);
    assert.equal(bag.count,3); bag.transfer(products[0].id);
    assert.deepEqual(JSON.parse(storage.getItem(BACKPACK_KEY)).items,[{id:'removed-product',quantity:4},{id:products[0].id,quantity:4}]);
    assert.equal(backup(storage,BACKPACK_KEY)[0],raw);
    for (const saved of [{version:2,mode:'demo',items:[]},{version:1,mode:'real',items:[]}]) {
        const raw=JSON.stringify(saved), storage=memory({[BACKPACK_KEY]:raw}), bag=new BackpackState(products,storage);
        bag.transfer(products[0].id); assert.equal(bag.persistent,false); assert.equal(storage.getItem(BACKPACK_KEY),raw);
    }
});

test('denied reads and quota failures keep applications usable without overwriting originals',()=>{
    const denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');},removeItem(){throw Error('denied');}};
    assert.equal(new PhoneState(denied).automaticBlocked,true);
    assert.equal(new ZombnetState(denied).visit('zomb://home','Home'),false);
    assert.equal(settings(denied).window.ZombSettings.get().theme,'toxic');
    assert.equal(api.inspect(denied)[0].status,'unavailable');
    const storage=memory({'zombos.arcade.v1':'{"dead-sprint":50,"bad":-1}'}), raw=storage.getItem('zombos.arcade.v1');
    storage.setItem=()=>{throw Error('quota');};
    const scores=new ArcadeScores(storage); assert.equal(scores.get('dead-sprint'),50); assert.equal(scores.record('dead-sprint',60),false);
    assert.equal(scores.get('dead-sprint'),60); assert.equal(storage.getItem(scores.key),raw);
    assert.equal(api.exportState(storage).values[scores.key],raw);
});

test('confirmed resets affect only exact owned keys, back up first, and block stale writers',()=>{
    const storage=memory({'zombos.arcade.v1':'{"dead-sprint":40}',[PHONE]:'{"version":1,"history":[],"delivery":[]}',unrelated:'keep','zombos.unknown':'keep'});
    const scores=new ArcadeScores(storage);
    assert.throws(()=>api.reset(storage,scores.key,'yes')); assert.equal(scores.get('dead-sprint'),40);
    api.reset(storage,scores.key,'RESET Arcade scores');
    assert.equal(storage.getItem(scores.key),null); assert.equal(scores.record('dead-sprint',60),false);
    assert.ok(storage.getItem(PHONE)); assert.equal(storage.getItem('unrelated'),'keep'); assert.equal(backup(storage,scores.key)[0],'{"dead-sprint":40}');
    api.reset(storage,'all','RESET ALL ZOMBOS');
    assert.equal(storage.getItem(PHONE),null); assert.equal(storage.getItem('zombos.unknown'),'keep'); assert.equal(storage.getItem('unrelated'),'keep');
    assert.ok(storage.getItem('zombos.recovery.'+PHONE));
    assert.throws(()=>api.reset(storage,'unrelated','RESET undefined'));
});

test('failed reset backup leaves all targeted data intact',()=>{
    const storage=memory({[PHONE]:'broken','zombos.arcade.v1':'{"dead-sprint":50}'}), before=Object.fromEntries(storage.data);
    storage.setItem=()=>{throw Error('quota');};
    assert.throws(()=>api.reset(storage,'all','RESET ALL ZOMBOS'));
    assert.deepEqual(Object.fromEntries(storage.data),before);
});

test('PHONE never announces an incoming attempt that cannot be persisted',()=>{
    const storage=memory(); storage.setItem=()=>{throw Error('quota');};
    class Audio extends EventTarget { pause() {} removeAttribute() {} load() {} }
    const service=new PhoneService({storage,audio:new Audio(),radio:{},now:()=>1000,monotonic:()=>1000});
    service.setCatalog([{section:'calls',callId:'test',caller:'Caller',src:'test.mp3',delivery:{}}]);
    const modes=[]; service.subscribe(()=>modes.push(service.mode));
    service.setActive(true); service.tick(); service.tick();
    assert.equal(modes.includes('ringing'),false); assert.equal(service.state.automaticBlocked,true);
    assert.match(service.error,/could not be saved/); service.dispose();
});


test('backup-full reset requires an explicit verified-export override and exact confirmation',()=>{
    const storage=memory({'zombos.arcade.v1':'{"dead-sprint":90}',unrelated:'keep'});
    const exported=api.exportState(storage); assert.equal(exported.errors.length,0);
    storage.setItem=()=>{throw Error('quota');};
    assert.throws(()=>api.reset(storage,'zombos.arcade.v1','RESET Arcade scores'));
    assert.throws(()=>api.reset(storage,'zombos.arcade.v1','yes',{backupExported:true}));
    api.reset(storage,'zombos.arcade.v1','RESET Arcade scores',{backupExported:true});
    assert.equal(storage.getItem('zombos.arcade.v1'),null); assert.equal(storage.getItem('unrelated'),'keep');
    assert.equal(exported.values['zombos.arcade.v1'],'{"dead-sprint":90}');
});
