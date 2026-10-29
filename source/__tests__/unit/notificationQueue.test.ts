import { enqueueNotificationFanout, enqueueNotificationInApp } from '../../queues/notificationQueue'

// El factory real instancia dos `Queue` de BullMQ (y abre conexiones
// Redis). Aca solo interesa el contrato del productor.
jest.mock('../../queues/queueFactory', () => {
    const fanoutAdd = jest.fn().mockResolvedValue({ id: 'fanout-1' })
    const inAppAdd = jest.fn().mockResolvedValue({ id: 'inapp-1' })
    return {
        __fanoutAdd: fanoutAdd,
        __inAppAdd: inAppAdd,
        notificationFanoutQueue: { add: fanoutAdd },
        notificationInAppQueue: { add: inAppAdd },
    }
})

const factory = jest.requireMock('../../queues/queueFactory') as {
    __fanoutAdd: jest.Mock
    __inAppAdd: jest.Mock
}

const event = {
    event: 'review.published',
    userId: 'user-1',
    payload: { movieId: 27205, movieTitle: 'Inception', reviewId: '17' },
}

const inApp = {
    userId: 'user-1',
    type: 'review.published',
    payload: { reviewId: '17' },
}

describe('notificationQueue', () => {
    beforeEach(() => {
        factory.__fanoutAdd.mockClear()
        factory.__inAppAdd.mockClear()
    })

    describe('enqueueNotificationFanout', () => {
        test('rechaza un jobId con ":" antes de llamar a BullMQ', async () => {
            await expect(
                enqueueNotificationFanout(event, { jobId: 'fanout:1' }),
            ).rejects.toThrow(/jobId no puede contener ":"/)

            expect(factory.__fanoutAdd).not.toHaveBeenCalled()
        })

        test('usa el evento como nombre de job y propaga el payload', async () => {
            const id = await enqueueNotificationFanout(event, { jobId: 'fanout-1' })

            expect(id).toBe('fanout-1')
            expect(factory.__fanoutAdd).toHaveBeenCalledWith('review.published', event, {
                jobId: 'fanout-1',
            })
        })

        test('sin jobId no agrega la opcion', async () => {
            await enqueueNotificationFanout(event)

            expect(factory.__fanoutAdd).toHaveBeenCalledWith('review.published', event, {})
        })
    })

    describe('enqueueNotificationInApp', () => {
        test('usa el tipo como nombre de job y propaga el payload', async () => {
            const id = await enqueueNotificationInApp(inApp)

            expect(id).toBe('inapp-1')
            expect(factory.__inAppAdd).toHaveBeenCalledWith('review.published', inApp, {})
        })

        test('rechaza un jobId con ":"', async () => {
            await expect(
                enqueueNotificationInApp(inApp, { jobId: 'inapp:1' }),
            ).rejects.toThrow(/jobId no puede contener ":"/)

            expect(factory.__inAppAdd).not.toHaveBeenCalled()
        })
    })
})