import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryColumn('uuid') id: string;
  @Column({ unique: true }) email: string;
  @Column({ nullable: true, name: 'password_hash' }) passwordHash?: string;
  @Column({ nullable: true, unique: true, name: 'google_id' }) googleId?: string;
  @Column({ name: 'display_name' }) displayName: string;
  @Column({ default: 'green' }) avatar: string;
  @Column({ default: 'player' }) role: string;
  @Column({ default: false, name: 'is_verified' }) isVerified: boolean;
  @Column({ default: false, name: 'is_banned' }) isBanned: boolean;
  @Column({ nullable: true, name: 'ban_reason' }) banReason?: string;
  @Column({ nullable: true, name: 'is_shadow_banned' }) isShadowBanned?: boolean;
  @Column({ nullable: true, type: 'timestamptz', name: 'last_login_at' }) lastLoginAt?: Date;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }) updatedAt: Date;
}
