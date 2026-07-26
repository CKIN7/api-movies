import MovieRepository from "../repositories/MovieRepository";
import { ExportParamsDTO } from "../schemas/exportParamsSchema";

class ExportService {
    constructor(
        private MovieRepository: MovieRepository
    ){}

    async getAll(params: ExportParamsDTO){
        
    }
}

export default ExportService