import zod from 'zod'

const noHtml = (s: string) => !/<[^>]*>/i.test(s)
const noHtmlMsg = "No se permiten etiquetas HTML"

const castMemberSchema = zod.object({
    actor: zod.string().min(1, "El nombre del actor no puede estar vacío").max(255).trim().refine(noHtml, noHtmlMsg),
    character: zod.string().min(1, "El nombre del personaje no puede estar vacío").max(255).trim().refine(noHtml, noHtmlMsg)
})

const movieSchema = zod.object({
    title: zod.string({
        message: "El título debe ser un texto"
    }).min(1, "El título no puede estar vacío").max(255, 'El Título no puede tener mas de 256 caracteres').trim().refine(noHtml,noHtmlMsg),
    year: zod.number({
        message: "El año debe ser un número"
    }).int("El año debe ser un número entero").min(1895, "El año mínimo es 1895").max(2026, "El año no puede ser del futuro"),
    genre: zod.array(
        zod.string({ message: "Cada género debe ser un texto" })
            .transform(s => s.trim().toLowerCase())
            .pipe(zod.string().min(1, "Cada género debe tener al menos 1 carácter").max(100, "Cada género debe tener máximo 100 caracteres"))
    ).nonempty("Debe haber al menos un género").max(10, "Máximo 10 géneros por película"),
    director: zod.string().min(1, "El director no puede estar vacío").max(255).trim().refine(noHtml,noHtmlMsg),
    rating: zod.number().min(0).max(10).multipleOf(0.1).default(5),
    duration: zod.number().int().positive().max(300),
    plot: zod.string().min(1, "El argumento no puede estar vacío").max(2000, "El argumento no puede tener más de 2000 caracteres").refine(noHtml,noHtmlMsg),
    poster: zod.string().url(),
    available: zod.boolean().default(true),
    ageRating: zod.enum(['G', 'PG', 'PG-13', 'R', 'NC-17']).default('PG-13'),
    cast: zod.array(castMemberSchema).max(20).optional().default([])
})

export { movieSchema }
