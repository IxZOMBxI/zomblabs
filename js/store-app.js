import { canTransferDemo, publishedProducts } from './product-catalog.js';
const node = (tag, text, className) => { const el=document.createElement(tag); if (text) el.textContent=text; if (className) el.className=className; return el; };
function button(label, action, accessible = label) { const el=node('button',label); el.type='button'; el.setAttribute('aria-label',accessible); el.onclick=action; return el; }
function image(product) {
    const frame=node('div',null,'store-slot'), img=node('img');
    img.src=product.images[0].src; img.alt=product.images[0].alt; img.loading='lazy';
    img.onerror=()=>{ frame.replaceChildren(node('span','Image unavailable')); };
    frame.append(img); return frame;
}
function availability(product) { return product.kind === 'demo' ? 'DEMO — NOT FOR SALE' : `${product.status.toUpperCase()} — purchasing disabled`; }
function transferButton(product, backpack, feedback) {
    const action=button('Transfer →',()=>{ const ok=backpack.transfer(product.id); feedback(ok ? `${product.title} transferred to Your Backpack.` : 'Cannot transfer: demo only, maximum 99 per item.'); },`Transfer ${product.title} to Your Backpack`);
    action.disabled=!canTransferDemo(product); return action;
}
function checkoutSummary() {
    const footer=node('section',null,'store-summary');
    footer.append(node('strong','CHECKOUT OFFLINE'),node('p','Demo items have no prices or subtotal. Purchasing is unavailable; transfers create no orders.'));
    const checkout=button('Checkout unavailable',()=>{}); checkout.disabled=true; footer.append(checkout); return footer;
}
export function storeApp(catalog, backpack, inspect) {
    return {id:'store',title:'Zomb Store',width:820,height:590,minWidth:320,minHeight:320,
        mount(container) {
            container.classList.add('zomb-store');
            const header=node('header',null,'store-heading'); header.append(node('h1','ZOMB STORE'),node('p','DEMO — NOT FOR SALE'),node('small','Transfer test items between backpacks. No purchases. No official products.'));
            const layout=node('div',null,'store-layout'), stock=node('section',null,'store-stock'), cart=node('section',null,'store-cart');
            stock.setAttribute('aria-label',"Zomb's Backpack"); cart.setAttribute('aria-label','Your Backpack');
            stock.append(node('h2',"Zomb's Backpack"));
            const tools=node('div',null,'store-filters'), search=node('input'), select=node('select');
            search.type='search'; search.placeholder='Search items'; search.setAttribute('aria-label','Search products');
            select.setAttribute('aria-label','Filter product category');
            for (const value of ['',...new Set(publishedProducts(catalog).map(p=>p.category))]) { const option=node('option',value || 'All categories'); option.value=value; select.append(option); }
            tools.append(search,select); const grid=node('div',null,'store-grid'); stock.append(tools,grid);
            const count=node('h2'), rows=node('div',null,'store-cart-rows'), empty=button('Empty backpack',()=>{ confirmation.hidden=false; yes.focus(); });
            const confirmation=node('div',null,'store-confirm'); confirmation.hidden=true; confirmation.setAttribute('role','group'); confirmation.setAttribute('aria-label','Confirm empty backpack');
            const yes=button('Empty all demo items',()=>{backpack.clear();confirmation.hidden=true;feedback('Backpack emptied.');empty.focus();});
            const no=button('Keep items',()=>{confirmation.hidden=true;empty.focus();}); confirmation.append(node('p','Remove every item from Your Backpack?'),yes,no);
            cart.append(count,rows,empty,confirmation,checkoutSummary()); layout.append(stock,cart);
            const status=node('p',null,'store-feedback'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
            const storage=node('small'); container.append(header,layout,status,storage);
            function feedback(message) { status.textContent=message; }
            function renderProducts() {
                grid.replaceChildren();
                const found=publishedProducts(catalog).filter(p=>(!select.value || p.category===select.value) && `${p.title} ${p.description}`.toLowerCase().includes(search.value.trim().toLowerCase()));
                for (const product of found) {
                    const card=node('article',null,'store-card'); card.append(image(product),node('h3',product.title),node('small',`${product.category} · ${product.type}`),node('p',availability(product)));
                    if (product.kind==='real' && product.status==='active' && product.price!==null) {
                        const formatter=new Intl.NumberFormat(undefined,{style:'currency',currency:product.currency});
                        const scale=10 ** formatter.resolvedOptions().maximumFractionDigits;
                        card.append(node('p',`${formatter.format(product.price/scale)} · reference only`));
                    }
                    const actions=node('div',null,'store-actions'); actions.append(button('Inspect',()=>inspect(product.url),`Inspect ${product.title}`),transferButton(product,backpack,feedback)); card.append(actions); grid.append(card);
                }
                if (!found.length) grid.append(node('p','No matching items.'));
            }
            function renderCart() {
                const focused=rows.contains(document.activeElement) ? document.activeElement.dataset.control : null;
                count.textContent=`Your Backpack · ${backpack.count} item${backpack.count===1?'':'s'}`; rows.replaceChildren();
                for (const {product,quantity} of backpack.rows) {
                    const row=node('article',null,'store-cart-row'); row.append(image(product),node('strong',product.title));
                    const controls=node('div',null,'store-actions');
                    const minus=button('−',()=>{backpack.set(product.id,quantity-1);feedback(`${product.title} quantity decreased.`);},`Decrease ${product.title}`);
                    const plus=button('+',()=>{backpack.set(product.id,quantity+1);feedback(`${product.title} quantity increased.`);},`Increase ${product.title}`); plus.disabled=quantity>=99;
                    const remove=button('Remove',()=>{backpack.remove(product.id);feedback(`${product.title} removed.`);},`Remove ${product.title}`);
                    for (const [name,control] of [['minus',minus],['plus',plus],['remove',remove]]) control.dataset.control=`${product.id}-${name}`;
                    controls.append(minus,node('span',String(quantity)),plus,remove); row.append(controls); rows.append(row);
                }
                if (!backpack.count) rows.append(node('p','Your Backpack is empty. Inspect an item or use Transfer to try it.'));
                storage.textContent=backpack.persistent ? 'Demo backpack saved on this browser.' : 'Browser storage unavailable. Backpack kept for this visit only.';
                if (focused) (Array.from(rows.querySelectorAll('button')).find(b=>b.dataset.control===focused && !b.disabled) || empty).focus();
            }
            search.oninput=renderProducts; select.onchange=renderProducts; renderProducts();
            return backpack.subscribe(renderCart);
        }
    };
}
// Each page closes over the same frozen record. Brand-specific layouts can wrap this renderer.
export function productPages(catalog, backpack, launch) {
    return publishedProducts(catalog).map(product=>({url:product.url,title:product.title,layout:'store-product',listed:true,product,
        mount(container) {
            const page=node('section',null,'store-product');
            const feedback=node('p'); feedback.setAttribute('role','status');
            page.append(node('p',availability(product),'store-heading'),node('h1',product.title),image(product),node('p',product.description),node('p',product.details),node('p',`${product.category} · ${product.type}`),node('p',product.brand.label),node('small',`Product ID: ${product.id} · Canon review: ${product.review.canon}. ${product.review.note}`));
            page.append(transferButton(product,backpack,message=>{feedback.textContent=message + (backpack.persistent ? '' : ' Storage unavailable; kept for this visit.');}),button('Back to Zomb Store',()=>launch('store')),feedback,checkoutSummary());
            container.append(page);
        }
    }));
}
