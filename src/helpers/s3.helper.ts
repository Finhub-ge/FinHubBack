import { Injectable } from "@nestjs/common";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

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
        bucketName: string = process.env.AWS_S3_BUCKET,
        contentType?: string
    ): Promise<string> {
        try {
            const command = new PutObjectCommand({
                Bucket: bucketName,
                Key: fileName,
                Body: file,
                ContentType: contentType,
            });

            await this.s3Client.send(command);

            return `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${fileName}`;
        } catch (error) {
            throw new Error(`Failed to upload file to S3: ${error.message}`);
        }
    }
}
