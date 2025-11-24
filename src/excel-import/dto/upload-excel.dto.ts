import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class UploadExcelDto {
  @ApiProperty({
    description: 'Excel file to upload',
    type: 'string',
    format: 'binary',
  })
  // @IsNotEmpty()
  file: Express.Multer.File;
}
