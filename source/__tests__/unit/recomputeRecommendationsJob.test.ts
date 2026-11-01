import {
    processRecsRecomputeAllJob,
    processRecsRecomputeUserJob,
} from '../../jobs/recomputeRecommendationsJob'
import type { RecomputeUserResult } from '../../types/recommendation'

const result = (overrides: Partial<RecomputeUserResult> = {}): RecomputeUserResult => ({
    userId: 'user-1',
    cachedTypes: 3,
    recommendations: 10,
    skipped: false,
    durationMs: 5,
    ...overrides,
})

describe('processRecsRecomputeUserJob', () => {
    test('delega el recompute del usuario en el service', async () => {
        const recomputeForUser = jest.fn().mockResolvedValue(result())
        const service = { recomputeForUser }

        await processRecsRecomputeUserJob({ userId: 'user-1', reason: 'invalidation' }, service)

        expect(recomputeForUser).toHaveBeenCalledWith('user-1')
    })
})

describe('processRecsRecomputeAllJob', () => {
    const date = '2026-11-01'
    const now = () => new Date('2026-11-01T03:00:00Z')

    test('procesa en lotes, reporta progreso y resume el resultado', async () => {
        const recomputeForUser = jest.fn().mockResolvedValue(result())
        const onProgress = jest.fn()

        const summary = await processRecsRecomputeAllJob(
            { recomputeForUser },
            {
                users: ['u1', 'u2', 'u3'],
                batchSize: 2,
                now,
                onProgress,
            },
        )

        expect(summary).toMatchObject({ processed: 3, failed: 0, ready: 0, date })
        expect(onProgress).toHaveBeenNthCalledWith(1, 2, 3)
        expect(onProgress).toHaveBeenNthCalledWith(2, 3, 3)
    })

    test('emite recs.ready solo para usuarios con recomendaciones', async () => {
        const recomputeForUser = jest
            .fn()
            .mockResolvedValueOnce(result({ userId: 'u1', recommendations: 4 }))
            .mockResolvedValueOnce(result({ userId: 'u2', recommendations: 0 }))
            .mockResolvedValueOnce(result({ userId: 'u3', skipped: true, cachedTypes: 0, recommendations: 0 }))
        const notifyReady = jest.fn().mockResolvedValue(undefined)

        const summary = await processRecsRecomputeAllJob(
            { recomputeForUser },
            { users: ['u1', 'u2', 'u3'], now, notifyReady },
        )

        expect(notifyReady).toHaveBeenCalledTimes(1)
        expect(notifyReady).toHaveBeenCalledWith('u1', 4, date)
        expect(summary).toMatchObject({ processed: 2, failed: 0, ready: 1 })
    })

    test('un fallo de recs.ready no corta el lote', async () => {
        const recomputeForUser = jest
            .fn()
            .mockResolvedValueOnce(result({ userId: 'u1', recommendations: 4 }))
            .mockResolvedValueOnce(result({ userId: 'u2', recommendations: 2 }))
        const notifyReady = jest
            .fn()
            .mockRejectedValueOnce(new Error('redis down'))
            .mockResolvedValueOnce(undefined)

        const summary = await processRecsRecomputeAllJob(
            { recomputeForUser },
            { users: ['u1', 'u2'], now, notifyReady },
        )

        expect(summary).toMatchObject({ processed: 2, failed: 0, ready: 1 })
    })

    test('un usuario que falla no corta el resto del lote', async () => {
        const recomputeForUser = jest
            .fn()
            .mockRejectedValueOnce(new Error('db error'))
            .mockResolvedValueOnce(result({ userId: 'u2' }))

        const summary = await processRecsRecomputeAllJob(
            { recomputeForUser },
            { users: ['u1', 'u2'], now },
        )

        expect(summary).toMatchObject({ processed: 1, failed: 1 })
    })

    test('si fallan todos los usuarios, lanza para que BullMQ reintente', async () => {
        const recomputeForUser = jest.fn().mockRejectedValue(new Error('db down'))

        await expect(
            processRecsRecomputeAllJob(
                { recomputeForUser },
                { users: ['u1', 'u2'], now },
            ),
        ).rejects.toThrow('fallo para los 2 usuarios')
    })

    test('sin usuarios completa sin llamar al service', async () => {
        const recomputeForUser = jest.fn()

        const summary = await processRecsRecomputeAllJob(
            { recomputeForUser },
            { users: [], now },
        )

        expect(summary).toMatchObject({ processed: 0, failed: 0, ready: 0, date })
        expect(recomputeForUser).not.toHaveBeenCalled()
    })
})
