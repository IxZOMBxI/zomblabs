import { products } from './store-fixtures.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { products as activeProducts, validateCatalog, publishedProducts, canTransferDemo } from '../js/product-catalog.js';
import { BackpackState, BACKPACK_KEY } from '../js/backpack-state.js';
import { storeApp } from '../js/store-app.js';
import { createZombnetNavigation } from '../js/zombnet-app.js';
import { ZombNetwork } from '../js/zombnet-network.js';
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};};
const changed=patch=>({...JSON.parse(JSON.stringify(products[0])),...patch});
test('catalog validates immutable demo fixtures, image paths, unique identities and restrictions',()=>{
    assert.equal(products.length,4); assert.ok(Object.isFrozen(products[0].images));
    for (const p of products) { assert.equal(p.price,null); assert.equal(p.provider,null); assert.ok(canTransferDemo(p)); assert.ok(existsSync(new URL('../'+p.images[0].src,import.meta.url))); }
    for (const patch of [{price:100,currency:'USD'},{status:'active'},{kind:'real'},{provider:{name:'test',productId:'x'}},{review:{canon:'approved',note:'No'}},{images:[{src:'https://invalid/image.svg',alt:'test'}]},{url:'https://checkout.test'},{variants:[{id:'x',label:'X'},{id:'x',label:'Y'}]}]) assert.throws(()=>validateCatalog([changed(patch)]));
    assert.throws(()=>validateCatalog([products[0],products[0]]));
    const draft=validateCatalog([changed({status:'draft'})]); assert.equal(publishedProducts(draft).length,0);
    const real=validateCatalog([changed({id:'real-badge',kind:'real',status:'active',price:100,currency:'USD',review:{canon:'unreviewed',note:'Requires separate review.'}})]);
    assert.equal(canTransferDemo(real[0]),false); assert.equal(new BackpackState(real,memory()).transfer('real-badge'),false);
});
test('transfer, quantity, remove, clear and refresh persistence are demo scoped',()=>{
    const storage=memory(), bag=new BackpackState(products,storage), id=products[0].id;
    assert.ok(bag.transfer(id)); assert.ok(bag.transfer(id)); assert.equal(bag.count,2);
    assert.ok(bag.set(id,5)); assert.equal(new BackpackState(products,storage).count,5);
    for(const value of [-1,1.2,100,NaN,'2']) assert.equal(bag.set(id,value),false);
    assert.equal(bag.transfer('missing'),false); bag.remove(id); assert.equal(bag.count,0);
    bag.transfer(id); bag.clear(); assert.equal(new BackpackState(products,storage).count,0);
    assert.equal(JSON.parse(storage.getItem(BACKPACK_KEY)).mode,'demo');
});
test('stale, removed, unpublished, wrong-mode and corrupt cart entries cannot transfer into real data',()=>{
    const storage=memory(); storage.setItem(BACKPACK_KEY,JSON.stringify({version:1,mode:'demo',items:[{id:products[0].id,quantity:2},{id:'missing',quantity:4},{id:products[1].id,quantity:999}]}));
    assert.equal(new BackpackState(products,storage).count,2);
    assert.equal(new BackpackState(products.slice(1),storage).count,0);
    assert.equal(new BackpackState(validateCatalog([changed({status:'unavailable'})]),storage).count,0);
    storage.setItem(BACKPACK_KEY,JSON.stringify({version:1,mode:'real',items:[{id:products[0].id,quantity:2}]})); assert.equal(new BackpackState(products,storage).count,0);
    storage.setItem(BACKPACK_KEY,'broken'); assert.equal(new BackpackState(products,storage).count,0);
    const denied=new BackpackState(products,{getItem(){throw Error();},setItem(){throw Error();}}); denied.transfer(products[0].id); assert.equal(denied.count,1); assert.equal(denied.persistent,false);
});
test('Inspect navigation bridge uses current mounted browser and releases it on close',()=>{
    const navigation=createZombnetNavigation(), visited=[];
    assert.equal(navigation.open(products[0].url),false);
    const dispose=navigation.bind(url=>visited.push(url));
    assert.equal(navigation.open(products[0].url),true); assert.deepEqual(visited,[products[0].url]);
    assert.equal(navigation.open('https://checkout.test'),false);
    dispose(); assert.equal(navigation.open(products[0].url),false);
});
test('cart subscription disposes without losing contents',()=>{
    const bag=new BackpackState(products,memory());let changes=0;
    const dispose=bag.subscribe(()=>changes++);bag.transfer(products[0].id);dispose();bag.transfer(products[0].id);
    assert.equal(changes,2);assert.equal(bag.count,2);
});
test('checkout is hard disabled in shared renderer, with no payment destinations',()=>{
    const source=readFileSync(new URL('../js/store-app.js',import.meta.url),'utf8');
    assert.match(source,/checkout\.disabled=true/); assert.doesNotMatch(source,/window\.open|location\.|https?:\/\/|fetch\(/);
});

test('empty active catalog removes demo inventory and product pages without erasing saved data',()=>{
    assert.deepEqual(activeProducts,[]);
    const storage=memory(), saved=JSON.stringify({version:1,mode:'demo',items:products.map(p=>({id:p.id,quantity:2}))});
    storage.setItem(BACKPACK_KEY,saved);storage.setItem('unrelated','keep');
    const bag=new BackpackState(activeProducts,storage);
    assert.equal(bag.count,0);assert.deepEqual(bag.rows,[]);
    for(const p of products)assert.equal(bag.transfer(p.id),false);
    const network=new ZombNetwork();
    for(const p of products)assert.equal(network.get(p.url),null);
    assert.ok(network.get('zomb://home'));assert.equal(network.get('zomb://radio'),null);
    assert.equal(storage.getItem(BACKPACK_KEY),saved);assert.equal(storage.getItem('unrelated'),'keep');
    assert.equal(new BackpackState(activeProducts,storage).count,0);
});

test('future physical and digital catalog records need no ZombNET destination',()=>{for(const type of ['physical','digital']){const record=changed({id:'future-product',kind:'real',status:'draft',type,review:{canon:'unreviewed',note:'Test only'}});delete record.url;assert.equal(validateCatalog([record])[0].url,undefined);}});
