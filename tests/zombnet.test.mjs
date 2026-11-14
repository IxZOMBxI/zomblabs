import assert from 'node:assert/strict';
import { parseAddress, ZombNetwork } from '../js/zombnet-network.js';
import { ZombnetState } from '../js/zombnet-state.js';
for (const value of ['javascript:alert(1)','data:text/html,test','file:///tmp/a','http://example.com','https://user:secret@example.com','garbage']) assert.equal(parseAddress(value),null);
assert.equal(parseAddress('zomb://HOME/').url,'zomb://home');
assert.equal(parseAddress('https://example.com/a?q=hello world').kind,'external');
const network=new ZombNetwork([{url:'zomb://home',listed:true,advertiser:true},{url:'zomb://hidden',hidden:true,listed:true,advertiser:true},{url:'zomb://locked',listed:true,advertiser:true,unlock:'found'}]);
assert.equal(network.directory().length,1);assert.ok(network.get('zomb://hidden'));assert.equal(network.get('zomb://locked'),null);network.discover('found');assert.ok(network.get('zomb://locked'));
const data=new Map();const storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};const state=new ZombnetState(storage);assert.equal(state.history.length,0);
for(let i=0;i<130;i++){state.visit('zomb://page'+i,'Page');state.bookmark('zomb://page'+i,'Page')}
assert.equal(state.history.length,100);assert.equal(state.bookmarks.length,50);
const restored=new ZombnetState(storage);assert.equal(restored.history.length,100);restored.remove(restored.bookmarks[0].url);assert.equal(restored.bookmarks.length,49);restored.clear();assert.equal(new ZombnetState(storage).history.length,0);
const blocked=new ZombnetState({getItem(){throw Error()},setItem(){throw Error()}});assert.equal(blocked.bookmark('zomb://home','Home'),false);
console.log('PASS URL validation, hidden/locked pages, bounded persistence, corruption/storage failure, bookmark removal/history clearing');

const live=new ZombNetwork();
assert.deepEqual(live.directory(),[]);
for(const url of ['zomb://radio','zomb://arcade','zomb://demo-lab/products/demo-badge'])assert.equal(live.get(url),null);
assert.ok(live.get('zomb://home'));assert.ok(live.get('zomb://directory'));
live.register({url:'zomb://test-advertiser',listed:true,advertiser:true});
live.register({url:'zomb://test-unrelated',listed:true});
assert.deepEqual(live.directory().map(p=>p.url),['zomb://test-advertiser']);
console.log('PASS advertiser-only directory, empty production network and removed app routes');
