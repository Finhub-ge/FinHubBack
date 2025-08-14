import { Injectable } from "@nestjs/common";

@Injectable()
export class UtilsHelper {
    async sendSms(number: string, message: string) {

        const apiKey = process.env.SMS_KEY; // Change this to your SMS provider API key

        try {
            // Your SMS provider API call here
            const response = await fetch('', {

            });

            const result = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    error: result.message || 'SMS sending failed',
                    providerId: result.id || null
                };
            }

            return {
                success: true,
                providerId: result.id || null,
                message: 'SMS sent successfully'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message || 'Network error occurred',
                providerId: null
            };
        }
    }
}   