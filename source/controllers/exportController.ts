import type { Request, Response } from "express";
import { exportParamsSchema } from "../schemas/exportParamsSchema";
import ExportService from "../services/exportService";
import { movieQuerySchema } from "../schemas/movieQuery";
import { Serializer } from "../serializers/Serializer";
import { CsvSerializer } from "../serializers/CsvSerializer";
import { JsonSerializer } from "../serializers/JsonSerializer";
import AppError from "../utils/AppError";

class ExportController {
    private serializers: Record<string, Serializer> = {
        csv: new CsvSerializer(),
        json: new JsonSerializer()
    }

    constructor(private exportService: ExportService){}

    handleExport = async(req: Request, resp: Response) => {
        const validParams = exportParamsSchema.parse(req.params);
        const filters = movieQuerySchema.parse(req.query)

        const movies = await this.exportService.getAll(filters)

        const serializer = this.serializers[validParams.format]
        if(!serializer) throw new AppError('Formato no soportado', 400);

        const output = serializer.serialize(movies)

        resp.setHeader('Content-Type', serializer.getContentType())
        resp.setHeader('Content-Disposition', `attachment; filename="catalogo.${serializer.getFileExtension()}"`)

        resp.send(output);
    }

}

export default ExportController