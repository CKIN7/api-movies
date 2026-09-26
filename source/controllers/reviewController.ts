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

        const result = await this.reviewService(userId, )



    }
}

export default ReviewController