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
        const escape = (value: string): string => {
            return `"${value.replace(/"/g, '""')}"`
        }

        let csv = '\uFEFF'

        csv += 'Título,Año,Rating,Géneros,Duración,Director,Reparto\r\n'

        for (const [key, value] of Object.entries(movies)) {
            csv += `${escape(value.title)},${value.year},${value.rating},${value.genres.join(',')},${value.duration},${escape(value.director)},${escape(value.cast?.map((e) => `${e.actor} (${e.character})`).join(';'))}\r\n`
        }

        return csv
    }
}