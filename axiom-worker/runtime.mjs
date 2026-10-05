export function configuration(env) {
  const base = new URL(env.TRADECUE_BASE_URL || 'https://www.gettradecue.com');
  if (base.protocol !== 'https:' || !['www.gettradecue.com', 'gettradecue.com', 'cuetrade.floot.app'].includes(base.hostname) || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('Use the approved TradeCUE HTTPS origin.');
  const token = env.AXIOM_WORKER_TOKEN || '';
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('A scoped worker token is required.');
  if (env.AXIOM_DRY_RUN != null && !['true', 'false'].includes(env.AXIOM_DRY_RUN)) throw new Error('AXIOM_DRY_RUN must be true or false.');
  return {endpoint: new URL('/_api/bot/worker-tick', base).href, token, dryRun: env.AXIOM_DRY_RUN !== 'false'};
}

export async function requestTick(config, fetcher = fetch) {
  const response = await fetcher(config.endpoint, {
    method: 'POST', redirect: 'error',
    headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + config.token},
    body: JSON.stringify({json: {dryRun: config.dryRun}}),
    signal: AbortSignal.timeout(90000),
  });
  if (!response.ok) {
    const error = new Error('Worker endpoint returned HTTP ' + response.status);
    error.fatal = response.status === 401 || response.status === 403;
    throw error;
  }
  const envelope = await response.json();
  const result = envelope.json;
  if (!result || typeof result.status !== 'string' || typeof result.checkedAt !== 'string') throw new Error('Invalid worker response.');
  return {status: result.status, nextCheckMs: result.nextCheckMs === 300000 ? 300000 : 30000};
}

export async function runLoop({tick, sleep, stopping, log}) {
  let failures = 0;
  while (!stopping()) {
    let delay;
    try {
      const result = await tick();
      failures = 0;
      log('Check-in: ' + result.status);
      delay = result.nextCheckMs;
    } catch (error) {
      log(error.fatal ? 'Access refused; worker stopping.' : 'Check-in failed; backing off.');
      if (error.fatal) throw error;
      delay = Math.min(300000, 60000 * 2 ** Math.min(failures++, 3));
    }
    if (!stopping()) await sleep(delay);
  }
}

