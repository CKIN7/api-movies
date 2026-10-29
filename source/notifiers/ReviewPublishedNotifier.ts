export interface ReviewPublishedEvent {
    userId: string
    reviewId: string
    movieId: number
    movieTitle: string
}

// Strategy: el service de reviews no sabe de colas ni de canales. Solo
// emite "se publicó una review"; la implementación decide cómo.
export default interface ReviewPublishedNotifier {
    notifyReviewPublished(event: ReviewPublishedEvent): Promise<void>
}