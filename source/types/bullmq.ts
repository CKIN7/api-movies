import type { Job, Queue, Worker } from 'bullmq';
import { QueueNames } from '../config/bullmq';

export type QueueName = (typeof QueueNames)[keyof typeof QueueNames];

export interface JobPayloadMap {
  [QueueNames.EMAIL_CRITICAL]: {
    template: 'verification' | 'password-reset' | 'welcome';
    to: string;
    data: Record<string, unknown>;
    jobId: string;
  };
  [QueueNames.EMAIL_TRANSACTIONAL]: {
    template: 'review-published' | 'recs-ready' | 'watchlist-added';
    to: string;
    data: Record<string, unknown>;
  };
  [QueueNames.EMAIL_MARKETING]: {
    template: string;
    to: string;
    data: Record<string, unknown>;
  };
  [QueueNames.NOTIFICATION_FANOUT]: {
    event: string;
    userId: string;
    payload: Record<string, unknown>;
  };
  [QueueNames.NOTIFICATION_INAPP]: {
    userId: string;
    type: string;
    payload: Record<string, unknown>;
  };
  [QueueNames.RECS_RECOMPUTE_USER]: {
    userId: string;
  };
  [QueueNames.RECS_RECOMPUTE_ALL]: Record<string, never>;
}

export type JobPayload<T extends QueueName> = JobPayloadMap[T];

export type TypedJob<T extends QueueName> = Job<JobPayload<T>, void, string>;

export type TypedQueue<T extends QueueName> = Queue<JobPayload<T>, void, string>;

export type TypedWorker<T extends QueueName> = Worker<JobPayload<T>, void, string>;