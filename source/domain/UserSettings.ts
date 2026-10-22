// domain/UserSettings.ts
// ═══════════════════════════════════════════════════════════════
//  Patrón: Factory Method + DTO
//  fromRow() construye el dominio desde la fila SQL (normalizando
//  los TINYINT a boolean); toResponse() emite el DTO público.
// ═══════════════════════════════════════════════════════════════

import type { PrivacyLevel, Theme, UserSettingsResponse, UserSettingsRow } from '../types/user'

const toBool = (value: number | boolean): boolean => value === 1 || value === true

export class UserSettings {
    constructor(
        public readonly userId: string,
        public readonly language: string,
        public readonly theme: string,
        public readonly region: string | null,
        public readonly notifyEmail: boolean,
        public readonly notifyPush: boolean,
        public readonly privacyReviews: PrivacyLevel,
        public readonly privacyWatchlist: PrivacyLevel,
        public readonly privacyActivity: PrivacyLevel,
        public readonly spoilerFree: boolean,
        public readonly updatedAt: string | null,
    ) {}

    static fromRow(row: UserSettingsRow): UserSettings {
        return new UserSettings(
            row.user_id,
            row.language,
            row.theme,
            row.region,
            toBool(row.notify_email),
            toBool(row.notify_push),
            row.privacy_reviews as PrivacyLevel,
            row.privacy_watchlist as PrivacyLevel,
            row.privacy_activity as PrivacyLevel,
            toBool(row.spoiler_free),
            row.updated_at,
        )
    }

    toResponse(): UserSettingsResponse {
        return {
            language: this.language,
            theme: this.theme,
            region: this.region,
            notifyEmail: this.notifyEmail,
            notifyPush: this.notifyPush,
            privacyReviews: this.privacyReviews,
            privacyWatchlist: this.privacyWatchlist,
            privacyActivity: this.privacyActivity,
            spoilerFree: this.spoilerFree,
            updatedAt: this.updatedAt,
        }
    }
}

export type { Theme }
