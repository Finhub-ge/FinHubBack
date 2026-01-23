import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TbcPayWhitelistGuard implements CanActivate {
  private readonly logger = new Logger(TbcPayWhitelistGuard.name);
  private readonly allowedIps: string[];

  constructor(private config: ConfigService) {
    const ipsString = this.config.get<string>('TBC_PAY_WHITELIST_IPS', '');
    this.allowedIps = ipsString.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0);

    if (this.allowedIps.length === 0) {
      this.logger.warn('⚠️  TBC_PAY_WHITELIST_IPS not configured - all IPs will be allowed (NOT RECOMMENDED FOR PRODUCTION)');
    } else {
      this.logger.log(`✓ TBC Pay IP whitelist: ${this.allowedIps.join(', ')}`);
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const clientIp = this.getClientIp(request);

    // If no whitelist configured, allow all (development mode)
    if (this.allowedIps.length === 0) {
      this.logger.warn(`⚠️  Allowing request from ${clientIp} (no whitelist configured)`);
      return true;
    }

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
