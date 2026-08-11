import type { Request, Response } from "express";
import AuthService from "../services/authService";
import { loginSchema, registerSchema, refreshSchema, logoutSchema, verifyEmailSchema, resendVerificationSchema } from "../schemas/auth";

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

    refresh = async (req: Request, resp: Response) => {
        const parsed = refreshSchema.parse(req.body)

        const authResponse = await this.authService.refresh(parsed.refreshToken)

        resp.json(authResponse)
    }

    logout = async (req: Request, resp: Response) => {
        const parsed = logoutSchema.parse(req.body)

        const result = await this.authService.logout(parsed.refreshToken)

        resp.status(200).json(result)
    }

    verify = async (req: Request, resp: Response) => {
        const parsed = verifyEmailSchema.parse(req.body)

        const result = await this.authService.verifyEmail(parsed)

        resp.status(200).json(result)
    }

    resend = async (req: Request, resp: Response) => {
        const parsed = resendVerificationSchema.parse(req.body)

        const result = await this.authService.resendVerification(parsed)

        resp.status(200).json(result)
    }
}

export default AuthController