const KEY = 'zombos.phone.v1';
const outcomes = ['ringing','answered','declined','missed','completed','interrupted'];
const finite = value => Number.isFinite(value) && value >= 0;
const id = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
const label = value => typeof value === 'string' ? value.slice(0,200) : '';
export class PhoneState {
    constructor(storage) {
        this.storage = storage; this.history = []; this.delivery = new Map(); this.sequence = 0; this.persistent = true;
        try {
            const saved = JSON.parse(storage?.getItem(KEY) || 'null');
            if (saved?.version !== 1) return;
            if (Array.isArray(saved.history)) this.history = saved.history.filter(row => row && Number.isSafeInteger(row.id) && row.id > 0 && id(row.callId) && finite(row.at) && outcomes.includes(row.status)).slice(-200).map(row => ({
                id:row.id, callId:row.callId, at:row.at, endedAt:finite(row.endedAt) ? row.endedAt : null,
                caller:label(row.caller), extension:label(row.extension), title:label(row.title), status:row.status, answered:row.answered === true
            }));
            if (Array.isArray(saved.delivery)) for (const pair of saved.delivery.slice(0,5000)) {
                if (!Array.isArray(pair) || !id(pair[0]) || !pair[1] || typeof pair[1] !== 'object') continue;
                const value = pair[1];
                this.delivery.set(pair[0], {consumed:value.consumed === true, unlocked:value.unlocked === true,
                    completed:value.completed === true, answered:value.answered === true, nextAt:finite(value.nextAt) ? value.nextAt : 0,
                    attempts:Number.isSafeInteger(value.attempts) && value.attempts >= 0 ? value.attempts : 0});
            }
            this.sequence = Math.max(0, ...this.history.map(row => row.id));
        } catch { this.persistent = false; }
    }
    get(callId) { return this.delivery.get(callId) || {consumed:false, unlocked:false, completed:false, answered:false, nextAt:0, attempts:0}; }
    save() {
        try {
            if (!this.storage) throw Error('Storage unavailable');
            this.storage.setItem(KEY, JSON.stringify({version:1, history:this.history, delivery:[...this.delivery]}));
            this.persistent = true;
        } catch { this.persistent = false; }
    }
    begin(call, now) {
        const row = {id:++this.sequence, callId:call.callId, caller:call.caller, extension:call.extension || '', title:call.title, at:now, endedAt:null, status:'ringing', answered:false};
        this.history.push(row); this.history = this.history.slice(-200);
        this.delivery.set(call.callId,{...this.get(call.callId), attempts:this.get(call.callId).attempts+1}); this.save();
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
        for (const row of this.history) if (row.endedAt === null) {
            this.finish(row,catalog.find(call => call.callId === row.callId),row.answered ? 'interrupted' : 'missed',now);
        }
    }
}
