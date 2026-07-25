import ExportService from "../services/exportService";

class ExportController {
    constructor(private exportService: ExportService){}

    handleExport = async(req: Request, resp: Response) => {
        
    }

}

export default ExportController