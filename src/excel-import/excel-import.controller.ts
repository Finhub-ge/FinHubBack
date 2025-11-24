import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { ExcelImportService } from './excel-import.service';
import { UploadExcelDto } from './dto/upload-excel.dto';
import { ImportResultDto } from './dto/import-result.dto';
import { JwtGuard } from '../auth/guard/jwt.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { GetUser } from '../auth/decorator/get-user.decorator';
import { User } from '@prisma/client';
import { Roles } from 'src/auth/decorator/role.decorator';
import { Role } from 'src/enums/role.enum';

@ApiTags('Excel Import')
@ApiBearerAuth('access-token')
@Controller('excel-import')
export class ExcelImportController {
  constructor(private readonly excelImportService: ExcelImportService) { }

  @Post('upload')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  // @ApiOperation({
  //   summary: 'Upload and import Excel file with loan data',
  //   description:
  //     'Uploads an Excel file containing loan, debtor, payment, and guarantor data. The file should have sheets named: Atributes, Paymants, Guarantors, and განაწილება.',
  // })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'Excel file processed successfully',
  })
  // @ApiResponse({
  //   status: 400,
  //   description: 'Invalid file or data format',
  // })
  @UseInterceptors(FileInterceptor('file'))
  async uploadExcel(
    @GetUser() user: User,
    @Body() uploadDto: UploadExcelDto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ImportResultDto> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (
      !file.originalname.endsWith('.xlsx') &&
      !file.originalname.endsWith('.xls')
    ) {
      throw new BadRequestException(
        'Invalid file format. Please upload an Excel file (.xlsx or .xls)',
      );
    }

    return await this.excelImportService.processExcelFile(
      file.buffer,
      user.id,
    );
  }
}
