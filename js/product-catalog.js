// Public presentation metadata, never a source of checkout authority.
const idPattern = /^[a-z0-9][a-z0-9-]{0,79}$/;
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
export function validateCatalog(records) {
    if (!Array.isArray(records) || records.length > 500) throw Error('Invalid product catalog');
    const ids = new Set(), urls = new Set();
    return freeze(records.map(record => {
        if (!record || typeof record !== 'object') throw Error('Invalid product');
        const p = JSON.parse(JSON.stringify(record));
        if (!idPattern.test(p.id) || ids.has(p.id) || !text(p.title,120) || !text(p.description,500) || !text(p.details,6000) || !text(p.category,60)) throw Error('Invalid product identity or text');
        if (!['demo','real'].includes(p.kind) || !['demo','draft','active','unavailable','discontinued'].includes(p.status) || !['physical','digital'].includes(p.type)) throw Error('Invalid product classification');
        if (p.kind === 'demo' && (!p.id.startsWith('demo-') || !['demo','draft','unavailable','discontinued'].includes(p.status) || p.price !== null || p.currency !== null || p.provider !== null)) throw Error('Demo products cannot have commerce data');
        if (p.kind === 'real' && (p.id.startsWith('demo-') || p.status === 'demo')) throw Error('Demo identity cannot become real');
        if (p.price !== null && (!Number.isSafeInteger(p.price) || p.price < 0 || !/^[A-Z]{3}$/.test(p.currency))) throw Error('Invalid minor-unit price');
        if (p.price === null && p.currency !== null) throw Error('Currency requires a price');
        if (!Array.isArray(p.images) || !p.images.length || p.images.length > 8 || p.images.some(image => !image || !/^assets\/store\/[a-z0-9-]+\.(svg|png|jpg|webp)$/.test(image.src) || !text(image.alt,200))) throw Error('Invalid product image');
        if (!p.brand || !text(p.brand.label,100) || typeof p.brand.fictional !== 'boolean' || !p.review || !['unreviewed','approved','fixture'].includes(p.review.canon) || !text(p.review.note,500)) throw Error('Review and brand metadata required');
        if (p.kind === 'demo' && p.review.canon !== 'fixture') throw Error('Demos are non-canonical fixtures');
        if (!Array.isArray(p.variants) || p.variants.length > 50 || p.variants.some(v=>!v || typeof v.id !== 'string' || !idPattern.test(v.id) || !text(v.label,100)) || new Set(p.variants.map(v=>v.id)).size !== p.variants.length) throw Error('Invalid variants');
        if (p.provider !== null && (!p.provider || !text(p.provider.name,80) || !text(p.provider.productId,120) || Object.keys(p.provider).some(key=>!['name','productId'].includes(key)))) throw Error('Invalid inert provider reference');
        if (p.url != null && (!/^zomb:\/\/[a-z0-9-]+\/products\/[a-z0-9-]+$/.test(p.url) || urls.has(p.url))) throw Error('Invalid product destination');
        ids.add(p.id); urls.add(p.url); return p;
    }));
}
// No products are currently available. Test fixtures live under tests/.
export const products = validateCatalog([]);
export const publishedProducts = catalog => catalog.filter(p=>p.status !== 'draft');
export const canTransferDemo = product => product?.kind === 'demo' && product.status === 'demo' && product.id.startsWith('demo-');
