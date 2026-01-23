import { Controller, Get, Query, UseGuards, Header, Ip, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { TbcPayService } from './tbcPay.service';
import { TbcPayWhitelistGuard } from './guards/tbcpay-whitelist.guard';
import { TbcPayCheckRequestDto, TbcPayPayRequestDto } from './dto/tbcpay-request.dto';

@ApiTags('TBC Pay - Billing')
@Controller('billing')
@UseGuards(TbcPayWhitelistGuard)
export class TbcPayController {
  private readonly logger = new Logger(TbcPayController.name);

  constructor(private readonly tbcPayService: TbcPayService) {}

  @Get()
  @Header('Content-Type', 'application/xml; charset=UTF-8')
  @ApiOperation({
    summary: 'TBC Pay Integration Endpoint',
    description: `TBC Pay protocol endpoint.

**CHECK Command**:
GET /billing/?command=check&caseId=FL-2024-001234
GET /billing/?command=check&caseId=FL-2024-001234&personalId=01234567890

**PAY Command** - Coming soon`
  })
  @ApiQuery({ name: 'command', enum: ['check', 'pay'], description: 'Command type', required: true })
  @ApiQuery({ name: 'caseId', description: 'Case identifier (Loan.caseId)', required: true })
  @ApiQuery({ name: 'personalId', description: 'Personal ID for validation', required: false })
  @ApiResponse({
    status: 200,
    description: 'XML response with result code and comment',
  })
  async handleRequest(
    @Query() query: TbcPayCheckRequestDto | TbcPayPayRequestDto,
    @Ip() ipAddress: string
  ): Promise<string> {
    this.logger.log(`TBC Pay request: command=${query.command}, caseId=${query['caseId'] || 'none'}, ip=${ipAddress}`);

    if (query.command === 'check') {
      const checkDto = query as TbcPayCheckRequestDto;
      this.logger.log(`CHECK: caseId=${checkDto.caseId}, personalId=${checkDto.personalId || 'none'}`);
      return await this.tbcPayService.handleCheck(checkDto, ipAddress);
    } else if (query.command === 'pay') {
      // TODO: Implement PAY command
      return `<?xml version="1.0" encoding="UTF-8"?>
<response>
 <result>4</result>
 <comment>PAY command not implemented yet</comment>
</response>`;
    }

    // Invalid command - return XML error
    return `<?xml version="1.0" encoding="UTF-8"?>
<response>
 <result>4</result>
 <comment>Invalid command</comment>
</response>`;
  }
}
