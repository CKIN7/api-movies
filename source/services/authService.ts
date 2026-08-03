import UserRepository from "../repositories/UserRepository";
import AppError from "../utils/AppError";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

class AuthService {
    constructor(
        private userRepository: UserRepository
    ) {}

    async login(email: string, password: string){
        try {
            const user = await this.userRepository.findByEmail(email);
            //Mismo error, así evitamos user enumeration
            if(!user) throw new AppError('La contraseña o el email es invalido', 401)
            
            const isValidPassword = await bcrypt.compare(password, user.passwordHash);
            if(!isValidPassword) throw new AppError('La contraseña o el email es invalido', 401)
            
            const token = jwt.sign({id: user.id})
        } catch (error) {
            
        }
    }

}

export default AuthService