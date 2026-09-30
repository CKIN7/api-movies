// domain/WatchlistEntry.ts
// ═══════════════════════════════════════════════════════════════
//  v1: Factory Method + DTO (patrón consistente con Movie, Review)
//  ┌─────────────────────────────────────────────────────────────┐
//  │ EVOLUCIÓN FUTURA (no implementar hasta que se necesite):   │
//  │                                                             │
//  │ v2 - Consultas de dominio:                                 │
//  │   • isHighPriority(): boolean                              │
//  │   • daysSinceAdded(): number                               │
//  │   • isStale(thresholdDays?: number): boolean               │
//  │   • matchesGenre(genre: string): boolean                   │
//  │   • toSummary(): WatchlistSummary  (lista ligera)          │
//  │                                                             │
//  │ v3 - Mutaciones + Vistas + Eventos:                        │
//  │   • updatePriority(newPriority): WatchlistEntry            │
//  │   • addNote(note: string): WatchlistEntry                  │
//  │   • toAdminView(): WatchlistAdminView  (con email, IP)     │
//  │   • toExportRow(): string[]           (CSV export)         │
//  │   • Domain Events: WatchlistEntryAdded, Removed, Updated   │
//  │                                                             │
//  │ v4 - Aggregate + Value Objects:                            │
//  │   • UserWatchlist (Aggregate Root)                         │
//  │   • Priority (Value Object 1-5)                            │
//  │   • Reglas: límite items, prioridad única, etc.            │
//  └─────────────────────────────────────────────────────────────┘
// ═══════════════════════════════════════════════════════════════

import type { WatchlistRow } from '../types/watchlist'
import type { MovieRow } from '../types/movie'
import { Movie } from './Movie'
import type { WatchlistEntryResponse } from '../types/watchlist'

export class WatchlistEntry {
    constructor(
        public readonly id: number,
        public readonly userId: string,
        public readonly movieId: number,
        public readonly notes: string | null,
        public readonly priority: number,
        public readonly addedAt: string,
        public readonly movie: Movie
    ) {}

    static fromRow(entryRow: WatchlistRow, movieRow: MovieRow): WatchlistEntry {
        return new WatchlistEntry(
            entryRow.id,
            entryRow.user_id,
            entryRow.movie_id,
            entryRow.notes,
            entryRow.priority,
            entryRow.added_at,
            Movie.fromRow(movieRow)
        )
    }

    toResponse(): WatchlistEntryResponse {
        return {
            id: this.id,
            userId: this.userId,
            movieId: this.movieId,
            notes: this.notes,
            priority: this.priority,
            addedAt: this.addedAt,
            movie: this.movie.toResponse()
        }
    }

    // v2 - Consultas (añadir cuando UI necesite filtrar/ordenar por prioridad)
    // isHighPriority(): boolean { return this.priority >= 4 }
    // daysSinceAdded(): number { ... }
    // isStale(thresholdDays = 90): boolean { ... }
    // matchesGenre(genre: string): boolean { ... }
    // toSummary(): WatchlistSummary { ... }

    // v3 - Mutaciones + Vistas admin/export + Eventos
    // updatePriority(newPriority: number): WatchlistEntry { ... }
    // addNote(note: string): WatchlistEntry { ... }
    // toAdminView(): WatchlistAdminView { ... }
    // toExportRow(): string[] { ... }
}