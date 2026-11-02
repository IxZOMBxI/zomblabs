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
        if (!this.track) return;
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
    pause() { ++this.request; this.audio.pause(); this.loading = false; this.emit(); }
    select(index, play = false) {
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
    seek(value) { if (Number.isFinite(this.audio.duration)) this.audio.currentTime = Math.max(0, Math.min(value, this.audio.duration)); }
    setVolume(value) { this.audio.volume = Math.max(0, Math.min(1, value)); }
    toggleMute() { this.audio.muted = !this.audio.muted; }
    toggleShuffle() { this.shuffle = !this.shuffle; this.emit(); }
    cycleRepeat() { this.repeat = { off: 'all', all: 'one', one: 'off' }[this.repeat]; this.emit(); }
}
