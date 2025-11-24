import { Module } from '@nestjs/common';
import { ExcelImportController } from './excel-import.controller';
import { ExcelImportService } from './excel-import.service';
import { ExcelParserHelper } from './helpers/excel-parser.helper';
import { DataMapperHelper } from './helpers/data-mapper.helper';

@Module({
  controllers: [ExcelImportController],
  providers: [ExcelImportService, ExcelParserHelper, DataMapperHelper],
  exports: [ExcelImportService],
})
export class ExcelImportModule {}
