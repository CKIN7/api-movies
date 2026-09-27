import { CreateReviewDTO, ReviewRow, ReviewsSummary, UpdateReviewDTO } from "../types/review";
import { DbLogger } from "../utils/DbLogger";

class ReviewRepository {
    constructor(private conn: any) {}

    private async query(sql: string, params?: any[]) {
        return await DbLogger.query('query', sql, params || [], () => this.conn.query(sql, params)) as any
    }

    async findByMovieId(movieId: number, limit: number, offset: number): Promise<ReviewRow[]>{
        const [rows] = await this.query(
            `SELECT r.*, u.email FROM reviews r
            JOIN users u ON r.user_id = u.id
            WHERE r.movie_id = ?
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
            `, [movieId, limit, offset])
        
        return rows as ReviewRow[]
    }

    async summaryByMovieId(movieId: number): Promise<ReviewsSummary> {
        const [rows] = await this.query(
            `SELECT AVG(rating) as avg_rating, COUNT(*) as count
            FROM reviews WHERE movie_id = ?`, [movieId]
        )

        const row = rows[0]
        return {
            average: row.avg_rating !== null ? Number(row.avg_rating) : null,
            count: row.count as number
        }
    }

    private async getExistingId(movieId: number, userId: string): Promise<number> {
        const [rows] = await this.query(
        'SELECT id FROM reviews WHERE movie_id = ? AND user_id = ?',
        [movieId, userId]);

        return rows[0].id;
    }

    async findById(id: number): Promise<ReviewRow | null> {
        const [rows] = await this.query(
        `SELECT r.*, u.email FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.id = ?`,
        [id]);
        
        return (rows as ReviewRow[])[0] || null;
    }

    async findByUserAndMovie(userId: string, movieId: number): Promise<ReviewRow | null> {
        const [rows] = await this.query(
            `SELECT r.id, r.movie_id, r.user_id, r.rating, r.comment, r.created_at, r.updated_at, u.email
             FROM reviews r
             JOIN users u ON r.user_id = u.id
             WHERE r.movie_id = ? AND r.user_id = ?`,
            [movieId, userId]
        );
    
        return (rows as ReviewRow[])[0] || null;
    }

    async upsert(userId: string, movieId: number, dto: CreateReviewDTO): Promise<{ review: ReviewRow; isNew: boolean }>{
        
        const existing = await this.findByUserAndMovie(userId, movieId);
        const isNew = !existing;

        const [rows] = await this.query(`
            INSERT INTO reviews (user_id, movie_id, rating, comment, created_at, updated_at)
            VALUES (?,?,?,?,NOW(), NOW())
            ON DUPLICATE KEY UPDATE
            rating = VALUES(rating),
            comment = VALUES(comment),
            updated_at = NOW()`
        , [userId, movieId, dto.rating, dto.comment])
        
        const reviewId = isNew ? rows.insertId : await this.getExistingId(movieId, userId);

        const review = await this.findById(reviewId);

        return {review: review!, isNew}
    }

    async update(userId: string, movieId: number, dto: UpdateReviewDTO): Promise<ReviewRow | null> {

        const fields = [];
        const values = [];

        if (dto.rating !== undefined) {
            fields.push('rating = ?');
            values.push(dto.rating);
        }

        if (dto.comment !== undefined) {
            fields.push('comment = ?');
            values.push(dto.comment);
        }

        if (fields.length === 0) return null;
        
        fields.push('updated_at = NOW()')
        values.push(userId, movieId);

        const [rows] = await this.query(`
            UPDATE reviews set ${fields.join(', ')}
            WHERE user_id = ? AND movie_id = ?`
        , values)
        
        if (rows.affectedRows === 0) return null
        
        return this.findByUserAndMovie(userId, movieId);

    }
}

export default ReviewRepository