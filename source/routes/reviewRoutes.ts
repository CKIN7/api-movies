import express from 'express'
import ReviewController from "../controllers/reviewController";


export function reviewRoutes(controller: ReviewController) {
    const router = express.Router()

    router.get('/:id/reviews', controller.getReviews)

}