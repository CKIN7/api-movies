import { MovieResponse } from "../domain/Movie";
import { Serializer } from "./Serializer";

export class CsvSerializer implements Serializer {

    getContentType(): string {
        return 'text/csv; charset=utf-8'
    }

    getFileExtension(): string {
        return 'csv'
    }

    serialize(movies: MovieResponse[]): string {
        // NOTA: Para catálogos grandes (>50k registros), migrar a stream con pipe a res
        // Usar:  const stream = await movieRepo.streamAll(filters)
        //        stream.pipe(csvTransform).pipe(res)
        const escape = (value: string): string => {
            return `"${value.replace(/"/g, '""')}"`
        }

        let csv = '\uFEFF'

        csv += 'Título,Año,Rating,Géneros,Duración,Director,Reparto\r\n'

        for (const movie of movies) {
            csv += `${escape(movie.title)},${movie.year},${movie.rating},${escape(movie.genres.join(', '))},${movie.duration},${escape(movie.director)},${escape(movie.cast?.map((e) => `${e.actor} (${e.character})`).join('; ') || '')}\r\n`
        }

        return csv
    }
}