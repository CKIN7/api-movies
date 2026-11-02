import { Queue } from 'bullmq';
import { createQueue } from '../../queues/queueFactory';
import { QueueNames, queueOptions } from '../../config/bullmq';

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

  // BullMQ procesa primero el numero MENOR de prioridad ("lower numbers are
  // processed before higher numbers") y `0` significa "sin prioridad
  // explicita", jobs que se procesan antes que cualquier priorizado.
  test('toda cola tiene prioridad explicita mayor que cero', () => {
    Object.values(QueueNames).forEach((name) => {
      const priority = queueOptions[name].defaultJobOptions?.priority;
      expect(priority).toBeDefined();
      expect(priority).toBeGreaterThan(0);
    });
  });

  test('el correo critical se procesa antes que el transaccional y el de marketing', () => {
    const priority = (name: (typeof QueueNames)[keyof typeof QueueNames]) =>
      queueOptions[name].defaultJobOptions?.priority as number;

    expect(priority(QueueNames.EMAIL_CRITICAL)).toBeLessThan(
      priority(QueueNames.EMAIL_TRANSACTIONAL)
    );
    expect(priority(QueueNames.EMAIL_TRANSACTIONAL)).toBeLessThan(
      priority(QueueNames.EMAIL_MARKETING)
    );
  });

  test('el fan-out de notificaciones se procesa antes que la notificacion in-app', () => {
    const priority = (name: (typeof QueueNames)[keyof typeof QueueNames]) =>
      queueOptions[name].defaultJobOptions?.priority as number;

    expect(priority(QueueNames.NOTIFICATION_FANOUT)).toBeLessThan(
      priority(QueueNames.NOTIFICATION_INAPP)
    );
  });

  test('el recompute por usuario se procesa antes que el recompute global', () => {
    const priority = (name: (typeof QueueNames)[keyof typeof QueueNames]) =>
      queueOptions[name].defaultJobOptions?.priority as number;

    expect(priority(QueueNames.RECS_RECOMPUTE_USER)).toBeLessThan(
      priority(QueueNames.RECS_RECOMPUTE_ALL)
    );
  });

  test('createQueue propaga la prioridad de la cola a defaultJobOptions', () => {
    createQueue(QueueNames.EMAIL_CRITICAL);
    expect(Queue).toHaveBeenCalledWith(
      QueueNames.EMAIL_CRITICAL,
      expect.objectContaining({
        defaultJobOptions: expect.objectContaining({ priority: 1 }),
      })
    );
  });
});