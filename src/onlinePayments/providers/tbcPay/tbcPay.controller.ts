import { Controller, Get, Query, UseGuards, Header, Ip, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { TbcPayService } from './tbcPay.service';
import { TbcPayWhitelistGuard } from './guards/tbcpay-whitelist.guard';
import { TbcPayCheckRequestDto, TbcPayPayRequestDto } from './dto/tbcpay-request.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

const XML_INVALID_PARAMS = `<?xml version="1.0" encoding="UTF-8"?>
<response>
 <result>4</result>
 <comment>Invalid Parameters</comment>
</response>`;

const XML_INVALID_COMMAND = `<?xml version="1.0" encoding="UTF-8"?>
<response>
 <result>4</result>
 <comment>Invalid command</comment>
</response>`;

const XML_SERVER_ERROR = `<?xml version="1.0" encoding="UTF-8"?>
<response>
 <result>1</result>
 <comment>Server Error</comment>
</response>`;

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
    GET /billing/?command=check&caseId=519712
    GET /billing/?command=check&caseId=519712&personalId=01234567890

    **PAY Command**:
    GET /billing/?command=pay&caseId=519712&txn_id=1234567890&sum=100.50`
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
    try {
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
        const validationError = await this.validateDto(dto);
        if (validationError) {
          this.logger.error(`   ❌ CHECK validation failed, returning XML error`);
          return validationError;
        }

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
        const validationError = await this.validateDto(dto);
        if (validationError) {
          this.logger.error(`   ❌ PAY validation failed, returning XML error`);
          return validationError;
        }

        this.logger.log(`   DTO validated successfully`);
        this.logger.log(`   CaseId: ${dto.caseId}`);
        this.logger.log(`   TxnId: ${dto.txn_id}`);
        this.logger.log(`   Sum: ${dto.sum}`);

        this.logger.log(`   Calling PAY handler...`);
        return await this.tbcPayService.handlePay(dto, ipAddress);
      }

      // Invalid command - return XML error
      this.logger.error(`❌ Invalid command: ${command}`);
      return XML_INVALID_COMMAND;

    } catch (error) {
      this.logger.error(`❌❌❌ UNHANDLED EXCEPTION IN CONTROLLER ❌❌❌`);
      this.logger.error(`   Error type: ${error.constructor?.name}`);
      this.logger.error(`   Error message: ${error.message}`);
      this.logger.error(`   Error stack: ${error.stack}`);
      this.logger.error(`   Command: ${command}`);
      this.logger.error(`   Query: ${JSON.stringify(query)}`);
      return XML_SERVER_ERROR;
    }
  }

  private async validateDto(dto: object): Promise<string | null> {
    this.logger.log(`   Running class-validator validation...`);
    const errors = await validate(dto);
    if (errors.length > 0) {
      this.logger.error(`   ❌ Validation failed:`);
      const messages: string[] = [];
      errors.forEach(err => {
        this.logger.error(`      Property: ${err.property}`);
        this.logger.error(`      Value: ${JSON.stringify(err.value)}`);
        this.logger.error(`      Constraints: ${JSON.stringify(err.constraints)}`);
        if (err.constraints) {
          messages.push(...Object.values(err.constraints));
        }
      });
      const escapedMessages = messages.map(m => `  <error>${m.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</error>`).join('\n');
      return `<?xml version="1.0" encoding="UTF-8"?>
<response>
 <result>4</result>
 <comment>Bad Request</comment>
 <errors>
${escapedMessages}
 </errors>
</response>`;
    }
    this.logger.log(`   ✓ Validation passed`);
    return null;
  }
}
