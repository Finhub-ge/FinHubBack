import { Loan } from '@prisma/client';
import puppeteer from "puppeteer";

export const getPaymentScheduleHtml = (loan: Loan, commitments: any) => {
    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { margin: 0; font-size: 24px; color: #333; }
            .case-info { margin-bottom: 20px; }
            .case-info p { margin: 5px 0; font-size: 14px; color: #555; }
            .schedule-section { margin-bottom: 30px; }
            .schedule-title { font-size: 14px; font-weight: bold; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ccc; padding: 10px; text-align: center; }
            th { background: #f2f2f2; font-weight: bold; }
            .amount { text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Payment Statement</h2>
          </div>
          
          <div class="case-info">
            <p><strong>Case:</strong> ${loan.caseId}</p>
          </div>

          ${commitments
            .map(
                (c) => `
              <div class="schedule-section">
                <p><strong>Total Amount:</strong> ${parseFloat(c.amount).toFixed(2)} ${loan.currency}</p>
                
                <div class="schedule-title">Statement Details:</div>
                <table>
                  <tr>
                    <th>Payment Date</th>
                    <th>Payment Amount</th>
                    <th>Remaining Balance</th>
                  </tr>
                    ${c.PaymentSchedule.map(
                    (s) => {
                        const date = new Date(s.paymentDate);
                        const formattedDate = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
                        return `
                        <tr>
                            <td>${formattedDate}</td>
                            <td class="amount">${parseFloat(s.amount).toFixed(2)} ${c.currency || 'GEL'}</td>
                            <td class="amount">${parseFloat(s.balance).toFixed(2)} ${c.currency || 'GEL'}</td>
                        </tr>
                        `;
                    }
                ).join('')}
                </table>
              </div>
            `,
            )
            .join('')}
        </body>
      </html>
    `;

    return html;
}

export const generatePdfFromHtml = async (html: string): Promise<Buffer> => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    // Set HTML content
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Generate PDF
    const buffer = await page.pdf({
        format: "A4",
        margin: {
            top: "10mm",
            right: "10mm",
            bottom: "10mm",
            left: "10mm",
        },
        printBackground: true,
    });

    await browser.close();
    return Buffer.from(buffer);
};