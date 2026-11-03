import { normalizeCall } from './phone-rules.js';
import { PhoneState } from './phone-state.js';
import { PhoneScheduler } from './phone-scheduler.js';

// One service per desktop. Windows only subscribe; they never own the scheduler/audio.
export class PhoneService extends EventTarget {
    constructor({radio, storage, audio = new Audio(), now = () => Date.now(), monotonic = () => performance.now()}) {
        super(); this.radio = radio; this.audio = audio; this.now = now; this.monotonic = monotonic;
        this.state = new PhoneState(storage); this.scheduler = new PhoneScheduler(this.state);
        this.catalog = []; this.mode = 'idle'; this.current = null; this.attempt = null;
        this.error = ''; this.ready = false; this.request = 0; this.handlers = [];
        audio.preload = 'none';
        const listen = (event, handler) => { audio.addEventListener(event,handler); this.handlers.push([event,handler]); };
        for (const event of ['timeupdate','durationchange','play','pause','loadedmetadata','waiting','playing']) listen(event,() => this.emit());
        listen('ended',() => { if (this.mode === 'connected') this.finish('completed'); else if (this.mode === 'replay') this.stopReplay(); });
        listen('error',() => {
            if (!['connected','replay'].includes(this.mode)) return;
            this.disconnect('interrupted'); this.error = 'Recording unavailable: missing file, network failure, or unsupported audio. Retry from Call History.'; this.emit();
        });
    }
    emit() { this.dispatchEvent(new Event('change')); }
    subscribe(listener) { this.addEventListener('change',listener); listener(); return () => this.removeEventListener('change',listener); }
    setCatalog(entries) {
        const calls = [], ids = new Set(), duplicates = new Set();
        let invalid = false;
        for (const entry of entries.filter(entry => entry.section === 'calls')) {
            try {
                const call = normalizeCall(entry);
                if (ids.has(call.callId)) duplicates.add(call.callId);
                ids.add(call.callId); calls.push(call);
            } catch { invalid = true; }
        }
        this.catalog = calls.filter(call => !duplicates.has(call.callId));
        this.scheduler.catalog = this.catalog;
        this.state.recover(this.catalog,this.now()); this.ready = true;
        if (invalid || duplicates.size) this.error = 'Some call metadata is invalid. Those calls are disabled.';
        this.emit();
    }
    setActive(active) {
        this.scheduler.setActive(active,this.monotonic());
        if (!active) {
            if (this.mode === 'ringing') this.finish('missed',false);
            else if (['connected','replay'].includes(this.mode)) { ++this.request; this.audio.pause(); this.emit(); }
        }
    }
    event(name) { this.scheduler.event(name); }
    tick() {
        this.scheduler.advance(this.monotonic());
        if (!this.scheduler.active || !this.ready) return;
        if (this.mode === 'ringing' && this.now() >= this.ringUntil) this.finish('missed');
        if (this.mode !== 'idle') return;
        const call = this.scheduler.take(this.now());
        if (!call) return;
        this.current = call; this.mode = 'ringing'; this.error = '';
        this.attempt = this.state.begin(call,this.now());
        this.ringUntil = this.now() + call.delivery.ringSeconds*1000;
        this.emit();
    }
    answer() {
        if (this.mode !== 'ringing' || !this.scheduler.active) return;
        this.state.answer(this.attempt); this.mode = 'connected';
        this.startAudio();
    }
    decline() { if (this.mode === 'ringing') this.finish('declined'); }
    end() { if (this.mode === 'connected') this.finish('interrupted'); }
    startAudio() {
        this.releaseRadio ||= this.radio.holdForPhone();
        this.audio.src = this.current.src; this.audio.load(); this.play();
    }
    async play() {
        if (!['connected','replay'].includes(this.mode) || !this.scheduler.active) return;
        this.releaseRadio ||= this.radio.holdForPhone();
        const request = ++this.request; this.error = ''; this.emit();
        try { await this.audio.play(); }
        catch (error) {
            if (request !== this.request) return;
            if (error.name === 'NotAllowedError') this.error = 'Press Resume to allow playback in this browser.';
            else { this.disconnect('interrupted'); this.error = 'Recording could not play. Retry from Call History.'; }
            this.emit();
        }
    }
    pause() { ++this.request; this.audio.pause(); this.emit(); }
    seek(value) { if (['connected','replay'].includes(this.mode) && Number.isFinite(value) && Number.isFinite(this.audio.duration)) this.audio.currentTime = Math.max(0,Math.min(value,this.audio.duration)); }
    replay(callId) {
        if (['ringing','connected'].includes(this.mode) || !this.scheduler.active || !this.state.get(callId).unlocked) return;
        const call = this.catalog.find(entry => entry.callId === callId);
        if (!call) { this.error = 'This recording is no longer available.'; this.emit(); return; }
        ++this.request; this.audio.pause(); this.current = call; this.mode = 'replay'; this.startAudio();
    }
    stopReplay() { if (this.mode === 'replay') { this.disconnect(); this.emit(); } }
    disconnect(outcome, restore = this.scheduler.active) {
        ++this.request;
        if (this.attempt && outcome) {
            this.state.finish(this.attempt,this.current,outcome,this.now());
            const policy = this.current.delivery[`on${outcome[0].toUpperCase()}${outcome.slice(1)}`];
            if (outcome !== 'completed' && policy === 'retry') this.scheduler.usedEvents.delete(this.current.callId);
        }
        this.attempt = null; this.current = null; this.mode = 'idle';
        this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load();
        const release = this.releaseRadio; this.releaseRadio = null; release?.(restore);
    }
    finish(outcome, restore = this.scheduler.active) { this.disconnect(outcome,restore); this.emit(); }
    closeWindow() {
        if (this.mode === 'ringing') this.finish('missed');
        else if (this.mode === 'connected') this.end();
        else this.stopReplay();
    }
    dispose() {
        this.disconnect(this.mode === 'ringing' ? 'missed' : 'interrupted',false);
        for (const [event,handler] of this.handlers) this.audio.removeEventListener(event,handler);
    }
}
