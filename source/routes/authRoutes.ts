import express from 'express';
import AuthController from '../controllers/authController';

export function createAuthRoutes(controller: AuthController){
    const router = express.Router()
    router.post('/login', controller.login)
    router.post('/register', controller.register)
    router.post('/refresh', controller.refresh)
    router.post('/logout', controller.logout)
    router.post('/verify', controller.verify)
    return router
}