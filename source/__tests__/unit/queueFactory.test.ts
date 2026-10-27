import { Queue } from 'bullmq';
import { createQueue } from '../../queues/queueFactory';
import { QueueNames } from '../../config/bullmq';

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    name: 'test',
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('QueueFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createQueue returns a Queue instance with correct name', () => {
    const queue = createQueue(QueueNames.EMAIL_CRITICAL);
    expect(Queue).toHaveBeenCalledWith(
      QueueNames.EMAIL_CRITICAL,
      expect.objectContaining({
        connection: expect.any(Object),
        defaultJobOptions: expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        }),
      })
    );
    expect(queue).toBeDefined();
  });

  test('createQueue merges custom options with defaults', () => {
    const customOptions = {
      defaultJobOptions: { attempts: 5 },
    };
    createQueue(QueueNames.EMAIL_TRANSACTIONAL, customOptions);
    expect(Queue).toHaveBeenCalledWith(
      QueueNames.EMAIL_TRANSACTIONAL,
      expect.objectContaining({
        defaultJobOptions: expect.objectContaining({
          attempts: 5,
        }),
      })
    );
  });

  test('all queue names are exported', () => {
    expect(QueueNames.EMAIL_CRITICAL).toBe('email-critical');
    expect(QueueNames.EMAIL_TRANSACTIONAL).toBe('email-transactional');
    expect(QueueNames.EMAIL_MARKETING).toBe('email-marketing');
    expect(QueueNames.NOTIFICATION_FANOUT).toBe('notification-fanout');
    expect(QueueNames.NOTIFICATION_INAPP).toBe('notification-inapp');
    expect(QueueNames.RECS_RECOMPUTE_USER).toBe('recs-recompute-user');
    expect(QueueNames.RECS_RECOMPUTE_ALL).toBe('recs-recompute-all');
  });

  test('queue names are valid for BullMQ (no colon)', () => {
    Object.values(QueueNames).forEach((name) => {
      expect(name).not.toContain(':');
    });
  });
});