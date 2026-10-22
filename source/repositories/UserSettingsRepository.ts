import { UserSettingsRow } from '../types/user'
import { DbLogger } from '../utils/DbLogger'

export interface UserSettingsData {
    language: string
    theme: string
    region: string | null
    notifyEmail: boolean
    notifyPush: boolean
    privacyReviews: string
    privacyWatchlist: string
    privacyActivity: string
    spoilerFree: boolean
}

class UserSettingsRepository {
    constructor(private conn: any) {}

    private async query(sql: string, params?: any[]) {
        return await DbLogger.query('query', sql, params || [], () => this.conn.query(sql, params)) as any
    }

    async findByUserId(userId: string): Promise<UserSettingsRow | null> {
        const [rows] = await this.query('SELECT * FROM user_settings WHERE user_id = ?', [userId])
        return (rows as UserSettingsRow[])[0] || null
    }

    async save(userId: string, data: UserSettingsData): Promise<void> {
        await this.query(
            `INSERT INTO user_settings
             (user_id, language, theme, region, notify_email, notify_push,
              privacy_reviews, privacy_watchlist, privacy_activity, spoiler_free)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                language = VALUES(language),
                theme = VALUES(theme),
                region = VALUES(region),
                notify_email = VALUES(notify_email),
                notify_push = VALUES(notify_push),
                privacy_reviews = VALUES(privacy_reviews),
                privacy_watchlist = VALUES(privacy_watchlist),
                privacy_activity = VALUES(privacy_activity),
                spoiler_free = VALUES(spoiler_free)`,
            [
                userId,
                data.language,
                data.theme,
                data.region,
                data.notifyEmail ? 1 : 0,
                data.notifyPush ? 1 : 0,
                data.privacyReviews,
                data.privacyWatchlist,
                data.privacyActivity,
                data.spoilerFree ? 1 : 0,
            ]
        )
    }
}

export default UserSettingsRepository
