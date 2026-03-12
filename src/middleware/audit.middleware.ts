import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const originalSend = res.send;
    const startTime = Date.now();

    res.send = function (body): Response {
      res.locals.body = body;
      return originalSend.call(this, body);
    };

    res.on("finish", async () => {
      // Only log mutations
      if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
        return;
      }

      const user = (req as any).user;
      if (!user) return;

      const duration = Date.now() - startTime;

      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: `${req.method} ${req.path}`,
          entityType: req.path.split("/")[1] || "unknown",
          entityId: req.params.id,
          oldValues: req.body.oldValues,
          newValues: req.body.newValues,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          metadata: {
            method: req.method,
            path: req.path,
            query: req.query,
            statusCode: res.statusCode,
            duration,
          },
        },
      });
    });

    next();
  }
}
