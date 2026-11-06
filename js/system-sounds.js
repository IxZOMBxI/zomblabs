// Short synthesized cues only: never takes ownership of Radio/Phone media.
const cues = {
    boot: [440, 660, 880], open: [520, 780], close: [520, 330],
    minimize: [600, 400], maximize: [400, 700], restore: [700, 500],
    click: [900], error: [220, 165], notification: [660, 880],
    discovery: [440, 660, 990], ring: [740, 980, 740, 980]
};
export class SystemSounds {
    constructor({createContext = () => new (globalThis.AudioContext || globalThis.webkitAudioContext)(), now = () => performance.now(), repeat = (fn, ms) => globalThis.setInterval(fn, ms), cancel = id => globalThis.clearInterval(id)} = {}) {
        Object.assign(this, {createContext, now, repeat, cancel});
        this.enabled = true; this.volume = 0.25; this.active = true;
        this.phoneMode = 'idle'; this.nodes = new Set(); this.serial = 0; this.last = -Infinity;
    }
    configure({systemSounds = true, systemSoundVolume = 0.25}) {
        this.enabled = systemSounds === true;
        this.volume = Number.isFinite(systemSoundVolume) ? Math.max(0, Math.min(1, systemSoundVolume)) : 0.25;
        if (this.master) this.master.gain.value = this.enabled ? this.volume * 0.12 : 0;
        if (!this.enabled || !this.volume) this.stop();
        this.syncRing();
    }
    unlock() {
        if (this.disposed || !this.enabled || !this.volume) return;
        try {
            if (!this.context) {
                this.context = this.createContext(); this.master = this.context.createGain();
                this.master.gain.value = this.volume * 0.12; this.master.connect(this.context.destination);
            }
            if (this.context.state === 'suspended') this.context.resume().then(() => this.syncRing()).catch(() => {});
            this.syncRing();
        } catch { /* Unsupported or blocked audio must never affect the desktop. */ }
    }
    play(name) {
        const notes = cues[name];
        if (!notes || this.disposed || !this.active || !this.enabled || !this.volume || this.context?.state !== 'running' || ['connected','replay'].includes(this.phoneMode)) return false;
        if (this.phoneMode === 'ringing' && name !== 'ring') return false;
        const now = this.now();
        if (now - this.last < 100) return false;
        this.last = now; this.serial++; this.stop();
        const start = this.context.currentTime, step = name === 'click' ? 0.025 : 0.075;
        notes.forEach((frequency, index) => {
            const oscillator = this.context.createOscillator(), gain = this.context.createGain();
            const at = start + index * step;
            oscillator.type = 'triangle'; oscillator.frequency.value = frequency;
            gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(0.7, at + 0.004);
            gain.gain.exponentialRampToValueAtTime(0.001, at + step - 0.003);
            oscillator.connect(gain); gain.connect(this.master); this.nodes.add(oscillator);
            oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.nodes.delete(oscillator); };
            oscillator.start(at); oscillator.stop(at + step);
        });
        return true;
    }
    stop() { for (const node of this.nodes) { try { node.stop(); } catch {} node.disconnect(); } this.nodes.clear(); }
    setActive(active) { this.active = active; if (!active) this.stop(); this.syncRing(); }
    setPhoneMode(mode) {
        if (mode === this.phoneMode) return;
        this.phoneMode = mode; this.stop(); this.syncRing();
    }
    syncRing() {
        const ringing = !this.disposed && this.active && this.enabled && this.volume > 0 && this.phoneMode === 'ringing' && this.context?.state === 'running';
        if (!ringing) { if (this.timer !== undefined) this.cancel(this.timer); this.timer = undefined; return; }
        if (this.timer !== undefined) return;
        this.play('ring'); this.timer = this.repeat(() => this.play('ring'), 2200);
    }
    // Capture once, then let a semantic window action supersede the generic click.
    bind(target) {
        const unlock = event => { if (event.isTrusted) this.unlock(); };
        const click = event => {
            if (!event.isTrusted || !event.target.closest?.('button, input[type="button"], input[type="submit"], [role="button"]') || event.target.closest('[disabled], [aria-disabled="true"]')) return;
            this.unlock(); const serial = this.serial;
            setTimeout(() => { if (!event.defaultPrevented && serial === this.serial) this.play('click'); }, 0);
        };
        const invalid = () => this.play('error');
        target.addEventListener('pointerdown', unlock, true); target.addEventListener('keydown', unlock, true);
        target.addEventListener('click', click, true); target.addEventListener('invalid', invalid, true);
        return () => {
            target.removeEventListener('pointerdown', unlock, true); target.removeEventListener('keydown', unlock, true);
            target.removeEventListener('click', click, true); target.removeEventListener('invalid', invalid, true);
        };
    }
    dispose() { this.disposed = true; this.stop(); this.syncRing(); this.context?.close().catch(() => {}); }
}
