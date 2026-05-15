import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('rooms')
export class RoomEntity {
  @PrimaryColumn('uuid') id: string;
  @Column({ unique: true }) code: string;
  @Column({ name: 'host_id' }) hostId: string;
  @Column() name: string;
  @Column({ default: 'LOBBY' }) status: string;
  @Column({ type: 'bigint', default: 0, name: 'entry_fee_rwf' }) entryFeeRwf: number;
  @Column({ default: 4, name: 'max_players' }) maxPlayers: number;
  @Column({ default: false, name: 'is_private' }) isPrivate: boolean;
  @Column({ type: 'bigint', default: 0, name: 'prize_pool' }) prizePool: number;
  @Column({ default: false, name: 'prize_distributed' }) prizeDistributed: boolean;
  @Column({ type: 'jsonb', default: '{}' }) settings: object;
  @Column({ nullable: true, name: 'game_id' }) gameId?: string;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }) updatedAt: Date;
}
