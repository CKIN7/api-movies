// Strategy: los services de negocio no conocen BullMQ. Solo avisan que
// las recomendaciones de un usuario quedaron obsoletas; la implementacion
// decide si encola, en que cola y con que dedupe.
export default interface RecommendationRecomputer {
    /** Best-effort: nunca debe romper la operacion de negocio. */
    scheduleRecompute(userId: string): Promise<void>
}
