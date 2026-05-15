import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { v4 as uuid } from 'uuid';
import * as crypto from 'crypto';

// ============================================================
// AIRTEL MONEY PROVIDER
// ============================================================

/**
 * Airtel Money Rwanda Provider
 *
 * MOCK MODE: MTN_AIRTEL_MOCK=true (default)
 * LIVE MODE: Register at https://developers.airtel.africa
 *
 * To go live:
 * 1. Register as merchant at https://developers.airtel.africa
 * 2. Get CLIENT_ID + CLIENT_SECRET for Rwanda
 * 3. Set AIRTEL_MOCK=false and fill credentials
 */
@Injectable()
export class AirtelMoneyProvider {
  private readonly logger = new Logger(AirtelMoneyProvider.name);
  private readonly isMock: boolean;
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  private readonly BASE_URL = 'https://openapi.airtel.africa';

  constructor(private readonly config: ConfigService) {
    this.isMock = config.get<string>('AIRTEL_MOCK', 'true') === 'true';
    this.client = axios.create({ baseURL: this.BASE_URL, timeout: 30000 });
  }

  async requestPayment(phone: string, amountRwf: number, reference: string): Promise<{
    success: boolean;
    providerRef: string;
  }> {
    if (this.isMock) {
      this.logger.debug(`[MOCK] Airtel request payment: ${phone} ${amountRwf} RWF ref=${reference}`);
      await this.delay(700);
      return { success: true, providerRef: `MOCK-AIR-${uuid().slice(0, 8).toUpperCase()}` };
    }

    const token = await this.getToken();
    const transId = uuid().replace(/-/g, '').slice(0, 12).toUpperCase();

    const res = await this.client.post('/merchant/v2/payments/', {
      reference,
      subscriber: { country: 'RW', currency: 'RWF', msisdn: this.formatPhone(phone) },
      transaction: { amount: amountRwf, country: 'RW', currency: 'RWF', id: transId },
    }, {
      headers: { Authorization: `Bearer ${token}`, 'X-Country': 'RW', 'X-Currency': 'RWF' },
    });

    return { success: true, providerRef: res.data.data?.transaction?.id || transId };
  }

  async sendPayment(phone: string, amountRwf: number, reference: string): Promise<{
    success: boolean;
    providerRef: string;
  }> {
    if (this.isMock) {
      this.logger.debug(`[MOCK] Airtel send payment: ${phone} ${amountRwf} RWF ref=${reference}`);
      await this.delay(900);
      return { success: true, providerRef: `MOCK-AIR-DIS-${uuid().slice(0, 8).toUpperCase()}` };
    }

    const token = await this.getToken();
    const transId = uuid().replace(/-/g, '').slice(0, 12).toUpperCase();

    const res = await this.client.post('/standard/v1/disbursements/', {
      payee: { msisdn: this.formatPhone(phone) },
      reference,
      pin: this.config.get('AIRTEL_PIN'),
      transaction: { amount: amountRwf, id: transId, type: 'B2C' },
    }, {
      headers: { Authorization: `Bearer ${token}`, 'X-Country': 'RW', 'X-Currency': 'RWF' },
    });

    return { success: true, providerRef: res.data.data?.transaction?.id || transId };
  }

  async checkStatus(transactionId: string): Promise<{ status: 'PENDING' | 'SUCCESSFUL' | 'FAILED' }> {
    if (this.isMock) return { status: 'SUCCESSFUL' };

    const token = await this.getToken();
    const res = await this.client.get(`/standard/v1/payments/${transactionId}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Country': 'RW', 'X-Currency': 'RWF' },
    });
    const s = res.data?.data?.transaction?.status?.toUpperCase();
    return { status: s === 'SUCCESS' ? 'SUCCESSFUL' : s === 'FAILED' ? 'FAILED' : 'PENDING' };
  }

  /**
   * Verify webhook signature (HMAC-SHA256)
   */
  verifyWebhookSignature(headers: any, body: any): boolean {
    if (this.isMock) return true;
    const signature = headers['x-signature'];
    const secret = this.config.get('AIRTEL_WEBHOOK_SECRET');
    if (!signature || !secret) return false;

    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(JSON.stringify(body)).digest('hex');
    return signature === digest;
  }

  private async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) return this.accessToken!;

    const res = await this.client.post('/auth/oauth2/token', {
      client_id: this.config.get('AIRTEL_CLIENT_ID'),
      client_secret: this.config.get('AIRTEL_CLIENT_SECRET'),
      grant_type: 'client_credentials',
    });

    this.accessToken = res.data.access_token;
    this.tokenExpiry = Date.now() + (res.data.expires_in - 60) * 1000;
    return this.accessToken!;
  }

  private formatPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('07')) return `250${cleaned.slice(1)}`;
    if (cleaned.startsWith('7')) return `250${cleaned}`;
    return cleaned;
  }

  private delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }
}


// ============================================================


