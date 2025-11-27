import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';

export class DebtScraperService {
  private browser: Browser | null = null;

  // Initialize browser once
  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true, // Changed from 'new' to true
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080',
        ],
      });
    }
    return this.browser;
  }

  async scrape(idno: string) {
    const browser = await this.initBrowser();
    const page = await browser.newPage();

    try {
      // Set user agent and other browser properties
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Set extra headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'ka-GE,ka;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      });

      await page.setViewport({ width: 1920, height: 1080 });

      console.log(`Scraping ID: ${idno}`);

      // Navigate to page
      console.log('Loading page...');
      const response = await page.goto('https://debt.reestri.gov.ge/ipove_movale.php', {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      console.log('Page loaded, status:', response?.status());

      // Take screenshot to debug
      await page.screenshot({ path: `/tmp/debug-${idno}.png` });
      console.log('Screenshot saved to /tmp/debug-${idno}.png');

      // Get the full HTML
      const html = await page.content();
      console.log('Page title:', await page.title());
      console.log('HTML length:', html.length);
      console.log('HTML preview:', html.substring(0, 500));

      // Check if we got redirected or blocked
      const currentUrl = page.url();
      console.log('Current URL:', currentUrl);

      // Try to find any form or input
      const formCount = await page.$$eval('form', forms => forms.length);
      const inputCount = await page.$$eval('input', inputs => inputs.length);
      console.log(`Forms: ${formCount}, Inputs: ${inputCount}`);

      if (formCount === 0) {
        // Page didn't load properly
        await page.close();
        return {
          idno,
          clientName: null,
          date: null,
          description: 'Error: Page blocked or not loaded properly',
        };
      }

      // Wait for the specific input field
      await page.waitForSelector('input[name="idno"]', { timeout: 10000 });

      // Fill and submit
      await page.type('input[name="idno"]', idno, { delay: 100 });

      console.log('Submitting form...');

      // Click submit button or submit form
      const submitClicked = await page.evaluate(() => {
        const submitBtn = document.querySelector('button[type="submit"], input[type="submit"]');
        if (submitBtn) {
          (submitBtn as HTMLElement).click();
          return true;
        }
        const form = document.querySelector('form');
        if (form) {
          form.submit();
          return true;
        }
        return false;
      });

      if (!submitClicked) {
        throw new Error('Could not submit form');
      }

      // Wait for navigation
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });

      console.log('Results loaded');

      // Wait for table
      await page.waitForSelector('table.ktable', { timeout: 10000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get results HTML
      const resultsHtml = await page.content();

      await page.close();

      return this.parseResults(resultsHtml, idno);

    } catch (error) {
      console.error(`Error scraping ${idno}:`, error.message);

      // Take error screenshot
      try {
        await page.screenshot({ path: `/tmp/error-${idno}.png` });
        console.log('Error screenshot saved');
      } catch { }

      await page.close();

      return {
        idno,
        clientName: null,
        date: null,
        description: 'Error: ' + error.message,
      };
    }
  }

  private parseResults(html: string, idno: string) {
    const $ = cheerio.load(html);
    const row = $('table.ktable tbody tr');

    if (row.length === 0) {
      return {
        idno,
        clientName: null,
        date: null,
        description: 'No records found',
      };
    }

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
  }

  // Scrape multiple IDs with delay
  async scrapeMultiple(idNumbers: string[], delayMs: number = 2000) {
    const results = [];

    for (const idno of idNumbers) {
      const result = await this.scrape(idno);
      results.push(result);

      // Delay between requests (respectful scraping)
      if (idNumbers.indexOf(idno) < idNumbers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  // Clean up - call when done with all scraping
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}