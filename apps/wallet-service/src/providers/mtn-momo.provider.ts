import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { v4 as uuid } from 'uuid';
import * as crypto from 'crypto';

/**
 * MTN Mobile Money (MoMo) Provider
 *
 * MOCK MODE: All calls succeed immediately (controlled by MTN_MOMO_MOCK=true env)
 * LIVE MODE: Uses MTN MoMo API v1 (Rwanda sandbox/production)
 *
 * To go live:
 * 1. Register at https://momodeveloper.mtn.com
 * 2. Subscribe to Collections + Disbursements products
 * 3. Generate API Key and set MTN_MOMO_MOCK=false + real credentials in env
 */
@Injectable()
export class MtnMomoProvider {
  private readonly logger = new Logger(MtnMomoProvider.name);
  private readonly isMock: boolean;
  private client: AxiosInstance;

  // MoMo API base URLs
  private readonly SANDBOX_URL = 'https://sandbox.momodeveloper.mtn.com';
  private readonly PROD_URL = 'https://proxy.momoapi.mtn.com';

  constructor(private readonly config: ConfigService) {
    this.isMock = config.get<string>('MTN_MOMO_MOCK', 'true') === 'true';

    const baseURL = config.get('NODE_ENV') === 'production'
      ? this.PROD_URL : this.SANDBOX_URL;

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Target-Environment': config.get('NODE_ENV') === 'production' ? 'mtnrwanda' : 'sandbox',
        'Ocp-Apim-Subscription-Key': config.get('MTN_MOMO_SUBSCRIPTION_KEY', 'mock-key'),
      },
    });
  }

  /**
   * Request payment from customer (Collections API)
   * Customer receives USSD push to approve
   */
  async requestPayment(phone: string, amountRwf: number, reference: string): Promise<{
    success: boolean;
    providerRef: string;
  }> {
    if (this.isMock) {
      this.logger.debug(`[MOCK] MTN MoMo request payment: ${phone} ${amountRwf} RWF ref=${reference}`);
      await this.simulateDelay(800);
      return { success: true, providerRef: `MOCK-MTN-${uuid().slice(0, 8).toUpperCase()}` };
    }

    const externalId = uuid();
    const token = await this.getAccessToken('collection');

    await this.client.post('/collection/v1_0/requesttopay', {
      amount: amountRwf.toString(),
      currency: 'RWF',
      externalId,
      payer: { partyIdType: 'MSISDN', partyId: this.formatPhone(phone) },
      payerMessage: `Umukino deposit - ${reference}`,
      payeeNote: `Deposit ref: ${reference}`,
    }, {
      headers: { Authorization: `Bearer ${token}`, 'X-Reference-Id': externalId },
    });

    return { success: true, providerRef: externalId };
  }

  /**
   * Send payment to customer (Disbursements API)
   */
  async sendPayment(phone: string, amountRwf: number, reference: string): Promise<{
    success: boolean;
    providerRef: string;
  }> {
    if (this.isMock) {
      this.logger.debug(`[MOCK] MTN MoMo send payment: ${phone} ${amountRwf} RWF ref=${reference}`);
      await this.simulateDelay(1200);
      return { success: true, providerRef: `MOCK-MTN-DIS-${uuid().slice(0, 8).toUpperCase()}` };
    }

    const externalId = uuid();
    const token = await this.getAccessToken('disbursement');

    await this.client.post('/disbursement/v1_0/transfer', {
      amount: amountRwf.toString(),
      currency: 'RWF',
      externalId,
      payee: { partyIdType: 'MSISDN', partyId: this.formatPhone(phone) },
      payerMessage: `Umukino withdrawal - ${reference}`,
      payeeNote: `Withdrawal ref: ${reference}`,
    }, {
      headers: { Authorization: `Bearer ${token}`, 'X-Reference-Id': externalId },
    });

    return { success: true, providerRef: externalId };
  }

  /**
   * Check payment status (for webhook fallback polling)
   */
  async checkStatus(providerRef: string, type: 'collection' | 'disbursement'): Promise<{
    status: 'PENDING' | 'SUCCESSFUL' | 'FAILED';
    reason?: string;
  }> {
    if (this.isMock) {
      return { status: 'SUCCESSFUL' };
    }

    const token = await this.getAccessToken(type);
    const path = type === 'collection'
      ? `/collection/v1_0/requesttopay/${providerRef}`
      : `/disbursement/v1_0/transfer/${providerRef}`;

    const res = await this.client.get(path, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return {
      status: res.data.status === 'SUCCESSFUL' ? 'SUCCESSFUL'
        : res.data.status === 'FAILED' ? 'FAILED' : 'PENDING',
      reason: res.data.reason,
    };
  }

  /**
   * Verify webhook signature (HMAC-SHA256)
   */
  verifyWebhookSignature(headers: any, body: any): boolean {
    if (this.isMock) return true;
    const signature = headers['x-callback-signature'];
    const secret = this.config.get('MTN_MOMO_WEBHOOK_SECRET');
    if (!signature || !secret) return false;

    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(JSON.stringify(body)).digest('hex');
    return signature === digest;
  }

  private async getAccessToken(product: 'collection' | 'disbursement'): Promise<string> {
    const key = product === 'collection'
      ? this.config.get('MTN_MOMO_COLLECTION_KEY')
      : this.config.get('MTN_MOMO_DISBURSEMENT_KEY');

    const userId = this.config.get(`MTN_MOMO_${product.toUpperCase()}_USER_ID`);
    const res = await this.client.post(`/${product}/token/`, {}, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${userId}:${key}`).toString('base64')}`,
        'Ocp-Apim-Subscription-Key': this.config.get(`MTN_MOMO_${product.toUpperCase()}_SUBSCRIPTION_KEY`),
      },
    });
    return res.data.access_token;
  }

  private formatPhone(phone: string): string {
    // Ensure format: 2507XXXXXXXX (Rwanda)
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('07')) return `250${cleaned.slice(1)}`;
    if (cleaned.startsWith('7')) return `250${cleaned}`;
    return cleaned;
  }

  private simulateDelay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}
