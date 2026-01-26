import { Controller, Get, Query, UseGuards, Header, Ip, Logger, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { TbcPayService } from './tbcPay.service';
import { TbcPayWhitelistGuard } from './guards/tbcpay-whitelist.guard';
import { TbcPayCheckRequestDto, TbcPayPayRequestDto } from './dto/tbcpay-request.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

@ApiTags('TBC Pay - Billing')
@Controller('billing')
@UseGuards(TbcPayWhitelistGuard)
export class TbcPayController {
  private readonly logger = new Logger(TbcPayController.name);

  constructor(private readonly tbcPayService: TbcPayService) { }

  @Get()
  @Header('Content-Type', 'application/xml; charset=UTF-8')
  @ApiOperation({
    summary: 'TBC Pay Integration Endpoint',
    description: `TBC Pay protocol endpoint.

**CHECK Command**:
GET /billing/?command=check&caseId=FL-2024-001234
GET /billing/?command=check&caseId=FL-2024-001234&personalId=01234567890

**PAY Command**:
GET /billing/?command=pay&caseId=FL-2024-001234&txn_id=1234567890&sum=100.50`
  })
  @ApiQuery({ name: 'command', enum: ['check', 'pay'], description: 'Command type', required: true })
  @ApiQuery({ name: 'caseId', description: 'Case identifier (Loan.caseId)', required: false })
  @ApiQuery({ name: 'personalId', description: 'Personal ID for validation', required: false })
  @ApiQuery({ name: 'txn_id', description: 'TBC transaction ID (required for PAY)', required: false })
  @ApiQuery({ name: 'sum', description: 'Payment amount (required for PAY)', required: false })
  @ApiResponse({
    status: 200,
    description: 'XML response with result code and comment',
  })
  async handleRequest(
    @Query('command') command: string,
    @Query() query: any,
    @Ip() ipAddress: string
  ): Promise<string> {
    this.logger.log(`TBC Pay request: command=${command}, ip=${ipAddress}`);

    if (command === 'check') {
      const dto = plainToInstance(TbcPayCheckRequestDto, query);
      await this.validateDto(dto);
      this.logger.log(`CHECK: caseId=${dto.caseId}, personalId=${dto.personalId || 'none'}`);
      return await this.tbcPayService.handleCheck(dto, ipAddress);
    }

    if (command === 'pay') {
      const dto = plainToInstance(TbcPayPayRequestDto, query);
      await this.validateDto(dto);
      this.logger.log(`PAY: caseId=${dto.caseId}, txn_id=${dto.txn_id}, sum=${dto.sum}`);
      return await this.tbcPayService.handlePay(dto, ipAddress);
    }

    // Invalid command - return XML error
    return `<?xml version="1.0" encoding="UTF-8"?>
<response>
 <result>4</result>
 <comment>Invalid command</comment>
</response>`;
  }

  private async validateDto(dto: object): Promise<void> {
    const errors = await validate(dto);
    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }
  }
}
