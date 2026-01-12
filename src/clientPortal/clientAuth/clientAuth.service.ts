import { BadRequestException, HttpException, HttpStatus, Injectable, UnauthorizedException } from "@nestjs/common";
import { ClientSigninDto } from "./dto/clientSignin.dto";
import { PrismaService } from "src/prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import { VerifyOtpDto } from "./dto/verifyOtp.dto";
import { UtilsHelper } from "src/helpers/utils.helper";

@Injectable()
export class ClientAuthService {
  private readonly OTP_EXPIRY_MINUTES = 1;
  private readonly MAX_OTP_ATTEMPTS = 3;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private utilsHelper: UtilsHelper,
  ) { }

  async signin(dto: ClientSigninDto) {
    const { personalId, phone } = dto;

    // Find debtor by personal ID and main phone
    const debtor = await this.prisma.debtor.findFirst({
      where: {
        idNumber: personalId,
        mainPhone: phone,
        deletedAt: null,
      },
      select: {
        id: true,
        publicId: true,
        idNumber: true,
        mainPhone: true,
      }
    });

    if (!debtor) {
      throw new HttpException(
        {
          status: HttpStatus.FORBIDDEN,
          error:
            'Invalid personal ID or phone number',
        },
        HttpStatus.FORBIDDEN,
        {},
      );
    }

    const recentOtp = await this.prisma.clientOtp.findFirst({
      where: {
        debtorPublicId: debtor.publicId,
        createdAt: { gt: new Date(Date.now() - 60000) }, // Last 1 minute
        isUsed: false
      }
    });

    if (recentOtp) {
      throw new BadRequestException('Please wait 1 minute before requesting new OTP');
    }

    await this.prisma.clientOtp.updateMany({
      where: { debtorPublicId: debtor.publicId, isUsed: false },
      data: { isUsed: true }
    });

    const otp = this.generateOtp();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);

    await this.prisma.clientOtp.create({
      data: {
        debtorId: debtor.id,
        debtorPublicId: debtor.publicId,
        personalId: debtor.idNumber,
        otp,
        expiresAt,
        attempts: 0
      }
    });

    // Send OTP via SMS
    const smsMessage = `თქვენი ავტორიზაციის კოდია: ${otp}\n\nკოდი ძალაშია ${this.OTP_EXPIRY_MINUTES} წუთის განმავლობაში.`;

    // TODO: Uncomment this on production
    // try {
    //   await this.utilsHelper.sendSms(debtor.mainPhone, smsMessage);
    // } catch (error) {
    //   // If SMS fails, still return success but log the error
    //   console.error('Failed to send OTP SMS:', error);
    //   throw new BadRequestException('Failed to send OTP. Please try again.');
    // }

    return {
      message: `OTP sent successfully to ${this.maskPhone(debtor.mainPhone)}`,
      debtorPublicId: debtor.publicId,
      otp: otp, // TODO: Remove this on production
      smsMessage: smsMessage, // TODO: Remove this on production
    };
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private maskPhone(phone: string): string {
    if (!phone || phone.length < 4) return '***';
    const lastFour = phone.slice(-4);
    return `***${lastFour}`;
  }

  async signToken(
    id: number,
    publicId: string,
    personalId: string
  ): Promise<{ access_token: string }> {
    const payload = {
      sub: id,
      publicId,
      personalId,
      type: 'client',
    };

    const token = await this.jwt.signAsync(
      payload,
      // {
      //   expiresIn: '600m',
      //   secret: secret,
      // },
    );

    return {
      access_token: token,
    };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    // 1. Find active OTP
    const otpRecord = await this.prisma.clientOtp.findFirst({
      where: {
        debtorPublicId: verifyOtpDto.debtorPublicId,
        isUsed: false,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 2. Validate OTP exists
    if (!otpRecord) {
      throw new UnauthorizedException('OTP expired');
    }

    // 3. Check max attempts
    if (otpRecord.attempts >= this.MAX_OTP_ATTEMPTS) {
      await this.prisma.clientOtp.update({
        where: { id: otpRecord.id },
        data: { isUsed: true }
      });
      throw new UnauthorizedException('Max attempts exceeded');
    }

    // 4. Verify OTP
    if (otpRecord.otp !== verifyOtpDto.otp) {
      await this.prisma.clientOtp.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } }
      });
      throw new UnauthorizedException(`Invalid OTP. ${3 - otpRecord.attempts - 1} attempts remaining`);
    }

    // 5. Mark as used
    await this.prisma.clientOtp.update({
      where: { id: otpRecord.id },
      data: { isUsed: true, usedAt: new Date() }
    });

    // 6. Get debtor and generate JWT
    const debtor = await this.prisma.debtor.findFirst({
      where: { publicId: verifyOtpDto.debtorPublicId, deletedAt: null },
      select: {
        id: true,
        publicId: true,
        idNumber: true,
        mainPhone: true,
      }
    });

    return this.signToken(debtor.id, debtor.publicId, debtor.idNumber);
  }

  async getCurrentUser(user: any) {
    const currentUser =
      await this.prisma.debtor.findFirst({
        where: {
          id: user.id,
        },
        include: {
          DebtorStatus: true,
        }
      });

    // if user does not exist throw exception
    if (!currentUser) {
      throw new HttpException(
        {
          status: HttpStatus.FORBIDDEN,
          error:
            'User not found.',
        },
        HttpStatus.FORBIDDEN,
        {},
      );
    }

    return currentUser;
  }
}