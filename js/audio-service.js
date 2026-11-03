export class AudioService extends EventTarget {
    constructor(catalog) {
        super();
        this.catalog = catalog;
        this.audio = new Audio();
        this.audio.preload = 'metadata';
        this.index = 0;
        this.shuffle = false;
        this.repeat = 'off';
        this.error = '';
        this.loading = false;
        this.request = 0;
        for (const event of ['timeupdate', 'durationchange', 'play', 'pause', 'volumechange', 'loadedmetadata']) {
            this.audio.addEventListener(event, () => this.emit());
        }
        this.audio.addEventListener('waiting', () => { this.loading = true; this.emit(); });
        this.audio.addEventListener('playing', () => { this.loading = false; this.error = ''; this.emit(); });
        this.audio.addEventListener('canplay', () => { this.loading = false; this.emit(); });
        this.audio.addEventListener('error', () => {
            this.loading = false;
            this.error = 'SIGNAL UNAVAILABLE: missing file, network failure, or unsupported audio. Choose another recording or retry Play.';
            this.emit();
        });
        this.audio.addEventListener('ended', () => {
            if (this.repeat === 'one') { this.audio.currentTime = 0; this.play(); }
            else this.next(true);
        });
    }
    get track() { return this.catalog[this.index]; }
    emit() { this.dispatchEvent(new Event('change')); }
    subscribe(listener) { this.addEventListener('change', listener); listener(); return () => this.removeEventListener('change', listener); }
    async play() {
        if (this.hold) { this.error = 'Phone is using audio. End the call or stop replay first.'; this.emit(); return; }
        if (!this.track) return;
        this.enableAnalyzer();
        const request = ++this.request;
        if (!this.audio.src || this.audio.error) { this.audio.src = this.track.src; this.audio.load(); }
        this.error = ''; this.loading = true; this.emit();
        try { await this.audio.play(); }
        catch (error) {
            if (request !== this.request) return;
            this.loading = false;
            this.error = error.name === 'NotAllowedError' ? 'Press Play to enable audio in this browser.' : 'Unable to play this recording. Retry or select another track.';
            this.emit();
        }
    }
    enableAnalyzer() {
        const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Context || this.visualizationUnavailable) return;
        try {
            if (!this.context) {
                this.context = new Context();
                this.analyzer = this.context.createAnalyser();
                this.analyzer.fftSize = 256;
                this.source = this.context.createMediaElementSource(this.audio);
                // Direct output stays independent of the visualization branch.
                this.source.connect(this.context.destination);
                this.source.connect(this.analyzer);
            }
            this.context.resume().catch(() => { this.visualizationUnavailable = true; });
        } catch {
            this.visualizationUnavailable = true;
            if (this.source && this.context) {
                try { this.source.connect(this.context.destination); } catch { /* Already connected. */ }
            }
        }
    }
    // Phone owns a temporary exclusive audio lease; keep Radio's source and position.
    holdForPhone() {
        if (this.hold) return () => {};
        const resume = !this.audio.paused || this.loading;
        this.pause();
        const hold = { resume }; this.hold = hold;
        return (restore = true) => {
            if (this.hold !== hold) return;
            this.hold = null; this.error = ''; this.emit();
            if (restore && hold.resume) this.play();
        };
    }
    stop() { this.pause(); if (!this.hold) this.seek(0); this.emit(); }
    pause() { if (this.hold) this.hold.resume = false; ++this.request; this.audio.pause(); this.loading = false; this.emit(); }
    select(index, play = false) {
        if (this.hold) { this.error = 'Phone is using audio. End the call or stop replay first.'; this.emit(); return; }
        if (!this.catalog[index]) return;
        this.pause(); this.index = index; this.error = '';
        this.audio.src = this.track.src; this.audio.load(); this.emit();
        if (play) this.play();
    }
    next(automatic = false) {
        if (!this.catalog.length) return;
        let index = this.index + 1;
        if (this.shuffle && this.catalog.length > 1) index = (this.index + 1 + Math.floor(Math.random() * (this.catalog.length - 1))) % this.catalog.length;
        else if (index >= this.catalog.length) {
            if (automatic && this.repeat === 'off') { this.emit(); return; }
            index = 0;
        }
        this.select(index, automatic || !this.audio.paused);
    }
    previous() { this.select((this.index + this.catalog.length - 1) % this.catalog.length, !this.audio.paused); }
    seek(value) { if (!this.hold && Number.isFinite(this.audio.duration)) this.audio.currentTime = Math.max(0, Math.min(value, this.audio.duration)); }
    setVolume(value) { this.audio.volume = Math.max(0, Math.min(1, value)); }
    toggleMute() { this.audio.muted = !this.audio.muted; }
    toggleShuffle() { this.shuffle = !this.shuffle; this.emit(); }
    cycleRepeat() { this.repeat = { off: 'all', all: 'one', one: 'off' }[this.repeat]; this.emit(); }
}
