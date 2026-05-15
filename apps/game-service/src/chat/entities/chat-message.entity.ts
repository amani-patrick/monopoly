import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'user_id' }) userId: string;
  @Column({ name: 'display_name' }) displayName: string;
  @Column('text') text: string;
  @Column({ type: 'text', nullable: true, name: 'raw_text' }) rawText?: string;
  @Column({ nullable: true, name: 'room_id' }) roomId?: string;
  @Column({ nullable: true, name: 'game_id' }) gameId?: string;
  @Column({ default: false, name: 'had_violation' }) hadViolation: boolean;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt: Date;
}

@Entity('user_bans')
export class UserBan {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'user_id' }) userId: string;
  @Column('text') reason: string;
  @Column({ type: 'timestamptz' }) until: Date;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt: Date;
}
