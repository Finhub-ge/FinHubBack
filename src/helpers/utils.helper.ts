import { Injectable } from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import { HttpService } from "@nestjs/axios";

@Injectable()
export class UtilsHelper {
  constructor(
    private readonly httpService: HttpService
  ) { }

  async sendSms(number: string, message: string) {
    const apiKey = process.env.GOSMS_KEY;
    const url = process.env.GOSMS_URL;
    const brandName = process.env.GOSMS_BRANDNAME;

    try {
      const footer = `\n\nპატივისცემით, "ფინჰაბ ჯორჯია"\nwww.finhub.ge\nტელ: 0322420909`;
      const { data } = await firstValueFrom(
        this.httpService.post(
          url,
          {
            api_key: apiKey,
            from: brandName,
            to: number,
            text: `${message}${footer}`,
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return data;
    } catch (error) {
      return error.response.data;
    }
  }
}   