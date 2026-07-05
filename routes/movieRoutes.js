const express = require('express');
const MovieController = require('../controllers/movieController');
const router = express.Router()

router.get('/', MovieController.getAll)

router.get('/:id', MovieController.getById)


router.post('/', MovieController.createMovie)

router.patch('/:id', MovieController.updateMovie)

// router.put('/:id', (req, resp) => {
//     const { id } = req.params;

//     const movieIndex = data.movies.findIndex(movie => movie.id === parseInt(id))
//     if (movieIndex === -1) {
//         return resp.status(404).json({ message: 'Pelicula no encontrada' })
//     }

//     const result = movieSchema.safeParse(req.body)
//     if (result.error) {
//         return resp.status(400).json({ message: result.error.message })
//     }

//     const updateMovie = {
//         ...data.movies[movieIndex],
//         ...result.data
//     }

//     resp.status(200).json({ message: 'Pelicula actualizada con exito PUT', updateMovie })
// })

router.delete('/:id', MovieController.deleteMovie)

module.exports = router