# Otros Casos de Uso para BullMQ en la API

> **Tipo:** Propuesta · **Estado:** Pendiente de evaluación · **Fecha:** 2026-10-24

Esta lista documenta casos de uso adicionales que podrían implementarse sobre la infraestructura BullMQ una vez establecida la base (F1).

---

## 1. Procesamiento de Imágenes / Media

| Job | Trigger | Valor |
|-----|---------|-------|
| `image:optimize` | Upload poster/avatar | WebP, múltiples tamaños, blur placeholder |
| `image:moderate` | Upload | NSFW detection, spam check (Cloud Vision, Rekognition) |
| `video:transcode` | Trailer upload | HLS/DASH para streaming adaptativo |

---

## 2. Búsqueda y Recomendaciones (más allá de recs)

| Job | Trigger | Valor |
|-----|---------|-------|
| `search:index` | Create/Update/Delete movie | Sync a Meilisearch (ya tienes `reindex` script) |
| `embeddings:generate` | Nueva película / batch nocturno | Vector embeddings para búsqueda semántica |
| `trending:compute` | Cron horario | "Popular esta semana" por género/región |
| `similarity:rebuild` | Cambio masivo de géneros/actores | Matriz item-item fresca |

---

## 3. Datos y Sincronización Externa

| Job | Trigger | Valor |
|-----|---------|-------|
| `tmdb:sync` | Cron diario | Enriquecer catálogo: posters, trailers, cast bios |
| `export:generate` | Request admin | CSV/JSON grandes → stream a S3 + email signed URL |
| `backup:db` | Cron nocturno | Dump a S3/GCS, verificar integridad |
| `analytics:flush` | Batch cada 5min | Eventos → ClickHouse/BigQuery (evita writes sueltos) |

---

## 4. Mantenimiento y Limpieza (Housekeeping)

| Job | Trigger | Valor |
|-----|---------|-------|
| `tokens:cleanup` | Cron diario | Borrar `refresh_tokens` revocados/expirados |
| `verifications:cleanup` | Cron horario | `email_verifications` usados/expirados |
| `feedback:decay` | Cron diario | Aplicar decay a `genre_affinity` (half-life 30d) |
| `sessions:prune` | Cron | Limpiar sesiones anonimas / carritos abandonados |

---

## 5. Operaciones de Usuario (Long-Running)

| Job | Trigger | Valor |
|-----|---------|-------|
| `account:delete` | GDPR request | Anonimizar reviews, borrar watchlist, revocar tokens, queue emails |
| `data:export` | User request | GDPR takeout → compila todo → zip → signed URL |
| `preferences:recalc` | Cambio masivo | Recalcular `genre_affinity` desde cero (reviews + watchlist) |

---

## 6. Integraciones y Webhooks

| Job | Trigger | Valor |
|-----|---------|-------|
| `webhook:deliver` | Evento interno | `movie.created`, `review.published` → partners/integrations |
| `webhook:retry` | Fallo delivery | Backoff exponencial, DLQ tras N intentos |
| `slack:alert` | Error crítico | Alertas a canales ops (rate limiter saturado, DB lenta) |

---

## 7. Machine Learning / Data Science

| Job | Trigger | Valor |
|-----|---------|-------|
| `model:train` | Semanal / nuevo dato | Reentrenar modelo colaborativo / content-based |
| `model:evaluate` | Post-train | Métricas offline (NDCG, Recall@K) vs baseline |
| `features:materialize` | Diario | Feature store: user/movie features para serving |

---

## Matriz de Priorización Sugerida

| Prioridad | Jobs | Esfuerzo | Impacto |
|-----------|------|----------|---------|
| **P0 (Ya identificados)** | `email:*`, `activity:*`, `recompute:recs` | Medio | Alto |
| **P1 (Quick wins)** | `search:index`, `tokens:cleanup`, `verifications:cleanup` | Bajo | Alto (confiabilidad) |
| **P2 (Crecimiento)** | `tmdb:sync`, `export:generate`, `trending:compute` | Medio | Medio-Alto |
| **P3 (Avanzado)** | `embeddings:generate`, `model:train`, `webhook:*` | Alto | Diferenciador |

---

## Notas

- Esta propuesta complementa el plan de 4 fases documentado en `source/docs/features/hu-13-bullmq-job-queue.md`
- La infraestructura base (F1) habilita todos estos casos de uso
- Cada caso puede implementarse como job independiente sin afectar a los demás