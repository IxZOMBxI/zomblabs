// Test-only products; never imported by the application.
import { validateCatalog } from '../js/product-catalog.js';
const fixtures = [
    ['badge','Demo Lab Badge','Accessories','physical','A sample identification badge with a blank display.'],
    ['patch','Demo Signal Patch','Accessories','physical','A sample stitched patch with a simple signal motif.'],
    ['archive','Demo Archive Pack','Digital','digital','A sample archive icon for testing digital-product presentation. No files are included.'],
    ['sticker','Demo Laboratory Sticker','Stationery','physical','A sample laboratory sticker with a simple flask motif.']
];
export const products = validateCatalog(fixtures.map(([slug,title,category,type,description]) => ({
    id:`demo-${slug}`, title, description, details:`${description} This is an interface testing fixture only, not an official product, inventory listing, or approved universe lore.`,
    category, type, kind:'demo', status:'demo', price:null, currency:null, variants:[], provider:null,
    images:[{src:`assets/store/demo-${slug}.svg`,alt:`Illustration of ${title}`}],
    brand:{label:'Demo fixtures / no canonical company',fictional:true},
    review:{canon:'fixture',note:'Presentation testing only. Lore Bible approval is separate.'},
    url:`zomb://demo-lab/products/demo-${slug}`
})));
