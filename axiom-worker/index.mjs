import {setTimeout as pause} from 'node:timers/promises';
import {configuration, requestTick, runLoop} from './runtime.mjs';

let stopping = false;
const idle = new AbortController();
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  stopping = true;
  idle.abort();
});

try {
  const config = configuration(process.env);
  console.log('Axiom worker started in ' + (config.dryRun ? 'OBSERVE' : 'PAPER REQUEST') + ' mode. Server controls remain authoritative.');
  await runLoop({
    tick: () => requestTick(config), stopping: () => stopping,
    sleep: ms => pause(ms, undefined, {signal: idle.signal}).catch(error => {if (error.name !== 'AbortError') throw error;}),
    log: text => console.log(new Date().toISOString(), text),
  });
} catch {
  console.error('Worker stopped: configuration or authorization requires attention.');
  process.exitCode = 1;
}

