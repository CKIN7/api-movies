import type { Request, Response } from "express";
import { exportParamsSchema } from "../schemas/exportParamsSchema";
import ExportService from "../services/exportService";

class ExportController {
    constructor(private exportService: ExportService){}

    handleExport = async(req: Request, resp: Response) => {
        const parsed = exportParamsSchema.safeParse(req.query);

        if(parsed.error){
            return resp.status(400).json({ error: parsed.error.message })
        }

        const result = await this.exportService.getAll(parsed.data)

        //
    }

}

export default ExportController