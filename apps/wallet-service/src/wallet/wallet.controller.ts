import {
import { AuthGuard } from '@nestjs/passport';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { WalletService } from './wallet.service';
import { MtnMomoProvider } from '../providers/mtn-momo.provider';
import { AirtelMoneyProvider } from '../providers/airtel-money.provider';
import { PaymentProvider } from '@umukino/shared-types';
import { IsString, IsNumber, IsEnum, Min, Max, IsOptional } from 'class-validator';

class DepositDto {
  @IsNumber() @Min(500) @Max(5000000) amount: number;
  @IsEnum(PaymentProvider) provider: PaymentProvider;
  @IsString() phoneOrAddress: string;
}

class WithdrawDto {
  @IsNumber() @Min(1000) @Max(2000000) amount: number;
  @IsEnum(PaymentProvider) provider: PaymentProvider;
  @IsString() phoneOrAddress: string;
}

@Controller()
@UseGuards(AuthGuard('jwt'), ThrottlerGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class WalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly mtnMomo: MtnMomoProvider,
    private readonly airtel: AirtelMoneyProvider,
  ) {}

  @Get('health')
  @UseGuards() // no jwt on health
  health() { return { status: 'ok', service: 'wallet-service', ts: new Date().toISOString() }; }

  @Get('wallet/balance')
  async getBalance(@Req() req: any) {
    return this.wallet.getBalance(req.user.sub);
  }

  @Get('wallet/transactions')
  async getTransactions(@Req() req: any, @Query('page') page = '1') {
    return this.wallet.getTransactions(req.user.sub, parseInt(page));
  }

  @Post('wallet/deposit')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async deposit(@Req() req: any, @Body() dto: DepositDto) {
    return this.wallet.initiateDeposit(req.user.sub, dto.amount, dto.provider, dto.phoneOrAddress);
  }

  @Post('wallet/withdraw')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async withdraw(@Req() req: any, @Body() dto: WithdrawDto) {
    return this.wallet.initiateWithdrawal(req.user.sub, dto.amount, dto.provider, dto.phoneOrAddress);
  }

  // ---- Internal: called by room service after game ends ----
  @Post('wallet/internal/credit-prize')
  async creditPrize(@Body() body: { userId: string; amount: number; roomId: string }) {
    // Internal call — only accessible from room service (no public route in gateway)
    await this.wallet.creditPrize(body.userId, body.amount, body.roomId);
    return { success: true };
  }

  // ---- Webhooks from payment providers ----
  @Post('wallet/webhook/:provider')
  @HttpCode(HttpStatus.OK)
  @UseGuards() // No JWT — provider-signed request
  async webhook(@Param('provider') provider: string, @Body() body: any, @Req() req: any) {
    // Validate provider signature
    let valid = false;
    if (provider === PaymentProvider.MTN_MOMO) {
      valid = this.mtnMomo.verifyWebhookSignature(req.headers, body);
    } else if (provider === PaymentProvider.AIRTEL_MONEY) {
      valid = this.airtel.verifyWebhookSignature(req.headers, body);
    } else {
      // For USDT/Binance, might need different logic
      valid = true; 
    }

    if (!valid) throw new ForbiddenException('Invalid signature');

    await this.wallet.confirmDeposit(body.reference || body.externalId, body.transactionId || body.id);
    return { success: true };
  }

  // ---- Admin ----
  @Get('admin/transactions')
  async adminTransactions(@Req() req: any, @Query('page') page = '1') {
    if (req.user.role !== 'admin') throw new Error('Forbidden');
    return this.wallet.getTransactions(undefined as any, parseInt(page));
  }
}
