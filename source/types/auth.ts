import type { Role } from './user'

export interface AuthUser {
    id: string   // el sub del JWT = UUID del user en la tabla users
    role: Role   // claim role del JWT = rol vigente al emitir el token
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}