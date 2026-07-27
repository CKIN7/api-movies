import { MovieResponse } from "../domain/Movie";

// ═══════════════════════════════════════════════════════════════
//  Patrón: Strategy
// ═══════════════════════════════════════════════════════════════
//  Interfaz común para intercambiar algoritmos de serialización
//  en tiempo de ejecución. Cada implementación (CsvSerializer,
//  JsonSerializer) encapsula un formato distinto.
//  Para agregar un formato: crear clase que implemente Serializer
//  y agregarla al Record en ExportController (OCP).
// ═══════════════════════════════════════════════════════════════

export interface Serializer {
    serialize(movies: MovieResponse[]): string

    getContentType(): string

    getFileExtension(): string
}