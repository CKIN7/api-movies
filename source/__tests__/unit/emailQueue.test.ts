import { enqueueEmail } from '../../queues/emailQueue'
import type { EmailMessage } from '../../services/EmailService'

// El factory real instancia 3 `Queue` de BullMQ (y abre conexiones Redis).
// Aca solo interesa el contrato de `enqueueEmail`, asi que se stubea.
jest.mock('../../queues/queueFactory', () => {
    const add = jest.fn().mockResolvedValue({ id: 'job-1' })
    return {
        __add: add,
        emailCriticalQueue: { add },
        emailTransactionalQueue: { add },
        emailMarketingQueue: { add },
    }
})

const factory = jest.requireMock('../../queues/queueFactory') as { __add: jest.Mock }

const message: EmailMessage = {
    template: 'verification',
    to: 'user@example.com',
    data: { url: 'http://localhost:8089/auth/verify/tok-1' },
}

describe('enqueueEmail', () => {
    beforeEach(() => {
        factory.__add.mockClear()
    })

    // Regresión del bug `Custom Id cannot contain :` de BullMQ: antes de
    // este guard el error salia desde `queue.add` y el catch best-effort
    // de register/resend lo silenciaba, asi que ningun email se encolaba.
    test('rechaza un jobId con ":" antes de llamar a BullMQ', async () => {
        await expect(
            enqueueEmail('critical', message, { jobId: 'verification:tok-1' }),
        ).rejects.toThrow(/jobId no puede contener ":"/)

        expect(factory.__add).not.toHaveBeenCalled()
    })

    test('acepta un jobId sin ":" y lo propaga a add', async () => {
        const id = await enqueueEmail('critical', message, { jobId: 'verification-uuid-1' })

        expect(id).toBe('job-1')
        expect(factory.__add).toHaveBeenCalledWith('critical:verification', message, {
            jobId: 'verification-uuid-1',
        })
    })

    test('sin jobId no agrega la opcion (BullMQ genera el id)', async () => {
        await enqueueEmail('marketing', message)

        expect(factory.__add).toHaveBeenCalledWith('marketing:verification', message, {})
    })
})
