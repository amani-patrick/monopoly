import {
  Injectable, Logger, BadRequestException, NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { v4 as uuid } from 'uuid';
import {
  Wallet, Transaction, TransactionType,
  TransactionStatus, PaymentProvider,
} from '@umukino/shared-types';
import { WalletEntity } from './entities/wallet.entity';
import { TransactionEntity } from './entities/transaction.entity';
import { MtnMomoProvider } from '../providers/mtn-momo.provider';
import { AirtelMoneyProvider } from '../providers/airtel-money.provider';
import { UsdtProvider } from '../providers/usdt.provider';

const MIN_DEPOSIT = 500;      // 500 RWF
const MAX_DEPOSIT = 5_000_000;
const MIN_WITHDRAW = 1_000;
const MAX_WITHDRAW = 2_000_000;

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(WalletEntity) private readonly walletRepo: Repository<WalletEntity>,
    @InjectRepository(TransactionEntity) private readonly txRepo: Repository<TransactionEntity>,
    @InjectRedis() private readonly redis: Redis,
    private readonly dataSource: DataSource,
    private readonly mtnMomo: MtnMomoProvider,
    private readonly airtel: AirtelMoneyProvider,
    private readonly usdt: UsdtProvider,
  ) {}

  // ============================================================
  // WALLET CRUD
  // ============================================================

  async getOrCreateWallet(userId: string): Promise<WalletEntity> {
    let wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) {
      wallet = await this.walletRepo.save({
        id: uuid(),
        userId,
        realBalance: 0,
        bonusBalance: 0,
        currency: 'RWF',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return wallet;
  }

  async getBalance(userId: string): Promise<{ real: number; bonus: number; total: number }> {
    const wallet = await this.getOrCreateWallet(userId);
    return {
      real: wallet.realBalance,
      bonus: wallet.bonusBalance,
      total: wallet.realBalance + wallet.bonusBalance,
    };
  }

  async canAfford(userId: string, amount: number): Promise<boolean> {
    const { total } = await this.getBalance(userId);
    return total >= amount;
  }

  // ============================================================
  // DEPOSITS
  // ============================================================

  async initiateDeposit(userId: string, amount: number, provider: PaymentProvider, phoneOrAddress: string): Promise<{
    transactionId: string;
    reference: string;
    status: string;
    message: string;
  }> {
    if (amount < MIN_DEPOSIT) throw new BadRequestException(`Minimum deposit is ${MIN_DEPOSIT} RWF`);
    if (amount > MAX_DEPOSIT) throw new BadRequestException(`Maximum deposit is ${MAX_DEPOSIT} RWF`);

    const txId = uuid();
    const reference = `DEP-${Date.now()}-${txId.slice(0, 8).toUpperCase()}`;

    // Save pending transaction
    await this.txRepo.save({
      id: txId,
      walletId: (await this.getOrCreateWallet(userId)).id,
      userId,
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.PENDING,
      provider,
      amount,
      fee: this.calculateFee(amount, provider),
      net: amount,
      reference,
      metadata: { phoneOrAddress },
      createdAt: new Date(),
    });

    // Call provider
    try {
      let providerResult: { success: boolean; providerRef: string };
      switch (provider) {
        case PaymentProvider.MTN_MOMO:
          providerResult = await this.mtnMomo.requestPayment(phoneOrAddress, amount, reference);
          break;
        case PaymentProvider.AIRTEL_MONEY:
          providerResult = await this.airtel.requestPayment(phoneOrAddress, amount, reference);
          break;
        case PaymentProvider.USDT:
          providerResult = await this.usdt.createDepositAddress(userId, amount, reference);
          break;
        default:
          throw new BadRequestException('Unsupported provider');
      }

      await this.txRepo.update(txId, { metadata: { phoneOrAddress, providerRef: providerResult.providerRef } });

      return {
        transactionId: txId,
        reference,
        status: 'PENDING',
        message: provider === PaymentProvider.USDT
          ? `Send ${amount} RWF worth of USDT to ${providerResult.providerRef}`
          : `Check your phone (${phoneOrAddress}) to approve the payment`,
      };
    } catch (err) {
      await this.txRepo.update(txId, { status: TransactionStatus.FAILED });
      throw err;
    }
  }

  // Called by payment provider webhook
  async confirmDeposit(reference: string, providerRef: string): Promise<void> {
    const tx = await this.txRepo.findOne({ where: { reference } });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.status !== TransactionStatus.PENDING) return; // Already processed

    await this.dataSource.transaction(async (manager) => {
      await manager.update(TransactionEntity, tx.id, {
        status: TransactionStatus.COMPLETED,
        completedAt: new Date(),
        metadata: { ...tx.metadata as object, providerRef },
      });
      await manager.increment(WalletEntity, { userId: tx.userId }, 'realBalance', tx.net);
      await manager.update(WalletEntity, { userId: tx.userId }, { updatedAt: new Date() });
    });

    this.logger.log(`Deposit confirmed: user=${tx.userId} amount=${tx.net} ref=${reference}`);
    await this.redis.publish('umukino:payment-events', JSON.stringify({
      event: 'payment.confirmed',
      userId: tx.userId,
      data: { type: 'deposit', amount: tx.net, reference },
    }));
  }

  // ============================================================
  // WITHDRAWALS
  // ============================================================

  async initiateWithdrawal(userId: string, amount: number, provider: PaymentProvider, phoneOrAddress: string): Promise<{
    transactionId: string;
    reference: string;
  }> {
    if (amount < MIN_WITHDRAW) throw new BadRequestException(`Minimum withdrawal is ${MIN_WITHDRAW} RWF`);
    if (amount > MAX_WITHDRAW) throw new BadRequestException(`Maximum withdrawal is ${MAX_WITHDRAW} RWF`);

    const wallet = await this.getOrCreateWallet(userId);
    const fee = this.calculateFee(amount, provider);
    const total = amount + fee;

    if (wallet.realBalance < total) throw new BadRequestException('Insufficient balance (including fees)');

    const txId = uuid();
    const reference = `WIT-${Date.now()}-${txId.slice(0, 8).toUpperCase()}`;

    await this.dataSource.transaction(async (manager) => {
      // Reserve funds immediately
      await manager.decrement(WalletEntity, { userId }, 'realBalance', total);
      await manager.save(TransactionEntity, {
        id: txId,
        walletId: wallet.id,
        userId,
        type: TransactionType.WITHDRAWAL,
        status: TransactionStatus.PENDING,
        provider,
        amount,
        fee,
        net: amount,
        reference,
        metadata: { phoneOrAddress },
        createdAt: new Date(),
      });
    });

    // Initiate payout with provider
    try {
      switch (provider) {
        case PaymentProvider.MTN_MOMO:
          await this.mtnMomo.sendPayment(phoneOrAddress, amount, reference);
          break;
        case PaymentProvider.AIRTEL_MONEY:
          await this.airtel.sendPayment(phoneOrAddress, amount, reference);
          break;
        case PaymentProvider.USDT:
          await this.usdt.sendPayment(phoneOrAddress, amount, reference);
          break;
      }
      await this.txRepo.update(txId, { status: TransactionStatus.COMPLETED, completedAt: new Date() });
    } catch (err) {
      // Reverse the deduction on failure
      await this.dataSource.transaction(async (manager) => {
        await manager.increment(WalletEntity, { userId }, 'realBalance', total);
        await manager.update(TransactionEntity, txId, { status: TransactionStatus.FAILED });
      });
      throw new BadRequestException('Withdrawal failed: ' + err.message);
    }

    return { transactionId: txId, reference };
  }

  // ============================================================
  // GAME ENTRY / PRIZE (called internally by room service)
  // ============================================================

  async deductEntryFee(userId: string, amount: number, roomId: string): Promise<void> {
    const wallet = await this.getOrCreateWallet(userId);
    if (wallet.realBalance + wallet.bonusBalance < amount) {
      throw new ForbiddenException(`Insufficient balance for entry fee of ${amount} RWF`);
    }

    // Use bonus first, then real
    let fromBonus = Math.min(wallet.bonusBalance, amount);
    let fromReal = amount - fromBonus;

    await this.dataSource.transaction(async (manager) => {
      if (fromBonus > 0) await manager.decrement(WalletEntity, { userId }, 'bonusBalance', fromBonus);
      if (fromReal > 0) await manager.decrement(WalletEntity, { userId }, 'realBalance', fromReal);
      await manager.save(TransactionEntity, {
        id: uuid(),
        walletId: wallet.id,
        userId,
        type: TransactionType.GAME_ENTRY,
        status: TransactionStatus.COMPLETED,
        provider: PaymentProvider.INTERNAL,
        amount,
        fee: 0,
        net: amount,
        reference: `ENTRY-${roomId}-${Date.now()}`,
        gameId: roomId,
        metadata: { fromBonus, fromReal },
        createdAt: new Date(),
        completedAt: new Date(),
      });
    });
  }

  async refundEntryFee(userId: string, amount: number, roomId: string): Promise<void> {
    const wallet = await this.getOrCreateWallet(userId);
    await this.dataSource.transaction(async (manager) => {
      await manager.increment(WalletEntity, { userId }, 'realBalance', amount);
      await manager.save(TransactionEntity, {
        id: uuid(),
        walletId: wallet.id,
        userId,
        type: TransactionType.GAME_ENTRY,
        status: TransactionStatus.REVERSED,
        provider: PaymentProvider.INTERNAL,
        amount,
        fee: 0,
        net: amount,
        reference: `REFUND-${roomId}-${Date.now()}`,
        gameId: roomId,
        metadata: { reason: 'room_closed_before_start' },
        createdAt: new Date(),
        completedAt: new Date(),
      });
    });
  }

  async creditPrize(userId: string, amount: number, roomId: string): Promise<void> {
    const wallet = await this.getOrCreateWallet(userId);
    await this.dataSource.transaction(async (manager) => {
      await manager.increment(WalletEntity, { userId }, 'realBalance', amount);
      await manager.update(WalletEntity, { userId }, { updatedAt: new Date() });
      await manager.save(TransactionEntity, {
        id: uuid(),
        walletId: wallet.id,
        userId,
        type: TransactionType.GAME_PAYOUT,
        status: TransactionStatus.COMPLETED,
        provider: PaymentProvider.INTERNAL,
        amount,
        fee: 0,
        net: amount,
        reference: `PRIZE-${roomId}-${Date.now()}`,
        gameId: roomId,
        metadata: { roomId },
        createdAt: new Date(),
        completedAt: new Date(),
      });
    });

    this.logger.log(`Prize credited: user=${userId} amount=${amount} room=${roomId}`);
    await this.redis.publish('umukino:payment-events', JSON.stringify({
      event: 'wallet.updated',
      userId,
      data: { type: 'prize', amount, roomId },
    }));
  }

  // ============================================================
  // HISTORY
  // ============================================================

  async getTransactions(userId: string, page = 1, limit = 20): Promise<{ data: TransactionEntity[]; total: number }> {
    const [data, total] = await this.txRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private calculateFee(amount: number, provider: PaymentProvider): number {
    switch (provider) {
      case PaymentProvider.MTN_MOMO: return Math.max(100, Math.floor(amount * 0.01)); // 1%, min 100 RWF
      case PaymentProvider.AIRTEL_MONEY: return Math.max(100, Math.floor(amount * 0.01));
      case PaymentProvider.USDT: return Math.max(500, Math.floor(amount * 0.02)); // 2%, min 500 RWF
      default: return 0;
    }
  }
}


