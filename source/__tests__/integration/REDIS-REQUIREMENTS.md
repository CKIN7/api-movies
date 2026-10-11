# Redis Integration Test Requirements

## Overview

This directory contains integration tests for the rate limiter feature, with two test suites:

1. **`rate-limiter.integration.test.ts`** - Mock-based tests using `ioredis-mock`
2. **`rate-limiter.redis.integration.test.ts`** - Real Redis tests using actual Redis instance

---

## Test Suites

### 1. Mock-Based Tests (`rate-limiter.integration.test.ts`)

| Property | Value |
|----------|-------|
| **Redis required** | No |
| **Mock library** | `ioredis-mock` |
| **Test duration** | ~3 seconds |
| **What it covers** | - Middleware application<br>- Rate limit configuration (global=100, auth=10, write=30, user=500)<br>- Basic request flow |
| **Limitations** | - Cannot test 429 responses precisely<br>- Cannot test penalty box<br>- Lua script algorithms not fully supported |
| **Run command** | `npx jest --testPathPatterns="rate-limiter" --forceExit` |
| **CI/CD compatible** | ✅ Yes - no Redis dependency |

**Purpose:** Fast feedback in CI/CD, testing that middleware is correctly configured and configuration values are correct.

---

### 2. Real Redis Tests (`rate-limiter.redis.integration.test.ts`)

| Property | Value |
|----------|-------|
| **Redis required** | Yes - must be running on `localhost:6379` |
| **Lua scripts** | Required - scripts loaded via `SCRIPT LOAD` |
| **Test duration** | ~5 seconds |
| **What it covers** | - Full rate limit enforcement (429 responses)<br>- Penalty box activation & expiry<br>- All scope configs (global/auth/write/user)<br>- Header presence (X-RateLimit-*) |
| **Limitations** | - Requires Redis instance<br>- Tests depend on prior state if not cleaned |
| **Run command** | `npx jest --testPathPatterns="rate-limiter.redis" --forceExit` |
| **Known issue** | First run with fresh Redis may need 35 iterations for penalty box (fixed in current implementation) |

**Purpose:** Full feature testing including rate limit enforcement, penalty box, and all scope behaviors. Requires Redis.

**Purpose:** Full feature testing including rate limit enforcement, penalty box, and all scope behaviors. Requires Redis.

---

## Redis Requirements (Real Tests)

### Installation

#### Option A: Docker (recommended)
```bash
docker run -d -p 6379:6379 redis:7-alpine
```

#### Option B: Windows
1. Install Redis from [redis.io](https://redis.io/docs/quickstart/)
2. Or use WSL2 with Docker
3. Or use [Memurai](https://memurai.io/) as Redis-compatible alternative

#### Option C: Via Package Manager
```bash
# macOS
brew install redis

# Windows (via winget)
winget install Redis.Redis

# Linux
sudo apt-get install redis-server  # Debian/Ubuntu
sudo yum install redis             # RHEL/CentOS
```

### Configuration

The tests connect to: `redis://localhost:6379`

Configuration is read from `source/.env`:
```
REDIS_URL=redis://localhost:6379
```

### What Happens During Tests

1. **Connection:** `connectRedis()` establishes connection to localhost:6379
2. **Lua Scripts:** `loadLuaScripts()` loads the sliding window Lua script (`LUA_SLIDING_WINDOW`)
3. **Test Execution:** Tests make requests through the rate limiter middleware
4. **Cleanup (`beforeEach`):** All `ratelimit:*`, `penalty:*`, `blocked:*` keys are deleted
5. **State:** Redis persists state between tests within a run, but `beforeEach` resets it

### Lua Script Requirements

The tests require the Lua sliding window script to be loaded. The script is at:
`source/utils/redisClient.ts` - `LUA_SLIDING_WINDOW` constant

If scripts aren't loaded, tests will fail with: `TypeError: client.script is not a function`

The script handles:
- Sliding window rate limiting
- Counter incrementation
- Window boundary management
- Allows `executeSlidingWindow()` in `rateLimiterStrategies.ts` to work

---

## Running the Tests

### Mock Tests (No Redis needed)
```bash
cd source
npx jest --testPathPatterns="rate-limiter" --forceExit
```

**Expected output:** 5 tests passing

### Real Redis Tests (Redis must be running)
```bash
# Start Redis (example Docker)
docker run -d -p 6379:6379 redis:7-alpine

# Run tests
cd source
npx jest --testPathPatterns="rate-limiter.redis" --forceExit
```

**Expected output:** 7 tests passing

### Both Test Suites
```bash
# Run both
npx jest --testPathPatterns="rate-limiter" --forceExit
```

This will run the mock tests first, then the Redis tests (if Redis is available).

---

## Known Limitations

### Mock (`ioredis-mock`)
- Does not support Lua script `EVALSHA` execution
- Cannot test exact counter enforcement (429 after N requests)
- Penalty box cannot be tested
- Only verifies middleware application and configuration

### Real Redis
- Requires Redis instance running and accessible
- Tests modify Redis state (cleared between tests via `beforeEach`)
- First run with fresh Redis: penalty box may need ~35 iterations to activate (fixed)
- Second+ runs: faster due to persistent state (unless `beforeEach` cleanup runs)

### Test Isolation
- `beforeEach` clears: `ratelimit:*`, `penalty:*`, `blocked:*`
- Redis connection is shared across tests (singleton pattern)
- Run order matters if cleanup fails
- Recommendation: Run each test suite independently for cleanest state

---

## Test Coverage Summary

| Feature | Mock Tests | Real Redis |
|---------|-----------|------------|
| Middleware application | ✅ 1 test | ✅ 1 test |
| Config verification (limits) | ✅ 4 tests | ✅ 4 tests |
| Global rate limit enforcement | ❌ | ✅ (after ~105 requests) |
| Auth rate limit enforcement | ❌ | ✅ (after 35 requests) |
| Write rate limit enforcement | ❌ | ❌ (not tested) |
| User rate limit enforcement | ❌ | ❌ (not tested) |
| Penalty box activation | ❌ | ✅ (after 20 rejections in 5 min) |
| Penalty duration expiry | ❌ | ✅ |
| Header presence | ✅ | ✅ |

---

## Development Notes

### Adding New Tests

#### For Mock Tests:
- Follow existing pattern in `rate-limiter.integration.test.ts`
- Use `ioredis-mock` for Redis simulation
- Test middleware application and config values
- Cannot test exact 429 thresholds

#### For Real Redis Tests:
- Follow existing pattern in `rate-limiter.redis.integration.test.ts`
- Ensure Redis is running before test suite
- `beforeEach` cleans state between tests
- May need adjustment for fresh Redis vs state-persistent runs

### Penalty Box on Fresh Redis

**Issue:** First run with clean Redis may not activate penalty box with 25 iterations.

**Fix:** Increased loop iterations from 25 → 35 in the test to ensure 20 rejects are accumulated even starting from empty Redis state.

**Root cause:** With auth limit=10/min and fresh Redis, the sliding window needs enough requests to both:
1. Exceed the 10/min limit repeatedly
2. Accumulate 20 rejections within the 5-minute penalty window

35 iterations from fresh Redis reliably achieves this.

---

## Version & Maintainance

- **Since:** Implementation of `feature/redis-rate-limiter` branch
- **Test files:** 2 files in `source/__tests__/integration/`
- **Redis version:** Compatible with Redis 7+ (Lua script support)
- **Lua script:** `LUA_SLIDING_WINDOW` in `utils/redisClient.ts`
- **Last updated:** Current session (rate limiter integration tests)

---