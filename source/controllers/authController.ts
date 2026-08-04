import type { Request, Response } from "express";
import AuthService from "../services/authService";
import { LoginDTO, loginSchema, registerSchema } from "../schemas/auth";

class AuthController {
    constructor(
        private authService: AuthService
    ) {}

    login = async (req: Request, resp: Response) => {
        const parsed = loginSchema.parse(req.body)

        const authResponse = await this.authService.login(parsed.email, parsed.password)

        resp.json(authResponse)
    }

    register = async (req: Request, resp: Response) => {
        const parsed = registerSchema.parse(req.body)
        
        const user = await this.authService.register(parsed.email, parsed.password)
        resp.status(201).json(user);
    }
}

export default AuthController