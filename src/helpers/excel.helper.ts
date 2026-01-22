import { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { getLoanExportHeaders } from './loan.helper';
import { normalizeName } from './accountId.helper';
import { getPaymentReportExportHeaders } from './reports.helper';

export const generateExcel = async (
  data: any[],
  columns: string[],
  sheetName = 'Sheet1',
): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  const loanHeaders = getLoanExportHeaders();
  const displayHeaders = getDisplayHeaders(columns, loanHeaders);

  // Add header row
  worksheet.addRow(displayHeaders);

  // Style header row
  // styleHeaderRow(worksheet);

  // Format and add data rows ONCE
  const formattedData = formatData(data, columns);
  formattedData.forEach((row) => {
    worksheet.addRow(row);
  });

  // Format cells (numbers, dates, etc.)
  formatCells(worksheet);

  // Auto-fit columns
  // autoFitColumns(worksheet, columns);

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
};

const styleHeaderRow = (worksheet: ExcelJS.Worksheet): void => {
  const headerRow = worksheet.getRow(1);

  headerRow.font = {
    bold: true,
    size: 12,
    color: { argb: 'FFFFFFFF' }
  };

  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '845adf' },
  };

  headerRow.alignment = {
    vertical: 'middle',
    horizontal: 'center'
  };

  headerRow.height = 25;

  // Add borders to header cells
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
};

const autoFitColumns = (worksheet: ExcelJS.Worksheet, columns: string[]): void => {
  columns.forEach((_, colIndex) => {
    const column = worksheet.getColumn(colIndex + 1);
    let maxLength = 10; // Minimum width

    column.eachCell({ includeEmpty: false }, (cell) => {
      const cellValue = cell.value ? cell.value.toString() : '';
      maxLength = Math.max(maxLength, cellValue.length);
    });

    // Set width with some padding, max 50
    column.width = Math.min(maxLength + 2, 50);
  });
};

const formatData = (data: any[], columns: string[]): any[][] => {
  return data.map((row) => {
    return columns.map((col) => {
      const value = row[col];

      // Handle null/undefined
      if (value === null || value === undefined) {
        return '';
      }

      // Handle Prisma Decimal
      if (value instanceof Prisma.Decimal) {
        return value.toNumber();
      }

      // Keep Date objects as is (Excel will format them)
      if (value instanceof Date) {
        return value;
      }

      // Keep numbers as numbers
      if (typeof value === 'number') {
        return value;
      }

      // Try to parse as number if it's a string number
      if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
        return Number(value);
      }

      // Boolean
      if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
      }

      return value;
    });
  });
};

const formatCells = (worksheet: ExcelJS.Worksheet): void => {
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    row.eachCell((cell) => {
      const value = cell.value;

      // Format dates
      if (value instanceof Date) {
        cell.numFmt = 'dd.mm.yyyy';
      }

      // Format numbers with decimals
      if (typeof value === 'number' && !Number.isInteger(value)) {
        cell.numFmt = '#,##0.00';
      }

      // Format integers
      if (typeof value === 'number' && Number.isInteger(value)) {
        cell.numFmt = '#,##0';
      }

      // cell.fill = {
      //   type: 'pattern',
      //   pattern: 'solid',
      //   fgColor: { argb: rowNumber % 2 === 0 ? 'FFFFFFFF' : 'e6def9' },
      // };
    });
    // row.alignment = {
    //   vertical: 'middle',
    //   horizontal: 'left',
    // };
  });
};

const getDisplayHeaders = (
  columns: string[],
  headerMap: Record<string, string>
): string[] => {
  return columns.map((col) => headerMap[col] || col);
};

export const parseExcelBuffer = async (buffer: Buffer): Promise<any[]> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const worksheet = workbook.worksheets[0];
  const rows: any[] = [];
  let headers: string[] = [];

  worksheet.eachRow((row, rowNumber) => {
    const values = row.values as any[];
    values.shift(); // remove first undefined element

    if (rowNumber === 1) {
      // Header row
      headers = values.map(v => v?.toString().trim());
    } else {
      const obj: Record<string, any> = {};
      values.forEach((cell, i) => {
        obj[headers[i]] = cell ?? null;
      });
      rows.push(obj);
    }
  });

  return rows.map(r => ({
    collectorId: Number(r.id || ''),
    targetAmount: Number(r.plan ?? 0),
    year: Number(r.planYear ?? 0),
    month: Number(r.planMonth ?? 0),
  }));
}

export const getUserExport = async (
  data: any[],
  columns: string[],
  sheetName = 'Sheet1',
): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // Add header row
  worksheet.addRow(columns);

  // Style header row
  styleHeaderRow(worksheet);

  // Format and add data rows ONCE
  const formattedData = formatData(data, columns);
  formattedData.forEach((row) => {
    worksheet.addRow(row);
  });

  // Format cells (numbers, dates, etc.)
  formatCells(worksheet);

  // Auto-fit columns
  autoFitColumns(worksheet, columns);

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
}

export const paymentReportExport = async (data: any[], columns: string[], sheetName = 'Sheet1'): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  const paymentHeaders = getPaymentReportExportHeaders();
  const displayHeaders = getDisplayHeaders(columns, paymentHeaders);

  // Add header row
  worksheet.addRow(displayHeaders);

  // Style header row
  styleHeaderRow(worksheet);

  // Format and add data rows ONCE
  const formattedData = formatData(data, columns);

  formattedData.forEach((row) => {
    worksheet.addRow(row);
  });

  // Format cells (numbers, dates, etc.)
  formatCells(worksheet);

  // Auto-fit columns
  autoFitColumns(worksheet, columns);

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
}

export const generateExcelStream = async (
  dataGenerator: AsyncGenerator<any[], void, unknown>,
  columns: string[],
  sheetName = 'Sheet1',
  headerMap?: Record<string, string>
): Promise<Buffer> => {
  const { PassThrough } = require('stream');
  const chunks: Buffer[] = [];

  // Create a PassThrough stream to collect data
  const bufferStream = new PassThrough();

  bufferStream.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });

  // Wait for stream to finish
  const streamFinished = new Promise<void>((resolve, reject) => {
    bufferStream.on('end', resolve);
    bufferStream.on('error', reject);
  });

  // Create workbook with proper writable stream
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: bufferStream,
    useStyles: false, // Disable styles for performance
    useSharedStrings: false, // Disable shared strings for performance
  });

  const worksheet = workbook.addWorksheet(sheetName);

  // Set fixed column widths (avoid auto-fit for performance)
  worksheet.columns = columns.map(col => ({
    key: col,
    width: 15,
  }));

  // Add header row
  const loanHeaders = headerMap || getLoanExportHeaders();
  const displayHeaders = getDisplayHeaders(columns, loanHeaders);
  const headerRow = worksheet.addRow(displayHeaders);

  // Style header row (simple styling only)
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '845adf' },
  };
  headerRow.commit();

  // Process data in chunks
  for await (const dataChunk of dataGenerator) {
    const formattedData = formatData(dataChunk, columns);

    for (const rowData of formattedData) {
      const row = worksheet.addRow(rowData);
      row.commit(); // Commit each row immediately
    }
  }

  // Commit worksheet and workbook
  worksheet.commit();
  await workbook.commit();

  // Wait for all data to be written
  await streamFinished;

  // Combine all chunks into a single buffer
  return Buffer.concat(chunks);
};


