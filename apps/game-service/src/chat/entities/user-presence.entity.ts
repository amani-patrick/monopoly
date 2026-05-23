import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('user_presences')
@Index(['userId', 'roomId'])
@Index(['userId', 'gameId'])
export class UserPresence {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: string;

  @Column()
  displayName: string;

  @Column({ type: 'enum', enum: ['online', 'idle', 'offline'], default: 'offline' })
  status: 'online' | 'idle' | 'offline';

  @Column({ nullable: true })
  roomId?: string;

  @Column({ nullable: true })
  gameId?: string;

  @Column({ type: 'timestamp', nullable: true })
  lastSeen?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
