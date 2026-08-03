import {z} from 'zod';

export const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(1).max(72)
})

export const passwordSchema = z.string().min(8).max(72)
    .regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/)

export const registerSchema = z.object({
    email: z.email(),
    password: passwordSchema,
})

export type LoginDTO = z.infer<typeof loginSchema>
export type RegisterDTO = z.infer<typeof registerSchema>
