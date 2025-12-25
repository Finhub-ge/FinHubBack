// src/helpers/currency.helper.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class CurrencyHelper {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
  ) { }

  /**
   * Get exchange rate for specific date and currency
   * @param date - Date to get rate for (defaults to today)
   * @param currency - Currency code: USD, EUR, GBP (defaults to USD)
   */
  async getExchangeRate(date?: Date | string, currency: string = 'USD'): Promise<number> {
    // Use provided date or default to today
    const targetDate = date ? dayjs(date) : dayjs();
    const formattedDateForAPI = targetDate.format('DD-MM-YYYY'); // For NBG API
    const formattedDateForDB = targetDate.format('YYYY-MM-DD'); // For display/logging

    // Convert to Date object for Prisma (set time to start of day UTC)
    const dateForPrisma = new Date(formattedDateForDB + 'T00:00:00.000Z');

    // Check if we already have this rate in database
    const lastUpdate = await this.prisma.currencyExchange.findFirst({
      where: {
        date: dateForPrisma,
        currency: currency as any,
      },
      orderBy: {
        id: 'desc',
      },
    });

    // If found in database, return it
    if (lastUpdate) {
      return parseFloat(lastUpdate.rate.toString());
    }

    // Not in database - fetch from NBG API
    const { data } = await firstValueFrom(
      this.httpService.get(
        `https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?currencies=${currency}&date=${formattedDateForAPI}`,
      ),
    );

    const response = data[0] || {};
    const currencies = response.currencies?.[0] || {};

    // Validate response
    if (!response || Object.keys(response).length <= 0) {
      throw new HttpException(
        `Rate not found for ${currency} on ${formattedDateForDB}`,
        HttpStatus.NOT_FOUND,
      );
    }

    if (!currencies || Object.keys(currencies).length <= 0) {
      throw new HttpException(
        `Currency data not found for ${currency} on ${formattedDateForDB}`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Save to database
    await this.prisma.currencyExchange.create({
      data: {
        date: dateForPrisma,
        currency: currencies.code as any,
        rate: parseFloat(currencies.rate),
        response: response, // Save full array response
      },
    });

    return parseFloat(currencies.rate);
  }
}