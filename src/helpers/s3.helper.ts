import { Injectable } from "@nestjs/common";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

@Injectable()
export class S3Helper {
    private s3Client: S3Client;

    constructor() {
        this.s3Client = new S3Client({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            },
        });
    }

    async upload(
        file: Buffer,
        fileName: string,
        contentType?: string
    ): Promise<void> {
        try {
            const command = new PutObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET,
                Key: fileName,
                Body: file,
                ContentType: contentType,
            });

            await this.s3Client.send(command);
        } catch (error) {
            throw new Error(`Failed to upload file to S3: ${error.message}`);
        }
    }

    async getSignedUrl(fileKey: string, expiresIn = 60): Promise<string> {
        try {
            const command = new GetObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET,
                Key: fileKey,
            });

            const url = await getSignedUrl(this.s3Client, command, { expiresIn });
            return url;
        } catch (error: any) {
            throw new Error(`Failed to generate signed URL: ${error.message}`);
        }
    }
}
