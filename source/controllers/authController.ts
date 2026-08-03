import type { Request, Response } from "express";
import AuthService from "../services/authService";
import { LoginDTO, loginSchema } from "../schemas/auth";

class AuthController {
    constructor(
        private authService: AuthService
    ) {}

    login = async (req: Request, resp: Response) => {
        const parsed: LoginDTO = loginSchema.parse(req.body)

        const authResponse = await this.authService.login(parsed.email, parsed.password)

        resp.json(authResponse)
    }
}

export default AuthController