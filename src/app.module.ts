import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { AppController } from './app.controller';


@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    PortfolioModule
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
