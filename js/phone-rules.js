// Delivery metadata is data, never executable code. Invalid rules fail closed.
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const text = (value, max = 200) => typeof value === 'string' && value.length > 0 && value.length <= max;
function keys(value, allowed) {
    if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) throw Error('Unknown or invalid delivery fields.');
}
function number(value, fallback, min, max) {
    if (value === undefined) return fallback;
    if (!Number.isFinite(value) || value < min || value > max) throw Error('Invalid delivery number.');
    return value;
}
function boolean(value, fallback) {
    if (value === undefined) return fallback;
    if (typeof value !== 'boolean') throw Error('Invalid delivery flag.');
    return value;
}
export function scheduledInstant(schedule) {
    keys(schedule, ['at', 'timeZone']);
    if (!text(schedule.timeZone) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(schedule.at)) throw Error('Schedule needs local date/time and an explicit IANA time zone.');
    const local = Date.parse(schedule.at + 'Z');
    if (!Number.isFinite(local) || new Date(local).toISOString().slice(0,19) !== schedule.at) throw Error('Invalid scheduled date.');
    const formatter = new Intl.DateTimeFormat('en-CA', {timeZone:schedule.timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'});
    const wall = instant => {
        const p = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type,part.value]));
        return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
    };
    const offsets = new Set();
    for (let hours = -36; hours <= 36; hours += 6) {
        const probe = local + hours * 3600000;
        offsets.add(Date.parse(wall(probe) + 'Z') - probe);
    }
    const matches = [...offsets].map(offset => local - offset).filter(instant => wall(instant) === schedule.at);
    if (matches.length !== 1) throw Error('Scheduled time is skipped or ambiguous at a daylight-saving transition.');
    return matches[0];
}
export function normalizeCall(entry) {
    if (!text(entry.callId) || !text(entry.caller) || typeof entry.src !== 'string') throw Error('Call ID, caller and source are required.');
    const raw = entry.delivery;
    if (raw == null) return {...entry, delivery:{enabled:false}};
    keys(raw, ['enabled','once','delaySeconds','schedule','event','priority','cooldownSeconds','retrySeconds','ringSeconds','conditions','onAttempt','onDeclined','onMissed','onInterrupted','unlockOn']);
    if (raw.event !== undefined && !text(raw.event)) throw Error('Invalid event.');
    const conditions = raw.conditions ?? {};
    keys(conditions, ['completed','answered','notCompleted','events']);
    for (const values of Object.values(conditions)) if (!Array.isArray(values) || values.length > 100 || values.some(value => !text(value))) throw Error('Invalid eligibility conditions.');
    const policy = key => {
        if (raw[key] !== undefined && !['retry','consume'].includes(raw[key])) throw Error('Invalid outcome policy.');
        return raw[key] || 'retry';
    };
    const unlockOn = raw.unlockOn ?? [];
    if (!Array.isArray(unlockOn) || unlockOn.some(value => !['ringing','declined','missed','interrupted'].includes(value))) throw Error('Invalid replay unlock policy.');
    return {...entry, extension:typeof entry.extension === 'string' ? entry.extension.slice(0,60) : '', delivery:{
        enabled:boolean(raw.enabled,true), once:boolean(raw.once,true),
        delaySeconds:number(raw.delaySeconds,0,0,31536000),
        at:raw.schedule === undefined ? null : scheduledInstant(raw.schedule),
        event:raw.event || '', priority:number(raw.priority,0,-10000,10000),
        cooldownSeconds:number(raw.cooldownSeconds,3600,1,31536000),
        retrySeconds:number(raw.retrySeconds,300,1,31536000),
        ringSeconds:number(raw.ringSeconds,30,5,300), conditions, unlockOn,
        onAttempt:policy('onAttempt'), onDeclined:policy('onDeclined'), onMissed:policy('onMissed'), onInterrupted:policy('onInterrupted')
    }};
}
