import { config as dotenvConfig } from 'dotenv'
dotenvConfig()

export const rateLimitConfig = {
  global: {
    limit: Number(process.env.RATE_LIMIT_GLOBAL ?? 100),
    windowMs: Number(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS ?? 60_000),
  },
  auth: {
    limit: Number(process.env.RATE_LIMIT_AUTH ?? 10),
    windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS ?? 60_000),
  },
  write: {
    limit: Number(process.env.RATE_LIMIT_WRITE ?? 30),
    windowMs: Number(process.env.RATE_LIMIT_WRITE_WINDOW_MS ?? 60_000),
  },
  user: {
    limit: Number(process.env.RATE_LIMIT_USER ?? 500),
    windowMs: Number(process.env.RATE_LIMIT_USER_WINDOW_MS ?? 60_000),
  },
  penalty: {
    multiplier: Number(process.env.RATE_LIMIT_PENALTY_MULTIPLIER ?? 3),
    windowMs: Number(process.env.RATE_LIMIT_PENALTY_WINDOW_MS ?? 300_000),
    durationMs: Number(process.env.RATE_LIMIT_PENALTY_DURATION_MS ?? 900_000),
  },
  trustProxy: process.env.TRUST_PROXY === 'true',
  failOpen: process.env.RATE_LIMIT_FAIL_OPEN !== 'false',
} as const

export type RateLimitConfig = typeof rateLimitConfig