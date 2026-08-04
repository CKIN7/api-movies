import { test, fc } from '@fast-check/jest'
import { emailSchema, loginSchema, passwordSchema, registerSchema } from '../../schemas/auth'

// ═══════════════════════════════════════════════════════════════
//  Property-based tests sobre los zod schemas de auth.
//  Verifican invariantes de NORMALIZACIÓN y los límites de la
//  política de contraseña (no el resto de la validación, que
//  zod ya garantiza).
// ═══════════════════════════════════════════════════════════════

const whitespace = fc.constantFrom('', ' ', '  ', '\t', '\n')

// Propiedad A: cualquier email "sucio" (espacios externos + casing
// aleatorio) se normaliza a lowercase y sin espacios.
// Generamos emails garantizados como válidos para el regex de z.email():
// empiezan y terminan en alfanumérico, sin ".." consecutivos.
const emailLocal = fc.array(
    fc.constantFrom('a', 'b', 'c', 'd', '1', '2', '_', '-', '.', '+'),
    { minLength: 1, maxLength: 15 },
).map((chars) => {
    let local = chars.join('')
    local = local.replace(/\.{2,}/g, '.')
    local = local.replace(/^[^A-Za-z0-9]+/, '')
    local = local.replace(/[^A-Za-z0-9]+$/, '')
    if (local === '') local = 'abc'
    return local
})
const validBaseEmail = fc.record({
    local: emailLocal,
    domain: fc.constantFrom('example.com', 'foo.org', 'mail.empresa.com'),
}).map(({ local, domain }) => `${local}@${domain}`)

test.prop([validBaseEmail, whitespace, whitespace, fc.boolean()])(
    'emailSchema normaliza a lowercase y sin espacios externos',
    (base, wsPrefix, wsSuffix, upperize) => {
        const raw = upperize ? base.toUpperCase() : base
        const input = wsPrefix + raw + wsSuffix

        const r = emailSchema.safeParse(input)

        expect(r.success).toBe(true)
        if (!r.success) return
        expect(r.data).toBe(base.toLowerCase())
        expect(r.data).not.toMatch(/^\s|\s$/)
    },
)

// Generadores de caracteres por clase.
const upper = fc.constantFrom('A', 'B', 'C', 'D', 'Z')
const lower = fc.constantFrom('a', 'b', 'c', 'd', 'z')
const digit = fc.constantFrom('0', '1', '5', '9')
const special = fc.constantFrom('!', '@', '#', '$', '%', '^', '&', '*', '-', '_', '?')
const anyChar = fc.constantFrom('a', 'b', 'A', 'B', '0', '1', '!', '@', '#', '-')

// Password fuerte garantizada: una de cada clase + un prefijo de relleno.
// Largo: min 4 + 4 = 8, max 64 + 4 = 68 (< 72).
const strongPassword = fc.record({
    prefix: fc.array(anyChar, { minLength: 4, maxLength: 64 }),
    u: upper,
    l: lower,
    d: digit,
    s: special,
}).map(({ prefix, u, l, d, s }) => prefix.join('') + u + l + d + s)

// Propiedad B: toda password fuerte es aceptada.
test.prop([strongPassword])(
    'passwordSchema acepta cualquier password fuerte (>=8, todas las clases)',
    (pwd) => {
        expect(passwordSchema.safeParse(pwd).success).toBe(true)
    },
)

// Propiedad C: si falta alguna clase, la password es rechazada.
const noUpper = fc.array(fc.constantFrom('a', 'b', 'c', '1', '2', '!', '@'), { minLength: 8, maxLength: 72 })
const noLower = fc.array(fc.constantFrom('A', 'B', 'C', '1', '2', '!', '@'), { minLength: 8, maxLength: 72 })
const noDigit = fc.array(fc.constantFrom('a', 'b', 'A', 'B', '!', '@'), { minLength: 8, maxLength: 72 })
const noSpecial = fc.array(fc.constantFrom('a', 'b', 'A', 'B', '1', '2'), { minLength: 8, maxLength: 72 })

test.prop([noUpper])('falla si falta una mayúscula', (chars) => {
    expect(passwordSchema.safeParse(chars.join('')).success).toBe(false)
})
test.prop([noLower])('falla si falta una minúscula', (chars) => {
    expect(passwordSchema.safeParse(chars.join('')).success).toBe(false)
})
test.prop([noDigit])('falla si falta un número', (chars) => {
    expect(passwordSchema.safeParse(chars.join('')).success).toBe(false)
})
test.prop([noSpecial])('falla si falta un carácter especial', (chars) => {
    expect(passwordSchema.safeParse(chars.join('')).success).toBe(false)
})

// Propiedad D: límites de largo de la password.
test.prop([fc.array(anyChar, { minLength: 0, maxLength: 7 })])(
    'falla si es demasiado corta (7 o menos)',
    (chars) => {
        expect(passwordSchema.safeParse(chars.join('')).success).toBe(false)
    },
)
test.prop([fc.array(anyChar, { minLength: 73, maxLength: 120 })])(
    'falla si supera los 72 caracteres',
    (chars) => {
        expect(passwordSchema.safeParse(chars.join('')).success).toBe(false)
    },
)

// Propiedad E: loginSchema solo exige password no vacía (<=72).
test.prop([fc.string({ minLength: 1, maxLength: 72 })])(
    'loginSchema acepta cualquier password no vacía (<=72), fuerte o no',
    (pw) => {
        expect(loginSchema.safeParse({ email: 'a@example.com', password: pw }).success).toBe(true)
    },
)
test('loginSchema rechaza password vacía', () => {
    expect(loginSchema.safeParse({ email: 'a@example.com', password: '' }).success).toBe(false)
})

// Propiedad F: registerSchema descarta claves desconocidas (role incluido).
test('registerSchema descarta claves desconocidas como role', () => {
    const r = registerSchema.safeParse({ email: 'a@example.com', password: 'Password123!', role: 'admin' })

    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data).not.toHaveProperty('role')
})
