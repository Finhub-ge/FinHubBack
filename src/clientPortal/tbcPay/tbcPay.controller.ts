import { Body, Controller, Ip, Logger, Post, Query, UseGuards } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { TbcPayResponseDto } from "./dto/tbcpayResponse.dto";
import { TbcPayService } from "./tbcPay.service";
import { TbcPayCheckRequestDto } from "./dto/tbcpayRequest.dto";

@ApiTags('TBC Pay - Billing')
@Controller('billing')
// @UseGuards(TbcPayWhitelistGuard)
export class TbcPayController {
  private readonly logger = new Logger(TbcPayController.name);
  constructor(
    private readonly tbcPayService: TbcPayService
  ) { }

  @ApiQuery({ name: 'command', enum: ['check', 'pay'], description: 'Command type', required: false })
  @ApiQuery({ name: 'personalId', required: false, description: 'Personal ID for own loan payment' })
  @ApiQuery({ name: 'payerPersonalId', required: false, description: 'Payer personal ID for third-party payment' })
  @ApiQuery({ name: 'debtorPersonalId', required: false, description: 'Debtor personal ID for third-party payment' })
  @ApiQuery({ name: 'caseId', description: 'Loan case ID', required: false })
  @ApiQuery({ name: 'txn_id', required: false, description: 'TBC transaction ID (required for PAY)' })
  @ApiQuery({ name: 'sum', required: false, description: 'Payment amount in GEL (required for PAY)' })
  @Post()
  async handleRequest(@Query() query: any, @Ip() ipAddress: string): Promise<TbcPayResponseDto> {
    const params = { ...query };
    console.log(params);
    this.logger.log(`TBC Pay request: command=${params.command}, case_id=${params.case_id}, ip=${ipAddress}`);

    if (params.command === 'check') {
      return await this.tbcPayService.handleCheck(params as TbcPayCheckRequestDto, ipAddress);
    } else if (params.command === 'pay') {
      //   return await this.tbcPayService.handlePay(params as TbcPayPayRequestDto, ipAddress);
    }

    // Invalid command
    return {
      status: { code: 4, message: 'Invalid command' },
      timestamp: Math.floor(Date.now() / 1000)
    };
  }
}