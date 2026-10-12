import { z } from 'zod'
import { ROLES } from '../types/user'

export const updateRoleSchema = z.object({
    role: z.enum(ROLES)
})

export const userIdParamSchema = z.object({
    id: z.uuid()
})

export type UpdateRoleDTO = z.infer<typeof updateRoleSchema>
export type UserIdParamDTO = z.infer<typeof userIdParamSchema>
