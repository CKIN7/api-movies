import { MovieResponse } from "../domain/Movie";
import { Serializer } from "./Serializer";

class CsvSerializer implements Serializer {

    getContentType(): string {
        return 'text/csv; charset=utf-8'
    }

    getFileExtension(): string {
        return 'csv'
    }

    serialize(movies: MovieResponse[]): string {
        let csv = '\uFEFF'

        csv += 'Título,Año,Rating,Géneros,Duración,Director,Reparto\r\n'

    }
}