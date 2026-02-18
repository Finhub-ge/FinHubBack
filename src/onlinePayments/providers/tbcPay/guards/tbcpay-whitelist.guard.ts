import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';

@Injectable()
export class TbcPayWhitelistGuard implements CanActivate {
  private readonly logger = new Logger(TbcPayWhitelistGuard.name);
  private readonly allowedIps: string[] = [
    // Localhost (for testing)
    // '127.0.0.1',
    // '::1',
    // '::ffff:127.0.0.1',

    // Your internet IP (if testing from external network)
    '109.172.176.130',
    // '85.114.241.98', // claret Tbilisi IP

    // Without VPN
    '92.241.77.174',
    '95.104.112.74',

    // With VPN
    '92.241.78.217',
    '95.104.112.77',

    // TBC Pay server IPs (get from TBC documentation)
    // 'x.x.x.x',  // TBC Server 1
    // 'y.y.y.y',  // TBC Server 2
  ];

  constructor() {
    this.logger.log(`✓ TBC Pay IP whitelist: ${this.allowedIps.join(', ')}`);
  }

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();
    const clientIp = this.getClientIp(request);

    // TEMPORARY: Discovery mode - uncomment to allow all IPs and log them
    // this.logger.warn(`🔍 DISCOVERY MODE: Request from IP: ${clientIp}`);
    // return true;

    // Check if IP is in whitelist
    const isAllowed = this.allowedIps.includes(clientIp);

    if (!isAllowed) {
      this.logger.error(`❌ Blocked TBC Pay request from unauthorized IP: ${clientIp}`);
      response
        .status(403)
        .header('Content-Type', 'application/xml; charset=UTF-8')
        .send(`<?xml version="1.0" encoding="UTF-8"?>
<response>
 <result>4</result>
 <comment>Access denied</comment>
</response>`);
      return false;
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
