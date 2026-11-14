// Classic script for early Settings restoration; also imported by persisted services.
(() => {
    if (globalThis.ZombStorage) return;
    const names = Object.freeze({
        'zombos.settings.v1':'Settings and themes', 'zombos.phone.v1':'PHONE',
        'zombos.zombnet.v1':'ZombNET', 'zombos.arcade.v1':'Arcade scores',
        'zombos.store.demo.v1':'Demo backpack', 'zombos.radio.v1':'RADIO preferences'
    });
    const backupKey = key => 'zombos.recovery.' + key;
    const sessions = new WeakMap();
    const absent = {};
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const canonical = value => JSON.stringify(value, function(key, item) {
        return object(item) ? Object.fromEntries(Object.keys(item).sort().map(name=>[name,item[name]])) : item;
    });
    function browserStorage() { try { return globalThis.localStorage; } catch { return undefined; } }
    function session(storage) {
        const target = storage || absent;
        if (!sessions.has(target)) sessions.set(target, {reports:new Map(), guards:new Map(), reset:false});
        return sessions.get(target);
    }
    function preserve(storage, key, raw) {
        if (raw == null) return;
        const previous = storage.getItem(backupKey(key));
        const copies = previous == null ? [] : JSON.parse(previous);
        if (!Array.isArray(copies) || copies.some(item=>typeof item !== 'string')) throw Error('Recovery backup is unreadable. Export it before resetting.');
        if (!copies.includes(raw)) {
            if (copies.length >= 5) throw Error('Recovery backup limit reached. Export before resetting.');
            storage.setItem(backupKey(key), JSON.stringify([...copies,raw]));
        }
    }
    function open(key, storage) {
        if (!Object.hasOwn(names,key)) throw Error('Unknown ZombOS storage key');
        const current = session(storage);
        if (current.guards.has(key)) return current.guards.get(key);
        const report = (status, message) => current.reports.set(key,{key,name:names[key],status,message});
        let blocked = false, phoneHold = false, normalize;
        const guard = {
            get blocked() { return blocked || current.reset; },
            get automaticBlocked() { return phoneHold || guard.blocked; },
            read(clean, {version, phone=false} = {}) {
                normalize = clean;
                let raw;
                try {
                    if (!storage) throw Error('Browser storage is unavailable. Changes last only for this visit.');
                    raw = storage.getItem(key);
                    if (raw == null) { report('empty','No saved data.'); return null; }
                    let saved;
                    try { saved = JSON.parse(raw); } catch { throw Error('Saved JSON is unreadable. Original retained; export or reset this subsystem.'); }
                    if (!object(saved)) throw Error('Saved state is not an object. Original retained.');
                    if ((version !== undefined && saved.version !== version) || (version === undefined && key !== 'zombos.arcade.v1' && saved.version !== undefined && saved.version !== 1)) throw Error('Unsupported saved-state version. Use a compatible ZombOS version or export before resetting.');
                    const recovered = clean(saved);
                    if (canonical(saved) !== canonical(recovered)) {
                        if (phone) recovered.recoveryHold = true;
                        try {
                            preserve(storage,key,raw);
                            storage.setItem(key,JSON.stringify(recovered));
                            report('recovered',phone ? 'Valid history retained; automatic calls paused because delivery state needs review.' : 'Valid data recovered. Original retained in a recovery backup.');
                        } catch {
                            blocked = true;
                            report('protected','Recovered for this visit only. Storage is blocked, full, or backup unavailable; original was not overwritten. Export a backup.');
                        }
                    } else if (!current.reports.has(key) || current.reports.get(key).status === 'empty') {
                        const hasBackup=storage.getItem(backupKey(key)) != null;
                        report(phone && saved.recoveryHold ? 'protected' : hasBackup ? 'recovered' : 'healthy',phone && saved.recoveryHold ? 'Automatic calls paused after recovery. Valid history remains available.' : hasBackup ? 'Saved data is valid; prior recovery copies are available in Export local backup.' : 'Saved data is valid.');
                    }
                    if (phone && recovered.recoveryHold) phoneHold = true;
                    return recovered;
                } catch (error) {
                    blocked = true;
                    if (raw != null) { try { preserve(storage,key,raw); } catch { /* Original remains untouched. */ } }
                    report('protected',error.message || 'Browser storage cannot be read.');
                    return null;
                }
            },
            write(value) {
                if (guard.blocked || !storage) throw Error('Saved state is protected. Open System Recovery.');
                // Writers still use their existing validators; prevent stale instances overwriting reset data.
                try { storage.setItem(key,JSON.stringify(phoneHold ? {...value,recoveryHold:true} : value)); }
                catch (error) { report('unavailable','Storage write failed (blocked or full). Changes remain in memory.'); throw error; }
            },
            inspect() { if (normalize) guard.read(normalize, guard.options); }
        };
        // Keep load options for subsequent health inspection.
        const read = guard.read;
        guard.read = (clean,options={}) => { guard.options=options; return read(clean,options); };
        current.guards.set(key,guard);
        return guard;
    }
    function inspect(storage) {
        const current=session(storage);
        for (const guard of current.guards.values()) guard.inspect();
        const rows=Object.entries(names).map(([key,name])=>current.reports.get(key) || {key,name,status:'unchecked',message:'Not loaded yet.'});
        try {
            if (!storage) throw Error();
            const probe='zombos.recovery.probe', previous=storage.getItem(probe);
            storage.setItem(probe,previous ?? '1');
            if (previous == null) storage.removeItem(probe);
            rows.unshift({name:'Browser storage',status:'available',message:'Read/write check passed.'});
        } catch { rows.unshift({name:'Browser storage',status:'unavailable',message:'Read/write check failed. Storage may be blocked or full. Export readable data; check browser permissions or free space.'}); }
        return rows;
    }
    function exportState(storage) {
        const values = {}, errors = [];
        for (const key of Object.keys(names).flatMap(key=>[key,backupKey(key)])) {
            try { if (!storage) throw Error(); const raw=storage.getItem(key); if (raw != null) values[key]=raw; }
            catch { errors.push(key); }
        }
        return {format:'zombos-local-backup',version:1,exportedAt:new Date().toISOString(),values,errors};
    }
    function reset(storage, key, confirmation, {backupExported=false} = {}) {
        const keys = key === 'all' ? Object.keys(names) : Object.hasOwn(names,key) ? [key] : [];
        const expected = key === 'all' ? 'RESET ALL ZOMBOS' : `RESET ${names[key]}`;
        if (!keys.length || confirmation !== expected) throw Error('Confirmation did not match. Nothing reset.');
        if (!storage) throw Error('Browser storage is unavailable. Nothing reset.');
        // Back up every target before any deletion; never clear the origin or remove backups.
        for (const target of keys) {
            try { preserve(storage,target,storage.getItem(target)); }
            catch (error) { if (backupExported !== true) throw error; }
        }
        session(storage).reset=true;
        try { for (const target of keys) storage.removeItem(target); }
        catch { throw Error('Reset could not finish. Some selected data may already be removed; backups are retained. Reload before continuing.'); }
    }
    globalThis.ZombStorage = Object.freeze({names,open,inspect,exportState,reset,browserStorage,object});
})();
