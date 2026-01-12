import { Injectable, Logger } from "@nestjs/common";
import { TbcPayCheckRequestDto } from "./dto/tbcpayRequest.dto";
import { TbcPayResponseDto } from "./dto/tbcpayResponse.dto";
import { TbcPayResultCode } from "./enums/tbcpayResultCode.enum";
import { JsonResponseHelper } from "./helpers/jsonResponse.helper";

@Injectable()
export class TbcPayService {
  private readonly logger = new Logger(TbcPayService.name);

  constructor(
    private readonly jsonResponseHelper: JsonResponseHelper
  ) { }

  async handleCheck(dto: TbcPayCheckRequestDto, ipAddress?: string): Promise<TbcPayResponseDto> {
    const startTime = Date.now();

    try {

    } catch (error) {
      this.logger.error('CHECK error:', error);
      return this.jsonResponseHelper.buildErrorResponse(TbcPayResultCode.SERVER_TIMEOUT);
    }
    return {
      status: { code: 0, message: 'OK' },
      timestamp: Math.floor(Date.now() / 1000)
    };
  }
}