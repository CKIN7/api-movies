import { MovieResponse } from "../domain/Movie";

export interface Serializer {
    serialize(movies: MovieResponse[]): string

    getContentType(): string

    getFileExtension(): string
}