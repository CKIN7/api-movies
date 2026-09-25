import type { Request, Response } from "express";
import ReviewService from "../services/reviewService";

class ReviewController {
    constructor(private reviewService: ReviewService) {}

    getReviews = async (req: Request, resp: Response) => {

        
    }
}

export default ReviewController