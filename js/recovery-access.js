// Separate from desktop initialization so a storage failure cannot hide the escape link.
document.addEventListener('DOMContentLoaded', () => {
    const notice=document.getElementById('storageRecoveryNotice');
    const recovery=globalThis.ZombStorage;
    if (!notice || !recovery) return; // Missing deployment scripts are not storage corruption.
    const reports=recovery.inspect(recovery.browserStorage());
    notice.hidden=!reports.some(row=>['protected','unavailable'].includes(row.status));
    notice.querySelector('[data-dismiss-recovery]').onclick=()=>{notice.hidden=true;};
}, {once:true});
