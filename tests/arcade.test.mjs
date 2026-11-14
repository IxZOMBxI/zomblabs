import assert from 'node:assert/strict';
import { DeadSprint } from '../js/dead-sprint-engine.js';
import { ArcadeScores } from '../js/arcade-scores.js';
import { parseAddress } from '../js/zombnet-network.js';
assert.equal(parseAddress('arcade.zomb').url,'zomb://arcade');
const game=new DeadSprint();game.input();assert.equal(game.speed,4);
for(let i=0;i<900;i++)game.step(1/60);assert.equal(game.mode,'over');game.input();assert.equal(game.mode,'running');assert.equal(game.speed,4);
for(let i=0;i<3600;i++){if(i%18===0)game.input();game.step(1/60)}
assert.ok(game.score>=50);assert.ok(game.targetSpeed<game.config.maximum);assert.ok(game.speed<=game.config.maximum);
game.pause();const gap=game.gap;game.step(1);assert.equal(game.gap,gap);
const data=new Map();const storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};const scores=new ArcadeScores(storage);scores.record('dead-sprint',50);scores.record('dead-sprint',10);assert.equal(new ArcadeScores(storage).get('dead-sprint'),50);assert.equal(scores.get('other-game'),0);
assert.equal(scores.record('bad key',100),false);assert.equal(scores.record('dead-sprint',Infinity),false);
console.log('PASS alias, start/loss/restart, rhythmic catches, capped difficulty/speed, pause, per-game score persistence');
