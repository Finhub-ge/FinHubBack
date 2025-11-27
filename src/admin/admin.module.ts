import { Module } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { JwtModule } from "@nestjs/jwt";
import { AdminController } from "./admin.controller";
import { JwtStrategy } from "src/auth/strategy/jwt.strategy";
import { PaymentsHelper } from "src/helpers/payments.helper";
import { S3Helper } from "src/helpers/s3.helper";
import { QueueService } from "src/queue/queue.service";
import { ScraperWorker } from "src/queue/workers/scraper.worker";
import { ClaudeScraperService } from "src/queue/workers/claude-scraper.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AdminController],
  providers: [AdminService, JwtStrategy, PaymentsHelper, S3Helper, QueueService, ScraperWorker, ClaudeScraperService],
  exports: [AdminService]
})
export class AdminModule { }