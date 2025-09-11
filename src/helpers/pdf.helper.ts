import * as path from 'path';
import * as fs from 'fs';
import * as libre from 'libreoffice-convert';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PdfHelper {
    async renderDocxToPdf(templateFilePath: string, data: Record<string, any>): Promise<Buffer> {
        const distTemplatePath = path.join(process.cwd(), 'dist', templateFilePath);
        const srcTemplatePath = path.join(process.cwd(), 'src', templateFilePath);

        const templatePath = fs.existsSync(distTemplatePath) ? distTemplatePath : srcTemplatePath;

        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template not found: ${templateFilePath}`);
        }

        // Read the file as buffer
        const fileBuffer = fs.readFileSync(templatePath);
        const fileExtension = path.extname(templatePath).toLowerCase();

        let docxBuffer: Buffer;

        // Handle both .doc and .docx files
        if (fileExtension === '.doc') {
            // Convert .doc to .docx first
            docxBuffer = await this.convertDocToDocx(fileBuffer);
        } else if (fileExtension === '.docx') {
            docxBuffer = fileBuffer;
        } else {
            throw new Error(`Unsupported file format: ${fileExtension}. Only .doc and .docx are supported.`);
        }

        // Use the docx buffer for templating
        const zip = new PizZip(docxBuffer);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });

        doc.render(data);

        const filledDocxBuffer = doc.getZip().generate({
            type: 'nodebuffer',
            compression: 'DEFLATE',
        });

        return new Promise((resolve, reject) => {
            libre.convert(filledDocxBuffer, '.pdf', undefined, (err: any, pdfBuffer: Buffer) => {
                if (err) return reject(new Error(`PDF conversion failed: ${err.message}`));
                resolve(pdfBuffer);
            });
        });
    }

    private async convertDocToDocx(docBuffer: Buffer): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            // Use LibreOffice to convert .doc to .docx
            libre.convert(docBuffer, '.docx', undefined, (err: any, docxBuffer: Buffer) => {
                if (err) {
                    reject(new Error(`DOC to DOCX conversion failed: ${err.message}`));
                } else {
                    resolve(docxBuffer);
                }
            });
        });
    }
}