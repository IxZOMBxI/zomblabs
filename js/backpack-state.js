import { canTransferDemo } from './product-catalog.js';
export const BACKPACK_KEY = 'zombos.store.demo.v1';
// Deliberately incompatible with any future real cart. No checkout/order API.
export class BackpackState extends EventTarget {
    constructor(catalog, storage) {
        super(); this.catalog = catalog; this.storage = storage; this.items = new Map(); this.persistent = true;
        try {
            const saved = JSON.parse(storage?.getItem(BACKPACK_KEY) || 'null');
            if (saved?.version === 1 && saved.mode === 'demo' && Array.isArray(saved.items)) {
                for (const row of saved.items.slice(0,500)) if (row && this.valid(row.id) && Number.isInteger(row.quantity) && row.quantity > 0 && row.quantity <= 99) this.items.set(row.id,row.quantity);
            }
        } catch { this.persistent = false; }
        if (!storage) this.persistent = false;
    }
    valid(id) { return canTransferDemo(this.catalog.find(p=>p.id === id)); }
    get count() { return [...this.items.values()].reduce((sum,n)=>sum+n,0); }
    get rows() { return [...this.items].filter(([id])=>this.valid(id)).map(([id,quantity])=>({product:this.catalog.find(p=>p.id===id),quantity})); }
    transfer(id) { return this.set(id,(this.items.get(id) || 0)+1); }
    set(id, quantity) {
        if (!this.valid(id) || !Number.isInteger(quantity) || quantity < 0 || quantity > 99) return false;
        if (quantity === 0) this.items.delete(id); else this.items.set(id,quantity);
        this.save(); return true;
    }
    remove(id) { if (!this.items.has(id)) return false; this.items.delete(id); this.save(); return true; }
    clear() { this.items.clear(); this.save(); }
    save() {
        try { if (!this.storage) throw Error(); this.storage.setItem(BACKPACK_KEY,JSON.stringify({version:1,mode:'demo',items:[...this.items].map(([id,quantity])=>({id,quantity}))})); this.persistent=true; }
        catch { this.persistent=false; }
        this.dispatchEvent(new Event('change'));
    }
    subscribe(listener) { this.addEventListener('change',listener); listener(); return ()=>this.removeEventListener('change',listener); }
}
