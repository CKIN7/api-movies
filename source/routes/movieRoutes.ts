import express from 'express'
import MovieController from '../controllers/movieController'

const router = express.Router()

router.get('/', MovieController.getAll)

router.get('/:id', MovieController.getById)


router.post('/', MovieController.createMovie)

router.patch('/:id', MovieController.updateMovie)

router.delete('/:id', MovieController.deleteMovie)

export default router
