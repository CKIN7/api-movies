import { BaseWorker } from './baseWorker';
import { Job } from 'bullmq';
import logger from '../utils/logger';

class TestWorker extends BaseWorker {
  protected async processJob(job: Job): Promise<void> {
    logger.info(`[TestWorker] Processing job ${job.id}`, { data: job.data });
    await new Promise((resolve) => setTimeout(resolve, 100));
    logger.info(`[TestWorker] Job ${job.id} done`);
  }
}

const testWorker = new TestWorker({
  queueName: 'test',
  concurrency: 1,
});

logger.info('[Workers] Test worker started (queue: test)');

export { BaseWorker } from './baseWorker';
export { testWorker };

export async function closeAllWorkers(): Promise<void> {
  await testWorker.close();
}