# Historia de Usuario: Exportar Catálogo

> **Tipo:** Feature · **Alcance:** Catálogo · **Estado:** Implementado · **Revisión:** 2026-10-21

**Título:** Como administrador del catálogo, quiero exportar las películas filtradas a un archivo CSV o JSON descargable, para analizar los datos en Excel u otras herramientas externas.

---

## Criterios de Aceptación

### 1. Endpoints separados por formato
* `GET /movies/export/csv` → Descarga archivo CSV.
* `GET /movies/export/json` → Descarga archivo JSON.

### 2. Mismos filtros que el listado
* Acepta todos los query params de `GET /movies` (`genre`, `title`, `director`, `year`, `rating`, `duration`, `ageRating`, `q`, etc.).
* Ignora `page` y `limit` — exporta todas las películas que coinciden con los filtros aplicados.

### 3. Formato CSV
* **Cabeceras en español:** `Título`, `Año`, `Rating`, `Géneros`, `Duración`, `Director`, `Reparto`.
* **Géneros:** En una celda separados por coma (ej. `"Action, Sci-Fi"`).
* **Reparto:** Concatenado (ej. `"Leonardo DiCaprio (Dom Cobb); Ken Watanabe (Saito)"`).
* Celdas con contenido sensible o comas escapadas entre comillas dobles (RFC 4180).
* Encoding **UTF-8 con BOM** (`\ufeff`) para compatibilidad directa con Microsoft Excel.
* Header HTTP: `Content-Type: text/csv; charset=utf-8`.

### 4. Formato JSON
* Misma estructura de datos que `MovieResponse[]`.
* Formato JSON *pretty-printed* con indentación de espacios.
* Header HTTP: `Content-Type: application/json`.

### 5. Descarga forzada
* Header HTTP: `Content-Disposition: attachment; filename="catalogo-YYYY-MM-DD.csv"` (o `.json`).
* Configurado para que el navegador fuerce la descarga inmediata en lugar de previsualizar el contenido.

### 6. Manejo de errores
* **Filtros inválidos:** Respuesta `400 Bad Request` con mensaje de error formateado por Zod (idéntico a `GET /movies`).
* **Sin resultados:** Retorna un archivo con solo las cabeceras en el caso de CSV, o un arreglo vacío `[]` en JSON.
* **Error interno:** Respuesta `500 Internal Server Error` con el payload `{ error: "Error al exportar el catálogo" }`.

### 7. Rendimiento
* Implementación inicial con buffer en memoria.
> **Nota:** Para catálogos de gran volumen (>50k registros), migrar la respuesta a un *stream* con pipe directo a `res`.

---

## Notas Técnicas
* **Patrón de diseño:** Implementar patrón Strategy con una interfaz `Serializer` y clases concretas `CsvSerializer` y `JsonSerializer`.
* **Reutilización:** Reutilizar `MovieQueryBuilder` y `movieQuerySchema` previamente existentes.
* **Ruteo:** Las rutas `/export/csv` y `/export/json` deben declararse explícitamente **antes** de la ruta con parámetro de ruta `/:id` en el router de Express para evitar colisiones.

## Preguntas resueltas

Preguntas resueltas
Decisión	Opción
Patrón	Strategy (interfaz + clases)
Selección de formato	Record<string, Serializer>
Endpoint	GET /movies/export/:format
Columnas CSV	Español
Géneros CSV	Una celda: "Action, Sci-Fi"
Cast CSV	Concatenado: "Actor (Rol); Actor2 (Rol2)"
Memoria	Buffer con TODO stream futuro
Límite repo	999999 con TODO
Testing	3 unitarios + 1 integración



# Plan de feature/export-catalog

Plan Final: Feature "Exportar Catálogo"
Patrón
Strategy — Interfaz Serializer con implementaciones CsvSerializer y JsonSerializer. Selección mediante Record<string, Serializer> (sin Factory, sin if).

Endpoint
GET /movies/export/:format
:format validado por Zod como 'csv' | 'json'
Acepta todos los filtros de GET /movies
Ignora page y limit (siempre 999999)
Ruta debe ir antes de /:id

## Mindmap

mindmap
  root((Exportar Catálogo))
    Patrón Strategy
      Interfaz Serializer
        serialize()
        getContentType()
        getFileExtension()
      CsvSerializer
        Header: Título,Año,Rating,Géneros,Duración,Director,Reparto
        Cast: "Actor (Rol); Actor2 (Rol2)"
        UTF-8 BOM
        Buffer / Stream futuro
      JsonSerializer
        JSON pretty-printed
    Selección polimórfica
      Record<string, Serializer>
        csv → CsvSerializer
        json → JsonSerializer
      Controller hace lookup
      Sin if / sin Factory
    Endpoint
      GET /movies/export/:format
      Antes de /:id
      Mismos filtros que GET /movies
    Servicio
      ExportService.getAll(filters)
      Reusa MovieRepository.findMany
      Limit 999999 + TODO
    Archivos
      serializers/Serializer.ts
      serializers/CsvSerializer.ts
      serializers/JsonSerializer.ts
      schemas/exportParamsSchema.ts
      services/exportService.ts
      controllers/exportController.ts
      routes/exportRoutes.ts
    Testing
      Unitarios
        csvSerializer.test.ts
        jsonSerializer.test.ts
        exportService.test.ts
      Integración
        export.integration.test.ts

## Archivos a crear

source/
├── serializers/
│   ├── Serializer.ts           # Interfaz Strategy + comentario de patrones
│   ├── CsvSerializer.ts        # Implementación CSV: header español, cast "Actor (Rol)", UTF-8 BOM, buffer con TODO stream
│   └── JsonSerializer.ts       # Implementación JSON: JSON.stringify(movies, null, 2)
├── schemas/
│   └── exportParamsSchema.ts   # Zod: z.object({ format: z.enum(['csv', 'json']) })
├── services/
│   └── exportService.ts        # getAll(filters): findMany con limit 999999 + TODO refactor
├── controllers/
│   └── exportController.ts     # handleExport: Record<string, Serializer> + lookup + headers + send
├── routes/
│   └── exportRoutes.ts         # router.get('/export/:format', controller.handleExport)
└── __tests__/
    ├── unit/
    │   ├── csvSerializer.test.ts      # Header, filas, quoting, cast, BOM
    │   ├── jsonSerializer.test.ts     # Pretty print, movies vacío
    │   └── exportService.test.ts      # Mockea findMany, verifica filtros
    └── integration/
        └── export.integration.test.ts # Endpoint real: descarga CSV/JSON, headers, error 400




# Mapa para implementar Patrones de diseño

// ═══════════════════════════════════════════════════════════════
//  Patrón: Strategy
// ═══════════════════════════════════════════════════════════════
//  Define una interfaz común (Serializer) para intercambiar
//  algoritmos de serialización (CSV, JSON) en tiempo de ejecución.
//
//  Para agregar un nuevo formato (XML, XLSX, YAML):
//    1. Crear clase que implemente Serializer
//    2. Agregarla al Record en ExportController
//    3. Sin modificar código existente (OCP)
//
// ═══════════════════════════════════════════════════════════════
//  Patrones de diseño utilizados en el proyecto:
// ═══════════════════════════════════════════════════════════════
//  Strategy     → MovieQueryBuilder (genreMode and/or, build/buildRandom)
//  Repository   → MovieRepository, GenreRepository, DirectorRepository, etc.
//  DI (Manual)  → Constructor injection en Controller, Service, Repositories
//  Builder      → MovieQueryBuilder (construcción incremental de WHERE)
//  Factory      → Movie.fromRow(), SimilarMovie.fromRow(), createApp()
//  DTO          → MovieResponse, MovieQueryDTO, PaginatedResponse<T>, etc.
//  Facade       → MovieService (coordina 5 repositorios tras una interfaz)
//  Decorator    → DbLogger.query() (logging sin modificar queries)
//  Adapter      → DbLogger (adapta SQL con logging y medición)
//  Template     → findOrCreate en GenreRepository, DirectorRepository, CastRepository
//  Observer     → requestLogger (eventos close/finish de Response)
//  Chain of Resp. → Middleware pipeline de Express
//  Transaction  → MovieRepository.transaction<T>()
//  Snapshot/Diff → computeChanges() para auditoría
//  Singleton    → db/connection.ts, utils/logger.ts (caché de módulo)
// ═══════════════════════════════════════════════════════════════



## pseudocodigo

CsvSerializer implementa Serializer:

  getContentType:
    devolver "text/csv; charset=utf-8"

  getFileExtension:
    devolver "csv"

  serialize(recibe lista de películas):
    iniciar string de resultado con BOM (byte order mark) utf-8
    agregar fila de encabezados con los nombres de columna en español
    por cada película en la lista:
      tomar título
      tomar año
      tomar rating
      juntar los géneros separados por coma
      tomar duración
      tomar director
      juntar el reparto formateando cada actor como "Nombre (Personaje)" separado por punto y coma
      envolver entre comillas los campos que contengan comas o caracteres especiales
      unir todo con comas para formar una fila
      agregar la fila al resultado
    devolver el resultado completo

## Notas agregar comentarios

En exportService.ts para el limit: 999999:

// services/exportService.ts
// TODO: Refactorizar — agregar método findAll() en MovieRepository
// que evite COUNT(*) y límites arbitrarios.