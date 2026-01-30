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

  constructor(private readonly tbcPayService: TbcPayService) {}

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
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`📥 TBC Pay request received`);
    this.logger.log(`   Command: ${command}`);
    this.logger.log(`   IP: ${ipAddress}`);
    this.logger.log(`   Query params: ${JSON.stringify(query)}`);

    if (command === 'check') {
      this.logger.log(`🔍 Processing CHECK command...`);

      this.logger.log(`   Transforming query to DTO...`);
      const dto = plainToInstance(TbcPayCheckRequestDto, query);

      this.logger.log(`   Validating DTO...`);
      await this.validateDto(dto);

      this.logger.log(`   DTO validated successfully`);
      this.logger.log(`   CaseId: ${dto.caseId}`);
      this.logger.log(`   PersonalId: ${dto.personalId || 'none'}`);

      this.logger.log(`   Calling CHECK handler...`);
      return await this.tbcPayService.handleCheck(dto, ipAddress);
    }

    if (command === 'pay') {
      this.logger.log(`💰 Processing PAY command...`);

      this.logger.log(`   Transforming query to DTO...`);
      const dto = plainToInstance(TbcPayPayRequestDto, query);

      this.logger.log(`   Validating DTO...`);
      await this.validateDto(dto);

      this.logger.log(`   DTO validated successfully`);
      this.logger.log(`   CaseId: ${dto.caseId}`);
      this.logger.log(`   TxnId: ${dto.txn_id}`);
      this.logger.log(`   Sum: ${dto.sum}`);

      this.logger.log(`   Calling PAY handler...`);
      return await this.tbcPayService.handlePay(dto, ipAddress);
    }

    // Invalid command - return XML error
    this.logger.error(`❌ Invalid command: ${command}`);
    return `<?xml version="1.0" encoding="UTF-8"?>
<response>
 <result>4</result>
 <comment>Invalid command</comment>
</response>`;
  }

  private async validateDto(dto: object): Promise<void> {
    this.logger.log(`   Running class-validator validation...`);
    const errors = await validate(dto);
    if (errors.length > 0) {
      this.logger.error(`   ❌ Validation failed: ${JSON.stringify(errors)}`);
      throw new BadRequestException(errors);
    }
    this.logger.log(`   ✓ Validation passed`);
  }
}
