import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'player_stats', timestamps: true })
export class PlayerStats extends Document {
  @Prop({ required: true, unique: true })
  userId: string;

  @Prop({ default: 0 })
  totalGames: number;

  @Prop({ default: 0 })
  wins: number;

  @Prop({ default: 0 })
  losses: number;

  @Prop({ default: 0 })
  totalEarnings: number;

  @Prop({ default: 0 })
  rank: number;

  @Prop({ default: Date.now })
  lastPlayed: Date;
}

export const PlayerStatsSchema = SchemaFactory.createForClass(PlayerStats);
