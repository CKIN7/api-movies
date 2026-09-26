import express from 'express'
import ReviewController from "../controllers/reviewController";
import { requireAuth } from '../middleware/requireAuth';


export function createReviewRoutes(controller: ReviewController) {
    const router = express.Router()

    router.post('/:id/reviews', requireAuth,controller.createReview)
    router.get('/:id/reviews', controller.getReviews)
    return router
}