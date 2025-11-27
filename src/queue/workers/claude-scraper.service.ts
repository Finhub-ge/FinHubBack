import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

interface ScrapeResult {
  idno: string;
  clientName: string | null;
  date: string | null;
  description: string;
}

@Injectable()
export class ClaudeScraperService {
  private readonly logger = new Logger(ClaudeScraperService.name);
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async scrape(idno: string): Promise<ScrapeResult> {
    this.logger.log(`Scraping ID: ${idno}`);

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: `I need you to scrape data from the Georgian Debt Registry website.

Please follow these steps:
1. Navigate to: https://debt.reestri.gov.ge/ipove_movale.php
2. Fill in the ID number field with: ${idno}
3. Submit the search form
4. Extract the debtor information from the results table

The results table has this structure:
- Column 2 contains: Name (in <strong> tag), Personal ID (in parentheses), Address, Registration number and date (#NUMBER DATE)
- Column 3 contains: Executor name (აღმასრულებელი:), Addition info (A-NUMBER DATE), Case number (სააღსრულებო საქმე:)

Please return the data in this EXACT JSON format with NO other text:
{
  "clientName": "extracted name",
  "date": "YYYY-MM-DD HH:MM:SS",
  "description": "Name (ID) ; Address ; #REG_NUM DATE ; აღმასრულებელი: Name ; დამატება: INFO ; ს/ს CASE"
}

If no results found, return:
{
  "clientName": null,
  "date": null,
  "description": "No records found"
}

CRITICAL: Return ONLY the JSON object, nothing else. No markdown, no code blocks, no explanations.`,
          },
        ],
        // Note: Computer use requires beta access
        // You may need to request access from Anthropic
      });

      // Extract the response
      const content = response.content[0];
      if (content.type === 'text') {
        let jsonText = content.text.trim();

        // Remove markdown code blocks if present
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

        this.logger.debug(`Claude response: ${jsonText}`);

        try {
          const data = JSON.parse(jsonText);
          return {
            idno,
            ...data,
          };
        } catch (parseError) {
          this.logger.error(`Failed to parse JSON: ${jsonText}`);
          throw new Error('Invalid JSON response from Claude');
        }
      }

      throw new Error('Unexpected response format from Claude');
    } catch (error) {
      this.logger.error(`Error scraping ${idno}: ${error.message}`);
      return {
        idno,
        clientName: null,
        date: null,
        description: `Error: ${error.message}`,
      };
    }
  }

  async scrapeMultiple(
    idNumbers: string[],
    delayMs: number = 3000,
  ): Promise<ScrapeResult[]> {
    this.logger.log(`Scraping ${idNumbers.length} IDs`);
    const results: ScrapeResult[] = [];

    for (let i = 0; i < idNumbers.length; i++) {
      const idno = idNumbers[i];

      try {
        const result = await this.scrape(idno);
        results.push(result);
        this.logger.log(`✓ Scraped ${i + 1}/${idNumbers.length}: ${idno}`);
      } catch (error) {
        this.logger.error(`✗ Failed ${i + 1}/${idNumbers.length}: ${idno}`);
        results.push({
          idno,
          clientName: null,
          date: null,
          description: `Error: ${error.message}`,
        });
      }

      // Delay between requests (except for last one)
      if (i < idNumbers.length - 1) {
        this.logger.debug(`Waiting ${delayMs}ms before next request...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    this.logger.log(`Completed: ${results.length} results`);
    return results;
  }

  async scrapeBatch(
    idNumbers: string[],
    batchSize: number = 5,
    delayMs: number = 3000,
  ): Promise<ScrapeResult[]> {
    this.logger.log(`Scraping ${idNumbers.length} IDs in batches of ${batchSize}`);
    const results: ScrapeResult[] = [];

    // Process in batches
    for (let i = 0; i < idNumbers.length; i += batchSize) {
      const batch = idNumbers.slice(i, i + batchSize);
      this.logger.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(idNumbers.length / batchSize)}`);

      // Process batch in parallel
      const batchPromises = batch.map((idno) => this.scrape(idno));
      const batchResults = await Promise.allSettled(batchPromises);

      // Collect results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            idno: batch[index],
            clientName: null,
            date: null,
            description: `Error: ${result.reason}`,
          });
        }
      });

      // Delay between batches
      if (i + batchSize < idNumbers.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }
}