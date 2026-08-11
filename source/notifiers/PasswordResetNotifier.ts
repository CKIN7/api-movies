export default interface PasswordResetNotifier {
    sendResetEmail(to: string, resetToken: string): Promise<void>
}