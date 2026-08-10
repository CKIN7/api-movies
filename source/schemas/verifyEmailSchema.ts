import z from "zod";

export const verifyEmailSchema = z.object({
    token: z.string().min(1).max(500)
})

export type VerifyEmailDTO = z.infer<typeof verifyEmailSchema>