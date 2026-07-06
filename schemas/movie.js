const zod = require('zod');

const movieSchema = zod.object({
    title: zod.string({
        required_error: "El título es obligatorio",
        invalid_type_error: "El título debe ser un texto"
    }),
    year: zod.number({
        required_error: "El año es obligatorio",
        invalid_type_error: "El año debe ser un número"
    }).int("El año debe ser un número entero").min(1895, "El año mínimo es 1895").max(2026, "El año no puede ser del futuro"),
    genre: zod.array(zod.string({ invalid_type_error: "..." })).nonempty("Debe haber al menos un género"),
    director: zod.string(),
    rating: zod.number().min(0).max(10).default(5),
    duration: zod.number().int().positive(),
    // cast: zod.array(zod.string()),
    plot: zod.string(),
    poster: zod.string().url(),
    available: zod.boolean().default(true)
})

module.exports = {
    movieSchema
}