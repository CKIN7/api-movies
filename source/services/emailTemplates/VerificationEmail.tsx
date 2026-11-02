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

export interface VerificationEmailProps {
    url: string
    appName?: string
}

/**
 * Template de verificacion de cuenta (cola `email-critical`).
 * El `url` lo construye el notificador con APP_URL + token.
 */
export function VerificationEmail({ url, appName = 'API Movies' }: VerificationEmailProps) {
    return (
        <Html>
            <Head />
            <Preview>Verifica tu cuenta de {appName}</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Heading style={heading}>Verifica tu cuenta</Heading>
                    <Text style={paragraph}>
                        Gracias por registrarte en {appName}. Confirma tu email para activar la cuenta.
                    </Text>
                    <Button style={button} href={url}>
                        Verificar mi cuenta
                    </Button>
                    <Text style={small}>El enlace vence en 24 horas.</Text>
                    <Hr style={hr} />
                    <Text style={small}>
                        Si no creaste esta cuenta, ignora este mensaje.
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
    backgroundColor: '#2563eb',
    color: '#ffffff',
    borderRadius: '6px',
    padding: '12px 20px',
    textDecoration: 'none',
    fontWeight: 'bold' as const,
}
const small = { fontSize: '13px', color: '#6b7280' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }

export default VerificationEmail
