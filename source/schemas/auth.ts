import {z} from 'zod';

export const emailSchema = z.string()
    .trim()
    .toLowerCase()
    .pipe(z.email())

export const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1).max(72)
})

export const passwordSchema = z.string().min(8).max(72)
    .regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/)

export const registerSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
})

export const refreshSchema = z.object({
    refreshToken: z.string().min(1).max(500)
})

export const logoutSchema = z.object({
    refreshToken: z.string().min(1).max(500)
})

export const verifyEmailSchema = z.object({
    token: z.string().min(1).max(500)
})

export const resendVerificationSchema = z.object({
    token: z.string().min(1).max(500)
})

export type VerifyEmailDTO = z.infer<typeof verifyEmailSchema>
export type ResendVerificationDTO = z.infer<typeof verifyEmailSchema>


export type RefreshDTO = z.infer<typeof refreshSchema>
export type LogoutDTO = z.infer<typeof logoutSchema>

export type LoginDTO = z.infer<typeof loginSchema>
export type RegisterDTO = z.infer<typeof registerSchema>
