import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import * as libre from 'libreoffice-convert';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

@Injectable()
export class PdfHelper {
    async renderDocxToPdf(templateFilePath: string, data: Record<string, any>): Promise<Buffer> {
        const distTemplatePath = path.join(process.cwd(), 'dist', templateFilePath);
        const srcTemplatePath = path.join(process.cwd(), 'src', templateFilePath);

        const templatePath = fs.existsSync(distTemplatePath) ? distTemplatePath : srcTemplatePath;

        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template not found: ${templateFilePath}`);
        }

        const content = fs.readFileSync(templatePath, 'binary');

        const zip = new PizZip(content);
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
}
