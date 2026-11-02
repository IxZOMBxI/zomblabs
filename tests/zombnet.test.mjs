import assert from 'node:assert/strict';
import { parseAddress, ZombNetwork } from '../js/zombnet-network.js';
import { ZombnetState } from '../js/zombnet-state.js';
for (const value of ['javascript:alert(1)','data:text/html,test','file:///tmp/a','http://example.com','https://user:secret@example.com','garbage']) assert.equal(parseAddress(value),null);
assert.equal(parseAddress('zomb://HOME/').url,'zomb://home');
assert.equal(parseAddress('https://example.com/a?q=hello world').kind,'external');
const network=new ZombNetwork([{url:'zomb://home',listed:true},{url:'zomb://hidden',hidden:true,listed:true},{url:'zomb://locked',listed:true,unlock:'found'}]);
assert.equal(network.directory().length,1);assert.ok(network.get('zomb://hidden'));assert.equal(network.get('zomb://locked'),null);network.discover('found');assert.ok(network.get('zomb://locked'));
let saved='invalid';const storage={getItem:()=>saved,setItem:(key,value)=>{saved=value}};const state=new ZombnetState(storage);assert.equal(state.history.length,0);
for(let i=0;i<130;i++){state.visit('zomb://page'+i,'Page');state.bookmark('zomb://page'+i,'Page')}
assert.equal(state.history.length,100);assert.equal(state.bookmarks.length,50);
const restored=new ZombnetState(storage);assert.equal(restored.history.length,100);restored.remove(restored.bookmarks[0].url);assert.equal(restored.bookmarks.length,49);restored.clear();assert.equal(new ZombnetState(storage).history.length,0);
const blocked=new ZombnetState({getItem(){throw Error()},setItem(){throw Error()}});assert.equal(blocked.bookmark('zomb://home','Home'),false);
console.log('PASS URL validation, hidden/locked pages, bounded persistence, corruption/storage failure, bookmark removal/history clearing');
