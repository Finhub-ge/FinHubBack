import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import { PrismaService } from "src/prisma/prisma.service";
// import * as cheerio from "cheerio";
const cheerio = require("cheerio");

@Injectable()
export class ReestriHelper {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService
  ) { }

  async getDebtRegistryData(idNumber) {
    const url = `https://debt.reestri.gov.ge/ipove_movale.php`;
    const formFlat = `search=&fname=&lname=&orgname=&idno=${idNumber}`;

    const { data } = await firstValueFrom(
      this.httpService.post(url, formFlat),
    );
    console.log(data);
    const $ = cheerio.load(data);
    const table = $('table');

    console.log(table.text());
    return table.text().trim() || 'N/A';
  }
}