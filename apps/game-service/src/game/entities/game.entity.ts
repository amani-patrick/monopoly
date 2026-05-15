import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('game_records')
export class GameRecord {
  @PrimaryColumn() id: string;
  @Column({ nullable: true, name: 'room_id' }) roomId?: string;
  @Column({ default: 'ACTIVE' }) status: string;
  @Column({ type: 'simple-array', name: 'player_ids' }) playerIds: string[];
  @Column({ nullable: true, name: 'winner_id' }) winnerId?: string;
  @Column({ type: 'jsonb', default: '{}' }) settings: object;
  @Column({ nullable: true, type: 'timestamptz', name: 'started_at' }) startedAt?: Date;
  @Column({ nullable: true, type: 'timestamptz', name: 'finished_at' }) finishedAt?: Date;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt: Date;
}
