import QueuedReviewPublishedNotifier from '../../notifiers/QueuedReviewPublishedNotifier'

jest.mock('../../queues/notificationQueue', () => ({
    enqueueNotificationFanout: jest.fn().mockResolvedValue('job-1'),
}))

const { enqueueNotificationFanout } = jest.requireMock('../../queues/notificationQueue') as {
    enqueueNotificationFanout: jest.Mock
}

describe('QueuedReviewPublishedNotifier', () => {
    beforeEach(() => {
        enqueueNotificationFanout.mockClear()
    })

    test('encola el evento review.published con jobId determinístico sin ":"', async () => {
        await new QueuedReviewPublishedNotifier().notifyReviewPublished({
            userId: 'user-1',
            reviewId: '17',
            movieId: 27205,
            movieTitle: 'Inception',
        })

        expect(enqueueNotificationFanout).toHaveBeenCalledWith(
            {
                event: 'review.published',
                userId: 'user-1',
                payload: { movieId: 27205, movieTitle: 'Inception', reviewId: '17' },
            },
            { jobId: 'review-published-17' },
        )

        const jobId = enqueueNotificationFanout.mock.calls[0][1].jobId as string
        expect(jobId).not.toContain(':')
    })
})