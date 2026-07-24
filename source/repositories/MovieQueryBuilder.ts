import type { AgeRating } from '../types/movie'

export type MovieQueryBuilderFilters = {
    genre?: string[]
    genreMode?: 'and' | 'or'
    minYear?: number
    maxYear?: number
    minRating?: number
    maxRating?: number
    minDuration?: number
    maxDuration?: number
    title?: string
    director?: string
    ageRating?: AgeRating[]
    q?: string
}

class MovieQueryBuilder {
    private conditions: string[] = []
    private params: (string | number)[] = []

    constructor(private query: MovieQueryBuilderFilters) {}

    build() {
        this.addYearRange()
        this.addRatingRange()
        this.addDurationRange()
        this.addGenreFilter()
        this.addTitleFilter()
        this.addDirectorFilter()
        this.addAgeRatingFilter()
        this.addSearchFilter()
        return { conditions: this.conditions, params: this.params }
    }

    buildRandom(){
        this.addYearRange()
        this.addRatingRange()
        this.addGenreFilter()
        return { conditions: this.conditions, params: this.params}
    }

    private addYearRange() {
        if (this.query.minYear !== undefined) {
            this.conditions.push('m.year >= ?')
            this.params.push(this.query.minYear)
        }
        if (this.query.maxYear !== undefined) {
            this.conditions.push('m.year <= ?')
            this.params.push(this.query.maxYear)
        }
    }

    private addRatingRange() {
        if (this.query.minRating !== undefined) {
            this.conditions.push('m.rating >= ?')
            this.params.push(this.query.minRating)
        }
        if (this.query.maxRating !== undefined) {
            this.conditions.push('m.rating <= ?')
            this.params.push(this.query.maxRating)
        }
    }

    private addDurationRange() {
        if (this.query.minDuration !== undefined) {
            this.conditions.push('m.duration >= ?')
            this.params.push(this.query.minDuration)
        }
        if (this.query.maxDuration !== undefined) {
            this.conditions.push('m.duration <= ?')
            this.params.push(this.query.maxDuration)
        }
    }

    private addGenreFilter() {
        if (this.query.genre && this.query.genre.length > 0 ) {
            const placeholders = this.query.genre.map(() => '?').join(', ')

            if (this.query.genreMode === 'and'){
                this.conditions.push(`
                    m.id IN (
                        SELECT mg2.movie_id
                        FROM movie_genres mg2
                        JOIN genres g2 ON mg2.genre_id = g2.id_genre
                        WHERE g2.genre_name IN (${placeholders})
                        GROUP BY mg2.movie_id
                        HAVING COUNT(DISTINCT mg2.genre_id) = ?
                )
            `)
            this.params.push(...this.query.genre, this.query.genre.length)
            } else {
                this.conditions.push(`
                    m.id IN (
                        SELECT mg2.movie_id
                        FROM movie_genres mg2
                        JOIN genres g2 ON mg2.genre_id = g2.id_genre
                        WHERE g2.genre_name IN (${placeholders})
                )
            `)
            this.params.push(...this.query.genre)
            }
            
            
        }
    }

    private addTitleFilter() {
        if (this.query.title) {
            this.conditions.push('m.title LIKE ?')
            this.params.push(`%${this.query.title}%`)
        }
    }

    private addDirectorFilter() {
        if (this.query.director) {
            this.conditions.push('d.director_name LIKE ?')
            this.params.push(`%${this.query.director}%`)
        }
    }

    private addAgeRatingFilter() {
        if (this.query.ageRating && this.query.ageRating.length > 0) {
            const placeholders = this.query.ageRating.map(() => '?').join(', ')
            this.conditions.push(`m.age_rating IN (${placeholders})`)
            this.params.push(...this.query.ageRating)
        }
    }

    private addSearchFilter() {
        if (this.query.q) {
            const like = `%${this.query.q}%`
            this.conditions.push(`
                (m.title LIKE ? OR m.plot LIKE ? OR d.director_name LIKE ?
                OR EXISTS (
                    SELECT 1 FROM movie_genres mg2
                    JOIN genres g2 ON mg2.genre_id = g2.id_genre
                    WHERE mg2.movie_id = m.id AND g2.genre_name LIKE ?
                )
                OR EXISTS (
                    SELECT 1 FROM movie_actors ma2
                    JOIN actors a2 ON ma2.actor_id = a2.actor_id
                    WHERE ma2.movie_id = m.id AND a2.actor_name LIKE ?
                ))
            `)
            this.params.push(like, like, like, like, like)
        }
    }
}

export default MovieQueryBuilder