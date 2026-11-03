export class PhoneScheduler {
    constructor(state) {
        this.state = state; this.catalog = []; this.activeSeconds = 0; this.active = false; this.lastMono = null;
        this.events = new Map(); this.usedEvents = new Map();
    }
    advance(monotonic) {
        if (this.active && this.lastMono !== null) this.activeSeconds += Math.max(0,monotonic-this.lastMono)/1000;
        this.lastMono = monotonic;
    }
    setActive(active, monotonic) { this.advance(monotonic); this.active = active; }
    event(name) { if (this.active) this.events.set(name,(this.events.get(name)||0)+1); }
    eligible(call, now) {
        const rule = call.delivery, saved = this.state.get(call.callId);
        if (!this.active || !rule.enabled || saved.consumed || now < saved.nextAt || this.activeSeconds < rule.delaySeconds || (rule.at !== null && now < rule.at)) return false;
        if (rule.event && (this.events.get(rule.event)||0) <= (this.usedEvents.get(call.callId)||0)) return false;
        const c = rule.conditions;
        return (c.completed || []).every(id => this.state.get(id).completed) &&
            (c.answered || []).every(id => this.state.get(id).answered) &&
            (c.notCompleted || []).every(id => !this.state.get(id).completed) &&
            (c.events || []).every(name => this.events.has(name));
    }
    queue(now) {
        return this.catalog.filter(call => this.eligible(call,now)).sort((a,b) => b.delivery.priority-a.delivery.priority || (a.callId < b.callId ? -1 : a.callId > b.callId ? 1 : 0));
    }
    take(now) {
        const call = this.queue(now)[0];
        if (call?.delivery.event) this.usedEvents.set(call.callId,this.events.get(call.delivery.event));
        return call;
    }
}
