import AppError from '../utils/AppError'

describe('AppError', () => {
  test('debe crear una instancia con message y statusCode', () => {
    const error = new AppError('Not found', 404)
    expect(error).toBeInstanceOf(AppError)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Not found')
    expect(error.statusCode).toBe(404)
  })

  test('debe funcionar con diferentes códigos de estado', () => {
    const error400 = new AppError('Bad request', 400)
    expect(error400.statusCode).toBe(400)

    const error500 = new AppError('Server error', 500)
    expect(error500.statusCode).toBe(500)
  })
})
