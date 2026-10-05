import test from 'node:test';
import assert from 'node:assert/strict';
import {configuration, requestTick, runLoop} from './runtime.mjs';

const token = 'a'.repeat(64);
test('observation is the default and explicit paper requests remain scoped', () => {
  assert.equal(configuration({AXIOM_WORKER_TOKEN:token}).dryRun, true);
  assert.equal(configuration({AXIOM_WORKER_TOKEN:token, AXIOM_DRY_RUN:'false'}).dryRun, false);
});
test('rejects unapproved origins, redirects in configuration, and malformed secrets', () => {
  for (const url of ['http://www.gettradecue.com', 'https://attacker.example', 'https://www.gettradecue.com/?key=a', 'https://user@www.gettradecue.com']) assert.throws(() => configuration({AXIOM_WORKER_TOKEN:token, TRADECUE_BASE_URL:url}));
  assert.throws(() => configuration({AXIOM_WORKER_TOKEN:'invalid'}));
});
test('only calls the scoped tick endpoint, refuses redirects, and sends observe mode', async () => {
  const config=configuration({AXIOM_WORKER_TOKEN:token});
  const result=await requestTick(config, async (url,options) => {
    assert.equal(url, 'https://www.gettradecue.com/_api/bot/worker-tick');
    assert.equal(options.redirect, 'error');
    assert.deepEqual(JSON.parse(options.body), {json:{dryRun:true}});
    return {ok:true,json:async()=>({json:{status:'WAITING',checkedAt:new Date().toISOString(),nextCheckMs:300000}})};
  });
  assert.equal(result.nextCheckMs,300000);
});
test('authentication failures terminate without another request', async () => {
  let calls=0;
  await assert.rejects(runLoop({tick:async()=>{calls++;const e=new Error();e.fatal=true;throw e;},sleep:async()=>assert.fail('must not sleep'),stopping:()=>false,log:()=>{}}));
  assert.equal(calls,1);
});
test('transient failures back off and successful requests run serially', async () => {
  let calls=0,active=0,maxActive=0;const delays=[];
  await runLoop({tick:async()=>{active++;maxActive=Math.max(maxActive,active);await Promise.resolve();active--;calls++;if(calls<3)throw new Error();return {status:'WAITING',nextCheckMs:30000};},sleep:async ms=>{delays.push(ms);},stopping:()=>calls>=3,log:()=>{}});
  assert.deepEqual(delays,[60000,120000]);assert.equal(maxActive,1);
});

