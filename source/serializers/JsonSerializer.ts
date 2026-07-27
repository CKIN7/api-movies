import { MovieResponse } from "../domain/Movie";
import { Serializer } from "./Serializer";

export class JsonSerializer implements Serializer {
    getContentType(): string {
        return 'application/json'
    }

    getFileExtension(): string {
        return 'json'
    }

    serialize(movies: MovieResponse[]): string {
        return JSON.stringify(movies, null, 2)
    }
}