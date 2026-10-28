import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Html,
    Preview,
    Text,
} from '@react-email/components'

export interface WelcomeEmailProps {
    name?: string
    url?: string
    appName?: string
}

/**
 * Template de bienvenida (cola `email-critical`).
 * Se envia una sola vez, cuando la cuenta queda verificada.
 */
export function WelcomeEmail({ name, url, appName = 'API Movies' }: WelcomeEmailProps) {
    return (
        <Html>
            <Head />
            <Preview>Te damos la bienvenida a {appName}</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Heading style={heading}>{name ? `¡Hola, ${name}!` : '¡Bienvenido!'}</Heading>
                    <Text style={paragraph}>
                        Tu cuenta en {appName} ya está activa. Empieza a explorar el catálogo y
                        guarda tus películas favoritas.
                    </Text>
                    {url ? (
                        <Button style={button} href={url}>
                            Explorar el catálogo
                        </Button>
                    ) : null}
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

export default WelcomeEmail
