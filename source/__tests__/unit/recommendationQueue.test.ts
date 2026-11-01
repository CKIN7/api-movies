import {
    enqueueRecsRecomputeAll,
    enqueueRecsRecomputeUser,
} from '../../queues/recommendationQueue'

// El factory real abre conexiones Redis al importarse. Aca solo interesa
// el contrato del productor (payload, jobId y dedupe por ventana).
jest.mock('../../queues/queueFactory', () => {
    const userAdd = jest.fn().mockResolvedValue({ id: 'recs-user-1' })
    const allAdd = jest.fn().mockResolvedValue({ id: 'recs-all-1' })
    return {
        __userAdd: userAdd,
        __allAdd: allAdd,
        recsRecomputeUserQueue: { add: userAdd },
        recsRecomputeAllQueue: { add: allAdd },
    }
})

const factory = jest.requireMock('../../queues/queueFactory') as {
    __userAdd: jest.Mock
    __allAdd: jest.Mock
}

describe('recommendationQueue', () => {
    beforeEach(() => {
        factory.__userAdd.mockClear()
        factory.__allAdd.mockClear()
    })

    describe('enqueueRecsRecomputeUser', () => {
        test('usa un jobId por usuario y minuto', async () => {
            const now = 1_700_000_000_000
            const id = await enqueueRecsRecomputeUser('user-1', { now })

            expect(id).toBe('recs-user-1')
            expect(factory.__userAdd).toHaveBeenCalledWith(
                'recs-recompute-user',
                { userId: 'user-1', reason: 'invalidation' },
                { jobId: 'recs-user-user-1-28333333' },
            )
        })

        test('dedupe: dos eventos del mismo minuto comparten jobId', async () => {
            await enqueueRecsRecomputeUser('user-1', { now: 1_700_000_000_000 })
            await enqueueRecsRecomputeUser('user-1', { now: 1_700_000_050_000 })

            const first = factory.__userAdd.mock.calls[0][2].jobId
            const second = factory.__userAdd.mock.calls[1][2].jobId
            expect(second).toBe(first)
        })

        test('un evento del minuto siguiente genera otro jobId', async () => {
            await enqueueRecsRecomputeUser('user-1', { now: 1_700_000_000_000 })
            await enqueueRecsRecomputeUser('user-1', { now: 1_700_000_060_000 })

            const first = factory.__userAdd.mock.calls[0][2].jobId
            const second = factory.__userAdd.mock.calls[1][2].jobId
            expect(second).not.toBe(first)
        })

        test('rechaza un jobId con ":" antes de llamar a BullMQ', async () => {
            await expect(
                enqueueRecsRecomputeUser('user-1', { jobId: 'recs:user' }),
            ).rejects.toThrow(/jobId no puede contener ":"/)

            expect(factory.__userAdd).not.toHaveBeenCalled()
        })
    })

    describe('enqueueRecsRecomputeAll', () => {
        test('encola el recompute masivo con reason manual', async () => {
            const id = await enqueueRecsRecomputeAll({ now: 1_700_000_000_000 })

            expect(id).toBe('recs-all-1')
            expect(factory.__allAdd).toHaveBeenCalledWith(
                'recs-recompute-all',
                { reason: 'manual' },
                { jobId: 'recs-all-28333333' },
            )
        })

        test('respeta un jobId explicito', async () => {
            await enqueueRecsRecomputeAll({ jobId: 'recs-all-manual-1' })

            expect(factory.__allAdd).toHaveBeenCalledWith(
                'recs-recompute-all',
                { reason: 'manual' },
                { jobId: 'recs-all-manual-1' },
            )
        })
    })
})
