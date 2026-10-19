// domain/UserProfile.ts
// ═══════════════════════════════════════════════════════════════
//  Patrón: Factory Method + DTO
//  fromRow() construye el dominio desde una fila SQL; toResponse()
//  emite el DTO privado (perfil propio). El DTO público se compone
//  en el servicio para no filtrar campos privados.
// ═══════════════════════════════════════════════════════════════

import type { UserProfileResponse, UserProfileRow } from '../types/user'

export class UserProfile {
    constructor(
        public readonly userId: string,
        public readonly displayName: string | null,
        public readonly bio: string | null,
        public readonly avatarUrl: string | null,
        public readonly country: string | null,
        public readonly birthYear: number | null,
        public readonly isPublic: boolean,
        public readonly createdAt: string,
        public readonly updatedAt: string,
    ) {}

    static fromRow(row: UserProfileRow): UserProfile {
        return new UserProfile(
            row.user_id,
            row.display_name,
            row.bio,
            row.avatar_url,
            row.country,
            row.birth_year,
            row.is_public === 1 || row.is_public === true,
            row.created_at,
            row.updated_at,
        )
    }

    toResponse(): UserProfileResponse {
        return {
            displayName: this.displayName,
            bio: this.bio,
            avatarUrl: this.avatarUrl,
            country: this.country,
            birthYear: this.birthYear,
            isPublic: this.isPublic,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        }
    }
}
