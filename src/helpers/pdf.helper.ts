import * as pdf from 'html-pdf';

export const getPaymentScheduleHtml = (loanId: number, commitments: any) => {
    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            h1 { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: center; }
            th { background: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Payment Schedule for Loan #${loanId}</h1>
          ${commitments
            .map(
                (c) => `
              <h2>Commitment ID: ${c.id} (Amount: ${c.amount})</h2>
              <table>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Balance</th>
                </tr>
                ${c.PaymentSchedule.map(
                    (s) => `
                  <tr>
                    <td>${new Date(s.paymentDate).toLocaleDateString()}</td>
                    <td>${s.amount}</td>
                    <td>${s.balance}</td>
                  </tr>
                `,
                ).join('')}
              </table>
            `,
            )
            .join('')}
        </body>
      </html>
    `;

    return html;
}

export const generatePdfFromHtml = async (html: string): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        pdf.create(html, { format: 'A4', border: '10mm' }).toBuffer((err, buffer) => {
            if (err) reject(err);
            else resolve(buffer);
        });
    });
}