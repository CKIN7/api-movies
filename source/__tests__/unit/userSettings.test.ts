import { UserSettingsService } from '../../services/userSettingsService'

const mockRepo = {
    findByUserId: jest.fn(),
    save: jest.fn(),
}

const fullRow = {
    user_id: 'u1',
    language: 'en',
    theme: 'dark',
    region: 'US',
    notify_email: 0,
    notify_push: 1,
    privacy_reviews: 'private',
    privacy_watchlist: 'friends',
    privacy_activity: 'public',
    spoiler_free: 1,
    updated_at: '2026-01-01T00:00:00.000Z',
}

describe('UserSettingsService (unit)', () => {
    let service: UserSettingsService

    beforeEach(() => {
        jest.clearAllMocks()
        service = new UserSettingsService(mockRepo as any)
    })

    test('devuelve defaults cuando no existe fila', async () => {
        mockRepo.findByUserId.mockResolvedValue(null)

        const result = await service.getSettings('u1')

        expect(result.language).toBe('es')
        expect(result.theme).toBe('system')
        expect(result.notifyEmail).toBe(true)
        expect(result.spoilerFree).toBe(false)
        expect(result.updatedAt).toBeNull()
    })

    test('mapea la fila y normaliza booleanos', async () => {
        mockRepo.findByUserId.mockResolvedValue(fullRow)

        const result = await service.getSettings('u1')

        expect(result.notifyEmail).toBe(false)
        expect(result.notifyPush).toBe(true)
        expect(result.spoilerFree).toBe(true)
        expect(result.privacyReviews).toBe('private')
    })

    test('hace merge parcial y llama a save', async () => {
        mockRepo.findByUserId
            .mockResolvedValueOnce(fullRow)
            .mockResolvedValueOnce({ ...fullRow, theme: 'light' })
        mockRepo.save.mockResolvedValue(undefined)

        await service.updateSettings('u1', { theme: 'light' })

        expect(mockRepo.save).toHaveBeenCalledWith('u1', expect.objectContaining({
            theme: 'light',
            language: 'en',
            notifyPush: true,
        }))
    })

    test('usa defaults al crear la primera config', async () => {
        mockRepo.findByUserId.mockResolvedValue(null)
        mockRepo.save.mockResolvedValue(undefined)

        await service.updateSettings('u1', { spoilerFree: true })

        expect(mockRepo.save).toHaveBeenCalledWith('u1', expect.objectContaining({
            language: 'es',
            theme: 'system',
            spoilerFree: true,
        }))
    })
})
