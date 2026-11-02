import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Preview,
    Text,
} from '@react-email/components'

export interface PasswordResetEmailProps {
    url: string
    expiresInMinutes?: number
    appName?: string
}

/**
 * Template de restablecimiento de contraseña (cola `email-critical`).
 * El token de reset vive 5 minutos (TTL de `email_verifications`).
 */
export function PasswordResetEmail({
    url,
    expiresInMinutes = 5,
    appName = 'API Movies',
}: PasswordResetEmailProps) {
    return (
        <Html>
            <Head />
            <Preview>Restablece tu contraseña de {appName}</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Heading style={heading}>Restablece tu contraseña</Heading>
                    <Text style={paragraph}>
                        Pediste restablecer la contraseña de tu cuenta en {appName}. Usa el botón
                        para elegir una nueva.
                    </Text>
                    <Button style={button} href={url}>
                        Elegir nueva contraseña
                    </Button>
                    <Text style={small}>El enlace vence en {expiresInMinutes} minutos.</Text>
                    <Hr style={hr} />
                    <Text style={small}>
                        Si no pediste este cambio, ignora este mensaje: tu contraseña sigue igual.
                    </Text>
                </Container>
            </Body>
        </Html>
    )
}

const main = { backgroundColor: '#f6f9fc', fontFamily: 'Arial, sans-serif' }
const container = { backgroundColor: '#ffffff', margin: '0 auto', padding: '32px', maxWidth: '560px' }
const heading = { fontSize: '22px', color: '#111827' }
const paragraph = { fontSize: '15px', color: '#374151', lineHeight: '22px' }
const button = {
    backgroundColor: '#dc2626',
    color: '#ffffff',
    borderRadius: '6px',
    padding: '12px 20px',
    textDecoration: 'none',
    fontWeight: 'bold' as const,
}
const small = { fontSize: '13px', color: '#6b7280' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }

export default PasswordResetEmail
