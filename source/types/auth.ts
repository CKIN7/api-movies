export interface AuthUser {
    id: string   // el sub del JWT = UUID del user en la tabla users
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}