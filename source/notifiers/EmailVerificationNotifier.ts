export default interface EmailVerificationNotifier {
    sendVerificationEmail(to: string, verificationToken: string): Promise<void>
}