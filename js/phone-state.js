import './storage-recovery.js';
const KEY = 'zombos.phone.v1';
const outcomes = ['ringing','answered','declined','missed','completed','interrupted'];
const finite = value => Number.isFinite(value) && value >= 0;
const id = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
const label = value => typeof value === 'string' ? value.slice(0,200) : '';
export class PhoneState {
    constructor(storage) {
        this.storage = storage; this.history = []; this.delivery = new Map(); this.sequence = 0; this.persistent = true;
        this.recovery = globalThis.ZombStorage.open(KEY,storage);
        const saved = this.recovery.read(value => {
            const history = Array.isArray(value.history) ? value.history.filter(row => row && Number.isSafeInteger(row.id) && row.id > 0 && id(row.callId) && finite(row.at) && outcomes.includes(row.status)).slice(-200).map(row => ({
                id:row.id, callId:row.callId, at:row.at, endedAt:finite(row.endedAt) ? row.endedAt : null,
                caller:label(row.caller), extension:label(row.extension), title:label(row.title), status:row.status, answered:row.answered === true || ['answered','completed'].includes(row.status)
            })) : [];
            const delivery = new Map();
            if (Array.isArray(value.delivery)) for (const pair of value.delivery.slice(0,5000)) {
                if (!Array.isArray(pair) || !id(pair[0]) || !globalThis.ZombStorage.object(pair[1])) continue;
                const row = pair[1], previous = delivery.get(pair[0]) || {};
                delivery.set(pair[0], {consumed:previous.consumed || row.consumed === true, unlocked:previous.unlocked || row.unlocked === true || row.answered === true || row.completed === true,
                    completed:previous.completed || row.completed === true, answered:previous.answered || row.answered === true, nextAt:Math.max(previous.nextAt || 0,finite(row.nextAt) ? row.nextAt : 0),
                    attempts:Math.max(previous.attempts || 0,Number.isSafeInteger(row.attempts) && row.attempts >= 0 ? row.attempts : 0)});
            }
            return {version:1,history,delivery:[...delivery],...(value.recoveryHold ? {recoveryHold:true} : {})};
        },{version:1,phone:true});
        this.recoveryHold = saved?.recoveryHold === true;
        this.automaticBlocked = this.recovery.blocked || this.recoveryHold;
        this.persistent = !this.recovery.blocked;
        if (saved) { this.history=saved.history; this.delivery=new Map(saved.delivery); }
        this.sequence = Math.max(0,...this.history.map(row=>row.id));
    }
    get(callId) { return this.delivery.get(callId) || {consumed:false, unlocked:false, completed:false, answered:false, nextAt:0, attempts:0}; }
    save() {
        try {
            if (!this.storage) throw Error('Storage unavailable');
            this.recovery.write({version:1, history:this.history, delivery:[...this.delivery],...(this.recoveryHold ? {recoveryHold:true} : {})});
            this.persistent = true;
        } catch { this.persistent = false; }
    }
    begin(call, now) {
        const row = {id:++this.sequence, callId:call.callId, caller:call.caller, extension:call.extension || '', title:call.title, at:now, endedAt:null, status:'ringing', answered:false};
        this.history.push(row); this.history = this.history.slice(-200);
        const previous = this.get(call.callId), rule = call.delivery || {};
        this.delivery.set(call.callId,{...previous, attempts:previous.attempts+1,
            consumed:previous.consumed || (rule.once !== false && rule.onAttempt === 'consume'),
            unlocked:previous.unlocked || (rule.unlockOn || []).includes('ringing')}); this.save();
        return row;
    }
    answer(row) {
        row.status = 'answered'; row.answered = true;
        this.delivery.set(row.callId,{...this.get(row.callId),unlocked:true,answered:true}); this.save();
    }
    finish(row, call, outcome, now) {
        row.status = outcome; row.endedAt = now;
        const rule = call?.delivery || {};
        const previous = this.get(row.callId);
        const consume = outcome === 'completed' || rule[`on${outcome[0].toUpperCase()}${outcome.slice(1)}`] === 'consume';
        this.delivery.set(row.callId,{...previous,
            consumed:previous.consumed || (rule.once !== false && consume),
            completed:previous.completed || outcome === 'completed',
            unlocked:previous.unlocked || row.answered || (rule.unlockOn || []).includes(outcome),
            nextAt:now + (consume ? rule.cooldownSeconds || 3600 : rule.retrySeconds || 300)*1000
        }); this.save();
    }
    recover(catalog, now) {
        // Restore positive progress from surviving history; never clear delivery flags.
        let changed = false;
        for (const call of catalog) {
            const rule = call.delivery, previous = this.get(call.callId);
            const rows = this.history.filter(row=>row.callId === call.callId);
            const completed = previous.completed || rows.some(row=>row.status === 'completed');
            const answered = previous.answered || completed || rows.some(row=>row.answered);
            const attempted = previous.attempts > 0 || previous.consumed || answered || rows.length > 0;
            const unlockOn = rule.unlockOn || [];
            const unlocked = previous.unlocked || answered || (attempted && unlockOn.includes('ringing')) || rows.some(row=>unlockOn.includes(row.status));
            const consumed = previous.consumed || (rule.once !== false && (completed || (rule.onAttempt === 'consume' && attempted) || rows.some(row=>rule[`on${row.status[0].toUpperCase()}${row.status.slice(1)}`] === 'consume')));
            if (consumed !== previous.consumed || unlocked !== previous.unlocked || completed !== previous.completed || answered !== previous.answered) {
                this.delivery.set(call.callId,{...previous,consumed,unlocked,completed,answered}); changed = true;
            }
        }
        if (changed) this.save();
        for (const row of this.history) if (row.endedAt === null) {
            this.finish(row,catalog.find(call => call.callId === row.callId),row.answered ? 'interrupted' : 'missed',now);
        }
    }
}
