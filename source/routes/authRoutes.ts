import express from 'express';
import AuthController from '../controllers/authController';

export function createAuthRoutes(controller: AuthController){
    const router = express.Router()
    router.post('/login', controller.login)
    return router
}