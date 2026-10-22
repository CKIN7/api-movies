# Propuestas para el Domain Model

> **Tipo:** Propuesta · **Estado:** Pendiente de evaluación · **Fecha:** 2026-07-29

10. Vista Aleatoria Múltiple (Carousel)
HU: Como usuario, quiero obtener un lote de N películas aleatorias en una sola llamada, para armar un carousel de recomendaciones en la página principal.

Feature: random-batch — GET /movies/random?count=5 (el actual solo devuelve 1). Mismo soporte de filtros.

## Nuevas propuestas 29/07/2026 para el Domain Model

``` Mi prompt:
revisa el proyecto actual, que feature con historia de usuario se podria agregar enfocada en el domain model para hacerlo mas rico?
```

``` Respuesta IA
¡Excelente proyecto! Tiene una arquitectura muy sólida. Analicemos el domain model actual:

Entidades existentes: Movie, SimilarMovie (derivada) — solo 2 clases en domain/.

Conceptos del dominio movie que están "planos" (solo como strings/rows):

Director — solo un string en Movie, aunque hay tabla directors
Actor / CastMember — solo { actor: string, character: string }
Genre — solo un string en Movie
User — no existe
Rating/Review — no hay reviews de usuarios
Estas son mis propuestas de features con historias de usuario para enriquecer el domain model:

Opción 1 (Recomendada): Reviews y calificaciones de usuarios
HU: "Como usuario del catálogo, quiero dejar una reseña y calificación (1-5) a una película para compartir mi opinión con otros usuarios."

Nuevas entidades:

Review (id, movieId, userName, rating, comment, createdAt)
Opcional: User (id, name, email, avatar)
Lo que enriquece:

Movie ganaría averageRating (calculado), reviewsCount
Nuevos endpoints: POST /movies/:id/reviews, GET /movies/:id/reviews, GET /movies/top-rated
Nueva lógica de negocio: cálculo de rating promedio, detección de reseñas duplicadas
Opción 2: Director y Actor como entidades de dominio
HU: "Como usuario, quiero ver la filmografía completa de un director o actor, incluyendo su biografía y datos personales."

Nuevas entidades:

Director (id, name, birthDate, nationality, bio, photoUrl, filmography)
Actor (id, name, birthDate, nationality, bio, photoUrl)
CastMember se enriquece con roleType: 'lead' | 'supporting' | 'cameo'
Lo que enriquece:

Director y Actor dejan de ser strings planos
Nuevos endpoints: GET /directors/:id, GET /actors/:id/filmography
Nuevas relaciones ricas entre entidades
Opción 3: Watchlist / Listas de usuario
HU: "Como usuario, quiero crear listas personalizadas de películas (vistas, por ver, favoritas) para organizar mi catálogo."

Nuevas entidades:

User (id, name, email)
Watchlist (id, userId, name, description, isPublic)
WatchlistItem (id, watchlistId, movieId, addedAt, notes)
¿Cuál de estas opciones te parece más interesante? ¿O prefieres que profundice en alguna combinación?
```