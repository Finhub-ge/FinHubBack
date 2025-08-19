import { Injectable } from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import { HttpService } from "@nestjs/axios";

@Injectable()
export class UtilsHelper {
    constructor(private readonly httpService: HttpService) { }

    async sendSms(number: string, message: string) {
        const apiKey = process.env.GOSMS_KEY;
        const url = process.env.GOSMS_URL;
        const brandName = process.env.GOSMS_BRANDNAME;

        try {
            const { data } = await firstValueFrom(
                this.httpService.post(
                    url,
                    {
                        api_key: apiKey,
                        from: brandName,
                        to: number,
                        text: message,
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