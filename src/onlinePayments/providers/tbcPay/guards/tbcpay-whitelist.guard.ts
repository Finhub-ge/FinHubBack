import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';

@Injectable()
export class TbcPayWhitelistGuard implements CanActivate {
  private readonly logger = new Logger(TbcPayWhitelistGuard.name);
  private readonly allowedIps: string[] = [
    // Localhost (for testing)
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',

    // Your internet IP (if testing from external network)
    '109.172.176.130',

    // TBC Pay server IPs (get from TBC documentation)
    // 'x.x.x.x',  // TBC Server 1
    // 'y.y.y.y',  // TBC Server 2
  ];

  constructor() {
    this.logger.log(`✓ TBC Pay IP whitelist: ${this.allowedIps.join(', ')}`);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const clientIp = this.getClientIp(request);

    // TEMPORARY: Discovery mode - uncomment to allow all IPs and log them
    // this.logger.warn(`🔍 DISCOVERY MODE: Request from IP: ${clientIp}`);
    // return true;

    // Check if IP is in whitelist
    const isAllowed = this.allowedIps.includes(clientIp);

    if (!isAllowed) {
      this.logger.error(`❌ Blocked TBC Pay request from unauthorized IP: ${clientIp}`);
      throw new ForbiddenException('Access denied');
    }

    this.logger.log(`✓ Allowed TBC Pay request from ${clientIp}`);
    return true;
  }

  private getClientIp(request: any): string {
    // Check for IP in various headers (proxy support)
    return (
      request.headers['x-forwarded-for']?.split(',')[0].trim() ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      request.ip ||
      'unknown'
    );
  }
}
