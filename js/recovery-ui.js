import './storage-recovery.js';
import { PhoneState } from './phone-state.js';
import { ZombnetState } from './zombnet-state.js';
import { ArcadeScores } from './arcade-scores.js';
import { BackpackState } from './backpack-state.js';
import { products } from './product-catalog.js';

export function mountRecovery(container) {
    const api=globalThis.ZombStorage, storage=api.browserStorage();
    const root=document.createElement('div'); root.className='system-recovery';
    const element=(tag,text)=>{const node=document.createElement(tag); node.textContent=text; return node;};
    const heading=element('h2','System Recovery');
    const intro=element('p','Inspect and repair browser-local data. Network errors, missing deployment files, and unsupported media are separate problems; resetting local data will not fix them.');
    const results=document.createElement('ul');
    const status=element('p',''); status.setAttribute('role','status');
    const inspect=element('button','Inspect local storage health'); inspect.type='button';
    const backup=element('button','Export local backup'); backup.type='button';
    const choice=document.createElement('select');
    for (const [key,name] of [...Object.entries(api.names),['all','All ZombOS local data']]) {
        const option=element('option',name); option.value=key; choice.append(option);
    }
    const choiceLabel=element('label','Reset subsystem '); choiceLabel.append(choice);
    const warning=element('p','Close other ZombOS tabs before resetting. Reset deletes saved progress in the selected subsystem and reloads ZombOS. PHONE reset (including full reset) allows previously consumed calls to ring again. Ordinary repair never resets PHONE. Unrelated site data and recovery backups are retained.');
    const confirmation=document.createElement('input'); confirmation.type='text'; confirmation.autocomplete='off'; confirmation.spellcheck=false;
    const confirmLabel=element('label','');
    const update=()=>{confirmLabel.replaceChildren(document.createTextNode(`Type ${choice.value==='all'?'RESET ALL ZOMBOS':`RESET ${api.names[choice.value]}`} to confirm `),confirmation); confirmation.value='';};
    choice.onchange=update; update();
    const reset=element('button','Reset selected data and reload'); reset.type='button';
    const exported=document.createElement('input'); exported.type='checkbox'; exported.disabled=true;
    const exportedLabel=element('label',''); exportedLabel.append(exported,' I verified the downloaded backup. Allow this reset if a local backup cannot be saved.');
    const inspectState=()=>{
        // Use the same loaders/validators as the applications, including unloaded apps.
        new PhoneState(storage); new ZombnetState(storage); new ArcadeScores(storage); new BackpackState(products,storage);
        api.open('zombos.radio.v1',storage).read(data=>({shuffle:typeof data.shuffle==='boolean'?data.shuffle:true}));
        results.replaceChildren(...api.inspect(storage).map(row=>element('li',`${row.name}: ${row.status}. ${row.message}`)));
    };
    inspect.onclick=()=>{inspectState(); status.textContent='Inspection complete. Unsupported saved-state versions are retained, not downgraded.';};
    backup.onclick=()=>{
        const data=api.exportState(storage);
        exported.checked=false; exported.disabled=data.errors.length>0;
        const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
        const link=document.createElement('a'); link.href=url; link.download='zombos-local-backup.json'; link.click();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
        status.textContent=data.errors.length ? 'Partial backup only: some browser storage could not be read. Keep the original data.' : 'Backup download requested. It includes original recovery copies. Keep this file private. Backup import is not supported; theme import remains strictly validated.';
    };
    reset.onclick=()=>{
        try { api.reset(storage,choice.value,confirmation.value,{backupExported:!exported.disabled && exported.checked}); location.reload(); }
        catch(error) { status.textContent=error.message+' If storage is full or blocked, export readable data and review browser storage permissions before retrying.'; }
    };
    const safe=element('a','Open standalone recovery (default readable colors)'); safe.href='recovery.html';
    root.append(heading,intro,inspect,backup,results,choiceLabel,warning,confirmLabel,exportedLabel,reset,status,safe);
    container.append(root); inspectState();
}
