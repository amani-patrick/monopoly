import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('wallets')
export class WalletEntity {
  @PrimaryColumn('uuid') id: string;
  @Column({ unique: true, name: 'user_id' }) userId: string;
  @Column({ type: 'bigint', default: 0, name: 'real_balance' }) realBalance: number;
  @Column({ type: 'bigint', default: 0, name: 'bonus_balance' }) bonusBalance: number;
  @Column({ default: 'RWF' }) currency: string;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }) updatedAt: Date;
}

@Entity('transactions')
export class TransactionEntity {
  @PrimaryColumn('uuid') id: string;
  @Column({ name: 'wallet_id' }) walletId: string;
  @Column({ name: 'user_id' }) userId: string;
  @Column() type: string;
  @Column({ default: 'PENDING' }) status: string;
  @Column() provider: string;
  @Column({ type: 'bigint' }) amount: number;
  @Column({ type: 'bigint', default: 0 }) fee: number;
  @Column({ type: 'bigint' }) net: number;
  @Column({ unique: true }) reference: string;
  @Column({ nullable: true, name: 'game_id' }) gameId?: string;
  @Column({ type: 'jsonb', default: '{}' }) metadata: object;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt: Date;
  @Column({ nullable: true, type: 'timestamptz', name: 'completed_at' }) completedAt?: Date;
}

