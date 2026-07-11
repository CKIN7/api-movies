import zod from 'zod'

const movieSchema = zod.object({
    title: zod.string({
        message: "El título debe ser un texto"
    }),
    year: zod.number({
        message: "El año debe ser un número"
    }).int("El año debe ser un número entero").min(1895, "El año mínimo es 1895").max(2026, "El año no puede ser del futuro"),
    genre: zod.array(zod.string({ message: "..." }).transform(s => s.trim().toLowerCase())).nonempty("Debe haber al menos un género"),
    director: zod.string(),
    rating: zod.number().min(0).max(10).default(5),
    duration: zod.number().int().positive(),
    plot: zod.string(),
    poster: zod.string().url(),
    available: zod.boolean().default(true)
})

export { movieSchema }
