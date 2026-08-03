import {z} from 'zod';

export const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(6).max(72)
})

export type LoginDTO = z.infer<typeof loginSchema>