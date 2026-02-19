// Jobs Module
// Background job initialization and exports

export {
  ruleEvaluationQueue,
  ruleEvaluationScheduler,
  ruleEvaluationWorker,
  scheduleAllMunicipalityEvaluations,
  scheduleMunicipalityEvaluation,
  setupPeriodicEvaluation,
  shutdownRuleEvaluation,
} from './rule-evaluation.job.js';

export {
  escalationQueue,
  escalationScheduler,
  escalationWorker,
  scheduleAlertEscalation,
  setupPeriodicEscalationCheck,
  shutdownEscalation,
} from './escalation.job.js';

export {
  expirationQueue,
  expirationScheduler,
  expirationWorker,
  scheduleAlertExpiration,
  setupPeriodicExpirationCheck,
  shutdownExpiration,
} from './expiration.job.js';

// Initialize all jobs
export async function initializeJobs(): Promise<void> {
  const { setupPeriodicEvaluation } = await import('./rule-evaluation.job.js');
  const { setupPeriodicEscalationCheck } = await import('./escalation.job.js');
  const { setupPeriodicExpirationCheck } = await import('./expiration.job.js');

  // Setup periodic rule evaluation (every 5 minutes)
  await setupPeriodicEvaluation(5);

  // Setup periodic escalation check (every 10 minutes)
  await setupPeriodicEscalationCheck(10);

  // Setup periodic expiration check (every 5 minutes)
  await setupPeriodicExpirationCheck(5);

  console.log('[Jobs] All jobs initialized');
}

// Graceful shutdown
export async function shutdownJobs(): Promise<void> {
  const { shutdownRuleEvaluation } = await import('./rule-evaluation.job.js');
  const { shutdownEscalation } = await import('./escalation.job.js');
  const { shutdownExpiration } = await import('./expiration.job.js');

  await Promise.all([
    shutdownRuleEvaluation(),
    shutdownEscalation(),
    shutdownExpiration(),
  ]);

  console.log('[Jobs] All jobs shutdown');
}
