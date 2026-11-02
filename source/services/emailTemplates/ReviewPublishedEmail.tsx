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

export interface ReviewPublishedEmailProps {
    movieTitle: string
    reviewUrl?: string
    appName?: string
}

/**
 * Template transaccional (cola `email-transactional`): avisa que la
 * review de una pelicula quedo publicada.
 */
export function ReviewPublishedEmail({
    movieTitle,
    reviewUrl,
    appName = 'API Movies',
}: ReviewPublishedEmailProps) {
    return (
        <Html>
            <Head />
            <Preview>Tu review de {movieTitle} fue publicada</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Heading style={heading}>Tu review fue publicada</Heading>
                    <Text style={paragraph}>
                        Ya está visible tu review de <strong>{movieTitle}</strong> en {appName}.
                    </Text>
                    {reviewUrl ? (
                        <Button style={button} href={reviewUrl}>
                            Ver mi review
                        </Button>
                    ) : null}
                    <Hr style={hr} />
                    <Text style={small}>
                        Recibes este mail porque publicaste una review. Podés desactivarlo en
                        Configuración → Notificaciones.
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
    backgroundColor: '#111827',
    color: '#ffffff',
    borderRadius: '6px',
    padding: '12px 20px',
    textDecoration: 'none',
    fontWeight: 'bold' as const,
}
const small = { fontSize: '13px', color: '#6b7280' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }

export default ReviewPublishedEmail
