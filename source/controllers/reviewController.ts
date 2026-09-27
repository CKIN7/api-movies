import type { Request, Response } from "express";
import ReviewService from "../services/reviewService";
import { reviewParamsSchema, reviewSchema } from "../schemas/reviews";
import { reviewQuerySchema } from "../schemas/reviewQuery";

class ReviewController {
    constructor(private reviewService: ReviewService) {}

    getReviews = async (req: Request, resp: Response) => {

        const { id } = reviewParamsSchema.parse(req.params);

        const {page, limit} = reviewQuerySchema.parse(req.query);

        const result = await this.reviewService.getReviews(id, page, limit);
        
        resp.json(result);
    }

    createReview = async (req: Request, resp: Response) => {
        const { id: movieId } = reviewParamsSchema.parse(req.params);

        const parsed = reviewSchema.parse(req.body);

        const userId = req.user!.id;

        const result = await this.reviewService.createReview(userId, movieId, parsed)

        resp.status(result.isNew ? 201 : 200).json({
            message: result.isNew ? 'Reseña creada con éxito' : 'Reseña actualizada con éxito',
            data: result.review
        })

    }

    getMyReview = async (req: Request, resp: Response) => {
        const { id: movieId } = reviewParamsSchema.parse(req.params);

        const userId = req.user!.id;

        const review = await this.reviewService.getMyReview(userId, movieId)

        resp.json({ data: review })

    }

    updateMyReview = async (req: Request, resp: Response) => {
        
    }
}

export default ReviewController