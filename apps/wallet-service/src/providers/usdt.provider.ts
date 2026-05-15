import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { v4 as uuid } from 'uuid';

// USDT PROVIDER (via Binance Pay or direct TRC20/ERC20)
// ============================================================

/**
 * USDT Provider
 *
 * MOCK MODE: USDT_MOCK=true (default)
 * LIVE MODE: Integrate with Binance Pay API or on-chain address monitoring
 *
 * Strategy:
 * - Deposits: Generate unique TRC20 wallet per user, monitor via webhook
 * - Withdrawals: Send via Binance Pay or direct on-chain transfer
 *
 * To go live:
 * 1. Create Binance merchant account
 * 2. Set USDT_MOCK=false + BINANCE_API_KEY + BINANCE_SECRET_KEY
 * 3. Or: Set up Tron node + HD wallet for TRC20 address generation
 */
@Injectable()
export class UsdtProvider {
  private readonly logger = new Logger(UsdtProvider.name);
  private readonly isMock: boolean;

  // Conversion: approximate RWF to USDT (update via price feed in production)
  private readonly RWF_PER_USDT = 1340;

  constructor(private readonly config: ConfigService) {
    this.isMock = config.get<string>('USDT_MOCK', 'true') === 'true';
  }

  async createDepositAddress(userId: string, amountRwf: number, reference: string): Promise<{
    success: boolean;
    providerRef: string; // This is the wallet address to show the user
    amountUsdt: number;
  }> {
    const amountUsdt = amountRwf / this.RWF_PER_USDT;

    if (this.isMock) {
      this.logger.debug(`[MOCK] USDT deposit address for user=${userId} amount=${amountUsdt.toFixed(4)} USDT ref=${reference}`);
      await this.delay(500);
      // Mock TRC20 address
      const mockAddress = `TMOCK${userId.slice(0, 8).toUpperCase()}${Date.now().toString(36).toUpperCase()}`;
      return { success: true, providerRef: mockAddress, amountUsdt };
    }

    // LIVE: Generate unique deposit address using HD wallet derivation
    // or use Binance Pay order API
    const client = axios.create({
      baseURL: 'https://bpay.binanceapi.com',
      headers: {
        'BinancePay-Timestamp': Date.now().toString(),
        'BinancePay-Nonce': uuid().replace(/-/g, '').slice(0, 32),
      },
    });

    // Binance Pay order creation
    const res = await client.post('/binancepay/openapi/v3/order', {
      env: { terminalType: 'WEB' },
      merchantTradeNo: reference.slice(0, 32),
      orderAmount: amountUsdt.toFixed(4),
      currency: 'USDT',
      goods: {
        goodsType: '02',
        goodsCategory: 'Z000',
        referenceGoodsId: reference,
        goodsName: 'Umukino wallet deposit',
      },
    });

    return {
      success: true,
      providerRef: res.data.data?.checkoutUrl || reference,
      amountUsdt,
    };
  }

  async sendPayment(address: string, amountRwf: number, reference: string): Promise<{
    success: boolean;
    providerRef: string;
  }> {
    const amountUsdt = amountRwf / this.RWF_PER_USDT;

    if (this.isMock) {
      this.logger.debug(`[MOCK] USDT withdrawal: ${address} ${amountUsdt.toFixed(4)} USDT ref=${reference}`);
      await this.delay(1500);
      return { success: true, providerRef: `MOCK-USDT-TX-${uuid().slice(0, 12).toUpperCase()}` };
    }

    // LIVE: Use Binance Pay or TronWeb for TRC20 transfer
    throw new Error('USDT live withdrawal not yet configured — set USDT_MOCK=false and configure provider');
  }

  async getUsdtRate(): Promise<number> {
    if (this.isMock) return this.RWF_PER_USDT;
    // Fetch from exchange API in production
    return this.RWF_PER_USDT;
  }

  private delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }
}

