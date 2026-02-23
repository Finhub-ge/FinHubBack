import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ErrorProcessingFailedEvent } from 'src/events/events.interface';

@Injectable()
export class ErrorMonitoringEventListener {
  private readonly logger = new Logger(ErrorMonitoringEventListener.name);

  @OnEvent('error.processing.failed')
  async handleErrorProcessingFailed(event: ErrorProcessingFailedEvent) {
    this.logger.error(
      `🚨 ALERT: Error processing failed\n` +
      `Error: ${event.error}\n` +
      `Timestamp: ${event.timestamp.toISOString()}\n` +
      `Source: ${event.source}\n` +
      `Context: ${event.context}\n` +
      `Additional Info: ${JSON.stringify(event.additionalInfo)}`
    );

    // TODO: Send email/SMS alert to admin
    // TODO: Log to monitoring service (Sentry, DataDog, etc.)
    // TODO: Create admin notification in database
  }
}
