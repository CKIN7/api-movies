import { UserProfileRow } from '../types/user'
import { DbLogger } from '../utils/DbLogger'

export interface UserProfileData {
    displayName: string | null
    bio: string | null
    avatarUrl: string | null
    country: string | null
    birthYear: number | null
    isPublic: boolean
}

class UserProfileRepository {
    constructor(private conn: any) {}

    private async query(sql: string, params?: any[]) {
        return await DbLogger.query('query', sql, params || [], () => this.conn.query(sql, params)) as any
    }

    async findByUserId(userId: string): Promise<UserProfileRow | null> {
        const [rows] = await this.query('SELECT * FROM user_profiles WHERE user_id = ?', [userId])
        return (rows as UserProfileRow[])[0] || null
    }

    async insert(userId: string, data: UserProfileData): Promise<void> {
        await this.query(
            `INSERT INTO user_profiles
             (user_id, display_name, bio, avatar_url, country, birth_year, is_public)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                data.displayName,
                data.bio,
                data.avatarUrl,
                data.country,
                data.birthYear,
                data.isPublic ? 1 : 0,
            ]
        )
    }

    async update(userId: string, data: UserProfileData): Promise<void> {
        await this.query(
            `UPDATE user_profiles
             SET display_name = ?, bio = ?, avatar_url = ?, country = ?, birth_year = ?, is_public = ?
             WHERE user_id = ?`,
            [
                data.displayName,
                data.bio,
                data.avatarUrl,
                data.country,
                data.birthYear,
                data.isPublic ? 1 : 0,
                userId,
            ]
        )
    }
}

export default UserProfileRepository
