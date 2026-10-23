// Runs the background jobs of the web process: once at boot (to catch up on anything due while the server was
// down) and then on a cron schedule. A failure is logged and never stops the server or the next run.
// Every job is idempotent, so a missed or repeated run is harmless; with several instances each one would run
// them all (see the scalability notes before scaling out).
const cron = require('node-cron');

/** Runs `job.run()` once and logs `[name] <label>: <describe(result)>` (when the job has a describe) or the failure. Never rejects. */
function runOnce(job, label) {
  let started;
  try {
    started = Promise.resolve(job.run()); // starts right away, like the inline calls it replaced
  } catch (err) {
    started = Promise.reject(err);
  }
  return started
    .then((result) => { if (job.describe) console.log(`[${job.name}] ${label}: ${job.describe(result)}`); })
    .catch((err) => console.error(`[${job.name}] ${label} failed:`, err.message));
}

/**
 * @param {Array<{ name: string, cron: string, label: string, atBoot?: boolean,
 *                 run: () => Promise<any>, describe?: (result: any) => string }>} jobs
 * @param {object} [deps] injectable for tests
 * @returns {object[]} the cron tasks
 */
function startJobs(jobs, { schedule = cron.schedule } = {}) {
  for (const job of jobs) if (job.atBoot) runOnce(job, 'Startup pass');
  return jobs.map((job) => schedule(job.cron, () => runOnce(job, job.label)));
}

module.exports = { startJobs, runOnce };
