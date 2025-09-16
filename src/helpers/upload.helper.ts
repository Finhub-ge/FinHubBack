import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { S3Helper } from './s3.helper';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UploadsHelper {
    constructor(
        private readonly s3Helper: S3Helper,
        private readonly prisma: PrismaService,
    ) { }

    async uploadFile(file: Express.Multer.File, folder: string) {
        const fileKey = `${folder}/${Date.now()}-${file.originalname}`;
        const contentType = file.mimetype || 'application/octet-stream';

        try {
            await this.s3Helper.upload(file.buffer, fileKey, contentType);

            const upload = await this.prisma.uploads.create({
                data: {
                    originalFileName: file.originalname,
                    filePath: fileKey,
                    sizeBytes: file.size,
                },
            });

            return upload;
        } catch (err) {
            throw new InternalServerErrorException('File upload failed: ' + err.message);
        }
    }
}