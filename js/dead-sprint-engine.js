export const sprintConfig = Object.freeze({ minimum: 4, maximum: 14, burst: 1.7, decay: 2.5, startGap: 17, escapeGap: 42 });
export class DeadSprint {
    constructor(config = sprintConfig) { this.config = config; this.mode = 'ready'; this.score = 0; this.speed = config.minimum; this.gap = config.startGap; this.elapsed = 0; this.capture = 0; }
    start() { this.mode = 'running'; this.score = 0; this.speed = this.config.minimum; this.gap = this.config.startGap; this.elapsed = 0; this.capture = 0; }
    input() {
        if (this.mode === 'ready' || this.mode === 'over') { this.start(); return; }
        if (this.mode === 'paused') { this.mode = 'running'; return; }
        this.speed = Math.min(this.config.maximum, this.speed + this.config.burst);
    }
    pause() { if (this.mode === 'running') this.mode = 'paused'; }
    get targetSpeed() { return 6 + 5 * (1 - Math.exp(-this.score / 180)); }
    step(dt) {
        if (this.mode !== 'running') return;
        dt = Math.max(0, Math.min(dt, 0.05));
        this.elapsed += dt;
        this.speed = Math.max(this.config.minimum, this.speed - this.config.decay * dt);
        if (this.capture > 0) { this.capture -= dt; if (this.capture <= 0) this.gap = this.config.startGap; return; }
        this.gap += (this.targetSpeed - this.speed) * dt;
        if (this.gap <= 0) { this.gap = 0; this.score += 10; this.capture = .65; }
        else if (this.gap >= this.config.escapeGap) this.mode = 'over';
    }
}
