import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('user_bans')
export class UserBan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'admin_id' })
  adminId: string;

  @Column()
  reason: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'expires_at' })
  until: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
