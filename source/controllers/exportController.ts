import type { Request, Response } from "express";
import { exportParamsSchema } from "../schemas/exportParamsSchema";
import ExportService from "../services/exportService";
import { movieQuerySchema } from "../schemas/movieQuery";
import { Serializer } from "../serializers/Serializer";
import { CsvSerializer } from "../serializers/CsvSerializer";
import { JsonSerializer } from "../serializers/JsonSerializer";

class ExportController {
    private serializers: Record<string, Serializer> = {
        csv: new CsvSerializer(),
        json: new JsonSerializer()
    }

    constructor(private exportService: ExportService){}

    handleExport = async(req: Request, resp: Response) => {
        const parsed = exportParamsSchema.parse(req.params);
        const filters = movieQuerySchema.parse(req.query)

        const movieResult = await this.exportService.getAll(filters)

        //
    }

}

export default ExportController