import { Injectable, OnModuleInit } from '@nestjs/common';
import { QueueService } from '../queue.service';
import { Job } from 'bullmq';
import axios, { AxiosInstance } from 'axios';
import { CookieJar } from 'tough-cookie';
import { HttpCookieAgent, HttpsCookieAgent } from 'http-cookie-agent/http';
import * as cheerio from 'cheerio';


@Injectable()
export class ScraperWorker implements OnModuleInit {
  constructor(private readonly queueService: QueueService) { }

  onModuleInit() {
    this.queueService.registerWorker(
      'scraper',
      async (job: Job) => {
        const { idno } = job.data;

        if (!idno) {
          throw new Error('Job payload missing idno');
        }

        // console.log(`🟦 [SCRAPER] Executing job: ${job.id}, IDNO=${idno}`);

        try {
          const result = await this.scrape(idno);
          // console.log(`🟩 [SCRAPER] Completed IDNO=${idno}`);
          return result;
        } catch (error) {
          // console.error(`🟥 [SCRAPER] Failed IDNO=${idno}:`, error.message);
          throw error; // BullMQ will retry because of attempts/backoff
        }
      },
      3 // concurrency
    );
  }

  /**
   * Scrape function isolated from worker registration
   */
  async scrape(idno: string) {
    try {
      const instance = axios.create({
        baseURL: 'https://debt.reestri.gov.ge',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      // Step 1: Get initial page
      const initialResponse = await instance.get('/ipove_movale.php');

      const cookies = initialResponse.headers['set-cookie']
        ? initialResponse.headers['set-cookie'].map(c => c.split(';')[0]).join('; ')
        : '';

      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 2: POST the search
      const formData = `search=&fname=&lname=&orgname=&idno=${idno}`;

      await instance.post('/ipove_movale.php', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookies,
          'Referer': 'https://debt.reestri.gov.ge/ipove_movale.php',
          'X-Requested-With': 'XMLHttpRequest', // Mark as AJAX request!
        },
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 3: Get the results via AJAX (like the pagination button does)
      const resultResponse = await instance.get('/ipove_movale.php', {
        params: { page: 'current' }, // or page: 1
        headers: {
          'Cookie': cookies,
          'Referer': 'https://debt.reestri.gov.ge/ipove_movale.php',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      console.log('AJAX response:', resultResponse.data);

      const $ = cheerio.load(resultResponse.data);
      const row = $('table.ktable tbody tr');

      if (row.length === 0) {
        return {
          idno,
          clientName: null,
          date: null,
          description: 'No records found',
        };
      }

      // ... same parsing logic ...
      const col2 = row.find('td').eq(1);
      const col3 = row.find('td').eq(2);

      const clientName = col2.find('strong').text().trim();
      const personalIdMatch = col2.html()?.match(/\((\d+)\)/);
      const personalId = personalIdMatch ? personalIdMatch[1] : '';

      const col2Html = col2.html() || '';
      const addressMatch = col2Html.split('<br>')[1] || col2Html.split('<br/>')[1];
      const address = addressMatch ? addressMatch.replace(/<[^>]+>/g, '').trim() : '';

      const registrationMatch = col2.text().match(/#(\d+)\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/);
      const registrationNumber = registrationMatch ? `#${registrationMatch[1]}` : '';
      const registrationDateStr = registrationMatch ? registrationMatch[2] : '';

      let isoDate = null;
      if (registrationDateStr) {
        const [datePart, timePart] = registrationDateStr.split(' ');
        const [day, month, year] = datePart.split('/');
        isoDate = `${year}-${month}-${day} ${timePart}:00`;
      }

      const col3Text = col3.text();
      const executorMatch = col3Text.match(/აღმასრულებელი:\s*([^\n]+)/);
      const executorName = executorMatch ? executorMatch[1].trim() : '';

      const additionMatch = col3Text.match(/(A\d+-\d+\s+\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/);
      const additionInfo = additionMatch ? additionMatch[1].trim() : '';

      const caseMatch = col3Text.match(/სააღსრულებო საქმე:\s*(A\d+\s*\([^)]+\))/);
      const caseInfo = caseMatch ? caseMatch[1].trim() : '';

      const description = [
        `${clientName} (${personalId})`,
        address,
        `${registrationNumber} ${registrationDateStr}`,
        executorName ? `აღმასრულებელი: ${executorName}` : '',
        additionInfo ? `დამატება: ${additionInfo}` : '',
        caseInfo ? `ს/ს ${caseInfo}` : '',
      ]
        .filter(Boolean)
        .join(' ; ');

      return {
        idno,
        clientName,
        date: isoDate,
        description,
      };

    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  }

  async scrape2(idno: string) {
    try {
      // Step 1: Get initial page and extract cookies
      const initialResponse = await axios.get('https://debt.reestri.gov.ge/ipove_movale.php', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      // Extract cookies
      const setCookieHeaders = initialResponse.headers['set-cookie'];
      const cookies = setCookieHeaders
        ? setCookieHeaders.map(cookie => cookie.split(';')[0]).join('; ')
        : '';

      console.log('Cookies received:', cookies);

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 2: Submit form with cookies
      const form = new URLSearchParams({
        search: '',
        fname: '',
        lname: '',
        orgname: '',
        idno,
      });

      const response = await axios.post(
        'https://debt.reestri.gov.ge/ipove_movale.php',
        form.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://debt.reestri.gov.ge/ipove_movale.php',
            'Origin': 'https://debt.reestri.gov.ge',
            'Cookie': cookies, // Send cookies back!
          },
        },
      );

      console.log('Response length:', response.data);

      const $ = cheerio.load(response.data);
      const row = $('table.ktable tbody tr');

      if (row.length === 0) {
        return {
          idno,
          clientName: null,
          date: null,
          description: 'No records found',
        };
      }

      // ... same parsing logic as above
      const col2 = row.find('td').eq(1);
      const col3 = row.find('td').eq(2);

      const clientName = col2.find('strong').text().trim();
      const personalIdMatch = col2.html()?.match(/\((\d+)\)/);
      const personalId = personalIdMatch ? personalIdMatch[1] : '';

      const col2Html = col2.html() || '';
      const addressMatch = col2Html.split('<br>')[1] || col2Html.split('<br/>')[1];
      const address = addressMatch ? addressMatch.replace(/<[^>]+>/g, '').trim() : '';

      const registrationMatch = col2.text().match(/#(\d+)\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/);
      const registrationNumber = registrationMatch ? `#${registrationMatch[1]}` : '';
      const registrationDateStr = registrationMatch ? registrationMatch[2] : '';

      let isoDate = null;
      if (registrationDateStr) {
        const [datePart, timePart] = registrationDateStr.split(' ');
        const [day, month, year] = datePart.split('/');
        isoDate = `${year}-${month}-${day} ${timePart}:00`;
      }

      const col3Text = col3.text();
      const executorMatch = col3Text.match(/აღმასრულებელი:\s*([^\n]+)/);
      const executorName = executorMatch ? executorMatch[1].trim() : '';

      const additionMatch = col3Text.match(/(A\d+-\d+\s+\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/);
      const additionInfo = additionMatch ? additionMatch[1].trim() : '';

      const caseMatch = col3Text.match(/სააღსრულებო საქმე:\s*(A\d+\s*\([^)]+\))/);
      const caseInfo = caseMatch ? caseMatch[1].trim() : '';

      const description = [
        `${clientName} (${personalId})`,
        address,
        `${registrationNumber} ${registrationDateStr}`,
        executorName ? `აღმასრულებელი: ${executorName}` : '',
        additionInfo ? `დამატება: ${additionInfo}` : '',
        caseInfo ? `ს/ს ${caseInfo}` : '',
      ]
        .filter(Boolean)
        .join(' ; ');

      return {
        idno,
        clientName,
        date: isoDate,
        description,
      };

    } catch (error) {
      console.error('Scraping error:', error);
      throw error;
    }
  }

}