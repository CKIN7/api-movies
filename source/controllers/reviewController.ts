import type { Request, Response } from "express";
import ReviewService from "../services/reviewService";
import { reviewParamsSchema } from "../schemas/reviews";
import { reviewQuerySchema } from "../schemas/reviewQuery";

class ReviewController {
    constructor(private reviewService: ReviewService) {}

    getReviews = async (req: Request, resp: Response) => {

        const { id } = reviewParamsSchema.parse(req.params);

        const {page, limit} = reviewQuerySchema.parse(req.query);

        const result = await this.reviewService.getReviews(id, page, limit);
        
        resp.json(result);
    }
}

export default ReviewController