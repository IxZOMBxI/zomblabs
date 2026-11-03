import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeCall, scheduledInstant } from '../js/phone-rules.js';
import { PhoneState } from '../js/phone-state.js';
import { PhoneScheduler } from '../js/phone-scheduler.js';
import { PhoneService } from '../js/phone-service.js';
import { AudioService } from '../js/audio-service.js';

class FakeAudio extends EventTarget {
    constructor() { super(); this.paused=true; this.currentTime=0; this.duration=20; this.src=''; this.plays=0; }
    load() { this.currentTime=0; }
    async play() { this.plays++; if (this.failure) throw this.failure; this.paused=false; this.dispatchEvent(new Event('play')); }
    pause() { this.paused=true; this.dispatchEvent(new Event('pause')); }
    removeAttribute() { this.src=''; }
    end() { this.paused=true; this.dispatchEvent(new Event('ended')); }
}
const entry = (id='test-call',delivery={}) => ({id:`calls/${id}.mp3`,callId:id,caller:'Test caller',title:'Test recording',section:'calls',src:`https://local.test/media/calls/${id}.mp3`,artwork:null,delivery});
const memory = () => { const values=new Map(); return {getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}; };
function setup(entries=[entry()],storage=memory()) {
    let clock=100000, mono=0;
    const radio={holds:0,releases:[],holdForPhone(){this.holds++; return restore=>this.releases.push(restore);}};
    const audio=new FakeAudio();
    const service=new PhoneService({radio,audio,storage,now:()=>clock,monotonic:()=>mono});
    service.setCatalog(entries);
    return {service,audio,radio,storage,advance(seconds){clock+=seconds*1000;mono+=seconds*1000;service.tick();}};
}

test('strict delivery validation, explicit time zones and DST',()=>{
    assert.equal(normalizeCall({...entry(),delivery:null}).delivery.enabled,false);
    assert.equal(scheduledInstant({at:'2026-11-02T12:00:00',timeZone:'America/Chicago'}),Date.parse('2026-11-02T18:00:00Z'));
    assert.equal(scheduledInstant({at:'2026-07-02T12:00:00',timeZone:'America/Chicago'}),Date.parse('2026-07-02T17:00:00Z'));
    for (const schedule of [{at:'2026-03-08T02:30:00',timeZone:'America/Chicago'},{at:'2026-11-01T01:30:00',timeZone:'America/Chicago'},{at:'2026-02-30T12:00:00',timeZone:'UTC'},{at:'2026-11-02T12:00:00',timeZone:'Invalid/Zone'}]) assert.throws(()=>scheduledInstant(schedule));
    for (const delivery of [{once:'false'},{delaySeconds:-1},{event:[]},{unknown:1},{conditions:{answered:'id'}},{unlockOn:['everything']},{onMissed:'ignore'}]) assert.throws(()=>normalizeCall(entry('bad',delivery)));
});
test('boot/inactive gate, active-session delay, deterministic queue and event conditions',()=>{
    const {service,advance}=setup([entry('b',{delaySeconds:10,event:'app.open:radio'}),entry('a',{delaySeconds:10,event:'app.open:radio'})]);
    advance(100); assert.equal(service.mode,'idle');
    service.event('app.open:radio'); service.setActive(true); advance(5);
    service.setActive(false); advance(100); service.setActive(true); advance(5); assert.equal(service.mode,'idle');
    service.event('app.open:radio'); service.tick(); assert.equal(service.current.callId,'a');
    assert.equal(service.state.history.length,1); service.tick(); assert.equal(service.state.history.length,1);
    service.decline(); service.tick(); assert.equal(service.current.callId,'b');
});
test('answered unlock, completion-only consumption, replay leaves original outcomes intact',async()=>{
    const {service,audio,radio,storage}=setup(); service.setActive(true); service.tick();
    assert.equal(audio.plays,0); assert.equal(service.state.get('test-call').consumed,false);
    service.answer(); assert.equal(service.state.get('test-call').unlocked,true); assert.equal(radio.holds,1);
    service.end(); assert.equal(service.state.history[0].status,'interrupted'); assert.equal(service.state.get('test-call').consumed,false);
    const history=JSON.stringify(service.state.history); service.replay('test-call'); service.pause(); service.seek(8); assert.equal(audio.currentTime,8); await service.play(); audio.end();
    assert.equal(JSON.stringify(service.state.history),history); assert.equal(service.state.get('test-call').consumed,false);
    const restored=setup([entry()],storage); restored.service.setActive(true); restored.advance(301); restored.service.answer(); restored.audio.end();
    assert.equal(restored.service.state.get('test-call').consumed,true); assert.equal(restored.service.state.history.at(-1).status,'completed');
    restored.advance(10000); assert.equal(restored.service.mode,'idle');
    assert.equal(new PhoneState(storage).get('test-call').completed,true);
});
test('declined/missed policies, retry cooldown and history locks',()=>{
    const {service,advance}=setup([entry('retry',{event:'desktop.ready',retrySeconds:10,ringSeconds:5})]);
    service.setActive(true);service.event('desktop.ready');service.tick();service.decline();
    assert.equal(service.state.get('retry').unlocked,false);advance(9);assert.equal(service.mode,'idle');advance(1);assert.equal(service.mode,'ringing');
    service.setActive(false);assert.equal(service.state.history.at(-1).status,'missed');advance(60);assert.equal(service.mode,'idle');
    const consumed=setup([entry('consume',{onDeclined:'consume',unlockOn:['declined']})]);consumed.service.setActive(true);consumed.service.tick();consumed.service.decline();
    assert.equal(consumed.service.state.get('consume').consumed,true);assert.equal(consumed.service.state.get('consume').unlocked,true);assert.equal(consumed.service.state.get('consume').answered,false);
});
test('scheduled calls, completion dependencies, repeats and event rearming',()=>{
    const state=new PhoneState(memory()),scheduler=new PhoneScheduler(state);scheduler.setActive(true,0);
    scheduler.catalog=[normalizeCall(entry('scheduled',{schedule:{at:'2026-11-02T12:00:00',timeZone:'America/Chicago'}}))];
    assert.equal(scheduler.queue(Date.parse('2026-11-02T17:59:59Z')).length,0);assert.equal(scheduler.queue(Date.parse('2026-11-02T18:00:00Z')).length,1);
    const {service,audio,advance}=setup([entry('first',{once:false,cooldownSeconds:10,event:'app.open:radio'}),entry('second',{conditions:{completed:['first']}})]);
    service.setActive(true);service.event('app.open:radio');service.tick();service.answer();audio.end();service.tick();assert.equal(service.current.callId,'second');service.decline();
    advance(11);assert.equal(service.mode,'idle');service.event('app.open:radio');service.tick();assert.equal(service.current.callId,'first');
});
test('refresh resolves pending attempts, denied/corrupt storage and duplicate IDs',()=>{
    for (const answered of [false,true]) {
        const s=setup([entry('pending',{onInterrupted:'consume'})]);s.service.setActive(true);s.service.tick();if(answered)s.service.answer();
        const reload=setup([entry('pending',{onInterrupted:'consume'})],s.storage);
        assert.equal(reload.service.state.history[0].status,answered?'interrupted':'missed');
        assert.equal(reload.service.state.get('pending').consumed,answered);
    }
    const denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
    const s=setup([entry()],denied);s.service.setActive(true);s.service.tick();s.service.answer();assert.equal(s.service.state.persistent,false);
    assert.equal(setup([entry(),entry()]).service.catalog.length,0);
    const corrupt={getItem:()=>'{oops',setItem(){}};assert.equal(new PhoneState(corrupt).history.length,0);
});
test('media failures and window closure release audio; replay cannot answer locked calls',async()=>{
    const {service,audio,radio}=setup();service.setActive(true);service.tick();service.replay('test-call');assert.equal(audio.plays,0);
    service.answer();audio.dispatchEvent(new Event('error'));assert.equal(service.mode,'idle');assert.match(service.error,/unavailable/);assert.equal(radio.releases.length,1);
    service.replay('test-call');service.closeWindow();assert.equal(service.mode,'idle');assert.equal(radio.releases.length,2);
    service.replay('test-call');service.setActive(false);assert.equal(audio.paused,true);service.dispose();assert.equal(radio.releases.at(-1),false);
    audio.end();assert.equal(service.mode,'idle');
    const blocked=setup();blocked.service.setActive(true);blocked.service.tick();blocked.audio.failure={name:'NotAllowedError'};blocked.service.answer();await Promise.resolve();
    assert.equal(blocked.service.mode,'connected');assert.match(blocked.service.error,/Resume/);blocked.service.end();
});
test('Radio lease preserves track/position, blocks overlap, respects explicit pause',async()=>{
    globalThis.Audio=FakeAudio;
    const radio=new AudioService([{src:'music-one'},{src:'music-two'}]);await radio.play();radio.audio.currentTime=7;
    const release=radio.holdForPhone();assert.equal(radio.audio.paused,true);
    await radio.play();radio.select(1,true);radio.seek(0);assert.equal(radio.index,0);assert.equal(radio.audio.currentTime,7);assert.equal(radio.audio.paused,true);
    release();assert.equal(radio.audio.paused,false);assert.equal(radio.audio.currentTime,7);
    const release2=radio.holdForPhone();radio.pause();release2();assert.equal(radio.audio.paused,true);
    delete globalThis.Audio;
});
