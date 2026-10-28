import EmailService from '../../services/EmailService'
import type { ResendLike } from '../../services/EmailService'

function createMockClient() {
    const client: ResendLike = {
        emails: {
            send: jest.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null }),
        },
    }
    return client
}

describe('EmailService', () => {
    test('sin proveedor queda en modo dev: renderiza pero no envia', async () => {
        const service = new EmailService({ apiKey: '' })

        expect(service.isEnabled()).toBe(false)
        await expect(
            service.send({
                template: 'verification',
                to: 'nuevo@example.com',
                data: { url: 'http://localhost:8089/auth/verify/token-1' },
            }),
        ).resolves.toBeUndefined()
    })

    test('renderiza el HTML con la url del template', async () => {
        const service = new EmailService({ apiKey: '' })

        const rendered = await service.render({
            template: 'verification',
            to: 'nuevo@example.com',
            data: { url: 'http://localhost:8089/auth/verify/token-1' },
        })

        expect(rendered.subject).toBe('Verifica tu cuenta')
        expect(rendered.html).toContain('http://localhost:8089/auth/verify/token-1')
    })

    test('rechaza un template desconocido', async () => {
        const service = new EmailService({ apiKey: '' })

        await expect(
            service.send({ template: 'no-existe', to: 'a@b.com', data: {} }),
        ).rejects.toThrow(/Template de email desconocido/)
    })

    test('con proveedor delega en Resend con from/to/subject/html', async () => {
        const client = createMockClient()
        const service = new EmailService({ client, from: 'no-reply@api-movies.test' })

        await service.send({
            template: 'password-reset',
            to: 'user@example.com',
            data: { url: 'http://localhost:8089/auth/reset/token-2' },
        })

        expect(client.emails.send).toHaveBeenCalledTimes(1)
        expect(client.emails.send).toHaveBeenCalledWith(
            expect.objectContaining({
                from: 'no-reply@api-movies.test',
                to: 'user@example.com',
                subject: 'Restablece tu contraseña',
                html: expect.stringContaining('http://localhost:8089/auth/reset/token-2'),
            }),
        )
    })

    test('propaga el error del proveedor', async () => {
        const client = createMockClient()
        ;(client.emails.send as jest.Mock).mockResolvedValue({
            data: null,
            error: { message: 'rate limited' },
        })
        const service = new EmailService({ client })

        await expect(
            service.send({ template: 'welcome', to: 'user@example.com', data: {} }),
        ).rejects.toThrow(/rate limited/)
    })

    test('sendBatch envia todos los mensajes en orden', async () => {
        const client = createMockClient()
        const service = new EmailService({ client })

        await service.sendBatch([
            { template: 'welcome', to: 'a@example.com', data: {} },
            { template: 'welcome', to: 'b@example.com', data: {} },
        ])

        expect(client.emails.send).toHaveBeenCalledTimes(2)
        const recipients = (client.emails.send as jest.Mock).mock.calls.map((call) => call[0].to)
        expect(recipients).toEqual(['a@example.com', 'b@example.com'])
    })
})
