import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PaymentProcessingFailedEvent } from 'src/events/payment.events';

@Injectable()
export class PaymentMonitoringListener {
  private readonly logger = new Logger(PaymentMonitoringListener.name);

  @OnEvent('payment.processing.failed')
  async handlePaymentProcessingFailed(event: PaymentProcessingFailedEvent) {
    this.logger.error(
      `🚨 ALERT: Payment processing failed\n` +
      `Transaction ID: ${event.transactionId}\n` +
      `Step: ${event.step}\n` +
      `Error: ${event.error}\n` +
      `Timestamp: ${event.timestamp.toISOString()}`
    );

    // TODO: Send email/SMS alert to admin
    // TODO: Log to monitoring service (Sentry, DataDog, etc.)
    // TODO: Create admin notification in database
  }
}
