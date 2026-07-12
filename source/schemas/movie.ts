import zod from 'zod'

const movieSchema = zod.object({
    title: zod.string({
        message: "El título debe ser un texto"
    }).min(1, "El título no puede estar vacío").trim(),
    year: zod.number({
        message: "El año debe ser un número"
    }).int("El año debe ser un número entero").min(1895, "El año mínimo es 1895").max(2026, "El año no puede ser del futuro"),
    genre: zod.array(
        zod.string({ message: "Cada género debe ser un texto" })
            .transform(s => s.trim().toLowerCase())
            .pipe(zod.string().min(1, "Cada género debe tener al menos 1 carácter"))
    ).nonempty("Debe haber al menos un género"),
    director: zod.string().min(1, "El director no puede estar vacío").trim(),
    rating: zod.number().min(0).max(10).default(5),
    duration: zod.number().int().positive(),
    plot: zod.string().min(1, "El argumento no puede estar vacío"),
    poster: zod.string().url(),
    available: zod.boolean().default(true)
})

export { movieSchema }
