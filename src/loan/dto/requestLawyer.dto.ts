import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class RequestLawyerDto {
  @ApiProperty()
  @IsNotEmpty()
  publicId: string;
}
