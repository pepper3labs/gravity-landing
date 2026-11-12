import {test} from 'node:test';import assert from 'node:assert/strict';import {verifyExpedition} from '../scripts/expedition-verification';import {rankScore} from '../src/economy';
test('full 30-level pure expedition replays actual physics with inherited resources and durable progress',()=>{
 const r=verifyExpedition({name:'pure',extraFuel:0,damagePerLeg:0});assert.equal(r.completed,30);assert.ok(r.passed);assert.ok(r.rows.some(row=>row.startFuel<240));assert.equal(r.expedition!.pure,true);assert.ok(rankScore(r.expedition!,'pure'));assert.ok(rankScore(r.expedition!,'overall'));
});
