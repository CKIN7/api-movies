import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Resend } from 'resend'
import logger from '../utils/logger'
import VerificationEmail from './emailTemplates/VerificationEmail'
import PasswordResetEmail from './emailTemplates/PasswordResetEmail'
import WelcomeEmail from './emailTemplates/WelcomeEmail'
import ReviewPublishedEmail from './emailTemplates/ReviewPublishedEmail'

// ═══════════════════════════════════════════════════════════════
//  Patrón: Adapter (Resend) + Registry de templates
// ═══════════════════════════════════════════════════════════════
//  `EmailService` es el unico punto que habla con el proveedor.
//  El worker le pasa `{ template, to, data }`; el registry decide
//  asunto + componente y `render` genera el HTML.
//
//  Sin `RESEND_API_KEY` el servicio entra en modo dev: loguea el
//  correo en vez de enviarlo. Asi los tests y el entorno local no
//  dependen del proveedor ni gastan cuota.
// ═══════════════════════════════════════════════════════════════

export interface EmailMessage {
    /** Clave del registry: verification | password-reset | welcome | review-published */
    template: string
    to: string
    data: Record<string, unknown>
}

export interface RenderedEmail {
    subject: string
    html: string
}

/** Subconjunto de `resend` que usamos. Permite inyectar un stub en tests. */
export interface ResendLike {
    emails: {
        send(input: {
            from: string
            to: string
            subject: string
            html: string
        }): Promise<{ data?: unknown; error?: { message?: string } | null }>
    }
}

interface TemplateDefinition {
    subject: (data: Record<string, unknown>) => string
    build: (data: Record<string, unknown>) => ReactElement
}

function str(value: unknown): string {
    if (typeof value === 'string') return value
    if (value === null || value === undefined) return ''
    return String(value)
}

const templates: Record<string, TemplateDefinition> = {
    verification: {
        subject: () => 'Verifica tu cuenta',
        build: (data) => createElement(VerificationEmail, { url: str(data.url) }),
    },
    'password-reset': {
        subject: () => 'Restablece tu contraseña',
        build: (data) =>
            createElement(PasswordResetEmail, {
                url: str(data.url),
                expiresInMinutes:
                    typeof data.expiresInMinutes === 'number' ? data.expiresInMinutes : undefined,
            }),
    },
    welcome: {
        subject: () => 'Bienvenido a API Movies',
        build: (data) =>
            createElement(WelcomeEmail, {
                name: data.name ? str(data.name) : undefined,
                url: data.url ? str(data.url) : undefined,
            }),
    },
    'review-published': {
        subject: (data) => `Tu review de ${str(data.movieTitle)} fue publicada`,
        build: (data) =>
            createElement(ReviewPublishedEmail, {
                movieTitle: str(data.movieTitle),
                reviewUrl: data.reviewUrl ? str(data.reviewUrl) : undefined,
            }),
    },
}

class EmailService {
    private readonly client?: ResendLike
    private readonly from: string

    constructor(options: { apiKey?: string; from?: string; client?: ResendLike } = {}) {
        const apiKey = options.apiKey ?? process.env.RESEND_API_KEY
        this.from = options.from ?? process.env.EMAIL_FROM ?? 'onboarding@resend.dev'
        this.client = options.client ?? (apiKey ? (new Resend(apiKey) as unknown as ResendLike) : undefined)
    }

    /** `true` cuando hay proveedor real; `false` en modo dev (solo log). */
    isEnabled(): boolean {
        return this.client !== undefined
    }

    render(message: EmailMessage): RenderedEmail {
        const definition = templates[message.template]
        if (!definition) {
            throw new Error(`Template de email desconocido: "${message.template}"`)
        }

        return {
            subject: definition.subject(message.data),
            // react-dom/server en CJS; @react-email/render usa import() dinamico
            // y no corre bajo el VM de Jest sin --experimental-vm-modules.
            html: renderToStaticMarkup(definition.build(message.data)),
        }
    }

    async send(message: EmailMessage): Promise<void> {
        const { subject, html } = await this.render(message)

        if (!this.client) {
            logger.info(`[DEV] Email "${message.template}" para ${message.to}: ${subject}`)
            return
        }

        const { error } = await this.client.emails.send({
            from: this.from,
            to: message.to,
            subject,
            html,
        })

        if (error) {
            throw new Error(`Resend no pudo enviar "${message.template}" a ${message.to}: ${error.message ?? 'error desconocido'}`)
        }
    }

    /** Envio secuencial; Resend expone batch propio, pero el limiter ya regula el ritmo. */
    async sendBatch(messages: EmailMessage[]): Promise<void> {
        for (const message of messages) {
            await this.send(message)
        }
    }
}

export default EmailService
