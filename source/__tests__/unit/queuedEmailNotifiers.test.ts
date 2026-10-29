import QueuedEmailVerificationNotifier from '../../notifiers/QueuedEmailVerificationNotifier'
import QueuedPasswordResetNotifier from '../../notifiers/QueuedPasswordResetNotifier'

jest.mock('../../queues/emailQueue', () => ({
    enqueueEmail: jest.fn().mockResolvedValue('job-1'),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { enqueueEmail } = require('../../queues/emailQueue') as { enqueueEmail: jest.Mock }

describe('QueuedEmailVerificationNotifier', () => {
    beforeEach(() => enqueueEmail.mockClear())

    test('encola verification en email-critical con jobId idempotente por token', async () => {
        await new QueuedEmailVerificationNotifier().sendVerificationEmail(
            'user@example.com',
            'tok-1',
        )

        expect(enqueueEmail).toHaveBeenCalledWith(
            'critical',
            expect.objectContaining({ template: 'verification', to: 'user@example.com' }),
            { jobId: 'verification-tok-1' },
        )
        // Regresión: BullMQ lanza `Custom Id cannot contain :`.
        expect(enqueueEmail.mock.calls[0][2].jobId).not.toContain(':')
        const message = enqueueEmail.mock.calls[0][1]
        expect(message.data.url).toContain('/auth/verify/tok-1')
    })
})

describe('QueuedPasswordResetNotifier', () => {
    beforeEach(() => enqueueEmail.mockClear())

    test('encola password-reset en email-critical con jobId idempotente por token', async () => {
        await new QueuedPasswordResetNotifier().sendResetEmail('user@example.com', 'tok-2')

        expect(enqueueEmail).toHaveBeenCalledWith(
            'critical',
            expect.objectContaining({ template: 'password-reset', to: 'user@example.com' }),
            { jobId: 'password-reset-tok-2' },
        )
        // Regresión: BullMQ lanza `Custom Id cannot contain :`.
        expect(enqueueEmail.mock.calls[0][2].jobId).not.toContain(':')
        const message = enqueueEmail.mock.calls[0][1]
        expect(message.data.url).toContain('/auth/reset/tok-2')
    })
})
