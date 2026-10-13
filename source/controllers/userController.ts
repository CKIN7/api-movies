import type { Request, Response } from "express";
import UserService from "../services/userService";
import { updateRoleSchema, userIdParamSchema } from "../schemas/user";

class UserController {
    constructor(
        private userService: UserService
    ) {}

    updateRole = async (req: Request, resp: Response) => {
        const params = userIdParamSchema.parse(req.params)
        const parsed = updateRoleSchema.parse(req.body)

        const user = await this.userService.updateRole(params.id, parsed.role, req.user!.id)

        resp.json({ message: 'Rol actualizado', user });
    }
}

export default UserController
