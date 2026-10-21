# Fix: registro atómico (`users` + `email_verifications`)

> **Tipo:** Fix · **Estado:** Spec (no implementado) · **Revisión:** 2026-10-21

Como usuario nuevo,
quiero que un fallo a mitad del registro no me deje una cuenta inutilizable,
para poder reintentar el registro o, al menos, reenviar la verificación sin quedar bloqueado.

Este fix no añade endpoints ni tablas: corrige la falta de atomicidad de `AuthService.register`
y el manejo del fallo del notificador de email.

---

## Contexto

`POST /auth/register` (`routes/authRoutes.ts:7`) llega a `AuthService.register`
(`services/authService.ts:60-89`), que ejecuta tres pasos secuenciales:

```ts
const newUser = await this.userRepository.create(...)              // 1. INSERT users
await this.emailVerificationRepository.create(...)                 // 2. INSERT email_verifications
await this.emailVerificationNotifier.sendVerificationEmail(...)    // 3. SMTP / proveedor
```

Ningún repositorio abre transacción por sí solo: `query()` usa `activeConnection(this.conn)`
(`repositories/UserRepository.ts:10`, `repositories/EmailVerificationRepository.ts:10`), que
devuelve la conexión de la transacción **solo si hay una activa**; si no, usa la conexión del pool
en autocommit. Como `register` no envuelve nada, cada `INSERT` se commitea por separado.

El patrón transaccional ya existe y se usa en el mismo service: `resetPassword`
(`services/authService.ts:278-287`) llama a `emailVerificationRepository.transaction(...)`
(`repositories/EmailVerificationRepository.ts:81-95`), que reserva una conexión del pool, la
publica en el contexto async (`db/transactionContext.ts`), hace `COMMIT`/`ROLLBACK` y siempre
libera la conexión.

---

## Problema

Ventanas de fallo reales:

| # | Falla en | Estado persistido | Respuesta |
|---|----------|-------------------|-----------|
| W1 | `users.create` | nada | `500` |
| W2 | `email_verifications.create` | `users` commiteado, `email_verified=0`, **sin token** | `500` |
| W3 | `sendVerificationEmail` | `users` + token commiteado, correo nunca entregado | `500` |

En W2 y W3 el `catch` (`services/authService.ts:84-87`) solo loguea y lanza `AppError(500)`. El
usuario queda en un estado del que no puede salir por el flujo normal:

* no puede loguear: `login` rechaza con `403` si `emailVerified === false`
  (`services/authService.ts:34`);
* no puede registrarse de nuevo: `findByEmail` responde `409`
  (`services/authService.ts:63-64`), porque el email ya existe;
* no puede usar `forgot`: exige email verificado (`services/authService.ts:231-232`).

El único escape es `POST /auth/resend` (`services/authService.ts:199-217`), que revoca tokens
previos, crea uno nuevo y reenvía. Funciona si la causa del fallo ya desapareció; si el SMTP o la
BD siguen caídos, vuelve a fallar. Además el cliente recibió un `500`, así que no sabe que la
cuenta sí se creó ni que debe usar "reenviar verificación".

Problema secundario: el pre-chequeo `findByEmail` no cubre concurrencia. Dos registros simultáneos
con el mismo email pueden pasar ambos el chequeo; el segundo `INSERT` falla con `ER_DUP_ENTRY` y
hoy se traduce en `500` en vez de `409`.

---

## Alcance

| # | Cambio | Archivo(s) |
|---|--------|------------|
| S1 | Envolver los dos `INSERT` en `emailVerificationRepository.transaction(...)` | `services/authService.ts` |
| S2 | Enviar el correo **después** del commit y tratar su fallo como no fatal | `services/authService.ts` |
| S3 | Mapear `ER_DUP_ENTRY` a `409` (carrera de emails) | `services/authService.ts` |

Sin migración de base de datos y sin cambios de contrato en el happy path
(`201 { message, user }`).

---

## Criterios de Aceptación

* **CA-01 — Rollback de la verificación**
  Si falla `email_verifications.create`, no queda fila en `users`. Un segundo intento con el mismo
  email devuelve `201` (no `409`) y crea ambos registros.

* **CA-02 — Fallo del notificador no rompe el registro**
  Si `sendVerificationEmail` falla, la respuesta sigue siendo `201`; `users` y
  `email_verifications` quedan persistidos; se registra `logger.error` con `userId` y mensaje.
  `POST /auth/resend` permite completar la verificación después.

* **CA-03 — Carrera de emails**
  Dos registros concurrentes con el mismo email: uno responde `201` y el otro `409`, nunca `500`.

* **CA-04 — Happy path intacto**
  `201 { message: 'Usuario creado. Revisa tu email para verificar tu cuenta.', user }`, sin
  `passwordHash`, con token de 24 h y un solo correo enviado.

* **CA-05 — Sin fugas de conexión**
  El camino de error también libera la conexión del pool (`transaction()` ya lo garantiza en
  `finally`).

---

## Happy Path

| # | Entrada | Comportamiento |
|---|---------|----------------|
| H1 | `POST /auth/register {email,password}` nuevo | ✅ 201, `users` + `email_verifications`, correo enviado |
| H2 | `POST /auth/verify {token}` | ✅ 200, `email_verified=1` |
| H3 | `POST /auth/login` | ✅ 200, access + refresh |

---

## Boundary Cases

| # | Entrada | Comportamiento |
|---|---------|----------------|
| B1 | Email ya registrado (secuencial) | ❌ 409 `El email ya está registrado` |
| B2 | Email duplicado por carrera | ❌ 409 (antes 500) |
| B3 | Falla el `INSERT` de verificación | ❌ 500, **rollback** de `users` |
| B4 | Falla el notificador | ✅ 201 + `logger.error` |

---

## Corner Cases

| # | Caso | Comportamiento |
|---|------|----------------|
| C1 | Reintento tras B3 | ✅ 201 — no hay usuario huérfano |
| C2 | Reintento tras B4 | ❌ 409 (usuario ya creado) → usar `/auth/resend` |
| C3 | `/auth/resend` tras B4 | ✅ 200, revoca token viejo, crea y envía uno nuevo |
| C4 | BD caída antes del primer `INSERT` | ❌ 500, nada persistido |

---

## Edge Cases

| # | Caso | Comportamiento |
|---|------|----------------|
| EC1 | `users` creado, `COMMIT` OK, proceso muere antes del correo | Fila válida sin correo; recuperable con `/auth/resend` |
| EC2 | Token insertado, correo rebotado | Igual que EC1; `/auth/resend` reemite |
| EC3 | Fallo del notificador con SMTP colgado | No debe retener la conexión de BD: el envío va fuera de la transacción |

---

## Notas de implementación

1. **Dueño de la transacción**: `emailVerificationRepository.transaction(...)`, igual que
   `resetPassword`. Ambos repositorios resuelven `activeConnection`, así que el `INSERT` de
   `users` y el de `email_verifications` comparten conexión y hacen rollback juntos.

2. **Notificador fuera de la transacción**: dentro del callback solo van los dos `INSERT`. El
   correo se envía tras el `COMMIT`, en su propio `try/catch`. Motivo: una llamada SMTP lenta no
   debe mantener una conexión del pool ni alargar la transacción.

3. **Fallo del notificador no fatal**:

   ```ts
   try {
       await this.emailVerificationNotifier.sendVerificationEmail(newUser.email, verificationToken)
   } catch (error) {
       logger.error(`No se pudo enviar verificación a ${newUser.id}: ${(error as Error).message}`)
   }
   ```

   La respuesta sigue siendo `201`. El usuario existe y `/auth/resend` es la vía de recuperación.
   No se expone el fallo al cliente (evita filtrar detalles de infraestructura).

4. **`ER_DUP_ENTRY`**: en el `catch` externo, antes del `500` genérico:

   ```ts
   if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
       throw new AppError('El email ya está registrado', 409)
   }
   ```

   El pre-chequeo `findByEmail` se mantiene como camino rápido; el mapeo cubre solo la carrera.
   Ojo: hay que re-lanzar `AppError` antes de este chequeo para no alterar los `409` existentes.

5. **Generación del token**: `randomUUID()` y `expiresAt` pueden calcularse antes o dentro de la
   transacción; no hay diferencia funcional.

6. **Sin cambios en `refresh`/`login`/`verify`**: el fix no toca esos flujos.

7. **Sin cambios de esquema**: `email_verifications` ya tiene FK a `users` y TTL de 24 h.

---

## Pseudocódigo

```ts
async register(email: string, password: string) {
    try {
        const existingUser = await this.userRepository.findByEmail(email)
        if (existingUser) throw new AppError('El email ya está registrado', 409)

        const passwordHash = await bcrypt.hash(password, 10)
        const verificationToken = randomUUID()
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

        const newUser = await this.emailVerificationRepository.transaction(async () => {
            const user = await this.userRepository.create({ email, passwordHash, role: DEFAULT_ROLE })
            await this.emailVerificationRepository.create({
                userId: user.id,
                token: verificationToken,
                expiresAt,
            })
            return user
        })

        try {
            await this.emailVerificationNotifier.sendVerificationEmail(newUser.email, verificationToken)
        } catch (error) {
            logger.error(`No se pudo enviar verificación a ${newUser.id}: ${(error as Error).message}`)
        }

        return newUser
    } catch (error) {
        if (error instanceof AppError) throw error
        if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
            throw new AppError('El email ya está registrado', 409)
        }
        logger.error(`Error en register: ${(error as Error).message}`)
        throw new AppError('Error interno', 500)
    }
}
```

---

## Archivos a modificar (Estructura de árbol)

```text
source/
├── services/
│   └── authService.ts                      ✎ transaction + notifier fuera + ER_DUP_ENTRY
└── __tests__/
    ├── unit/
    │   └── authService.register.test.ts    ✎ mock de transaction; rollback, notifier, carrera
    └── integration/
        └── auth.register.integration.test.ts ✎ happy path intacto y 409 secuencial
```

---

## Diagrama de flujo (textual)

```text
POST /auth/register
  │
  ├─ registerSchema.parse(body)                    → 400 si inválido
  ├─ findByEmail                                    → 409 si existe (camino rápido)
  ├─ bcrypt.hash(password, 10)
  │
  ├─ emailVerificationRepository.transaction
  │    ├─ INSERT users(id, email, password_hash, role)   ─┐
  │    ├─ INSERT email_verifications(user_id, token)      ├─ COMMIT / ROLLBACK
  │    └─ return user                                    ─┘
  │         └─ si falla el token → ROLLBACK (no queda usuario)
  │
  ├─ sendVerificationEmail(...)   (fuera de la transacción)
  │    └─ si falla → logger.error, NO rompe la respuesta
  │
  └─ 201 { message, user }
```

---

## Verificación

* `npm test -- authService.register` (unit)
* `npm test -- auth.register.integration` (requiere MySQL de test)
* `npm test -- auth.resend.integration auth.verify.integration` (regresión de recuperación)
* `npm run build`

---

## Riesgos y decisiones

* **Bloqueo de conexión**: acotado a dos `INSERT` rápidos; el notificador queda fuera a propósito.
* **Respuesta 201 con correo no enviado**: se prefiere no romper el registro ya persistido; el
  cliente dispone de "reenviar verificación". Si se quiere señal explícita, un `emailSent: false`
  aditivo en el body sería el siguiente paso (fuera de alcance).
* **Logs**: no se loguea el token ni el email completo en el error del notificador, solo `userId`.
* **Sin job de limpieza**: este fix evita crear huérfanos nuevos; no borra los existentes.
