import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
class PlayerResult {
  @Prop({ required: true }) userId: string;
  @Prop({ required: true }) score: number;
  @Prop({ required: true }) rank: number;
  @Prop() avatar: string;
}

@Schema({ collection: 'game_history', timestamps: true })
export class GameHistory extends Document {
  @Prop({ required: true, unique: true })
  gameId: string;

  @Prop({ type: [PlayerResult], required: true })
  players: PlayerResult[];

  @Prop({ required: true })
  winnerId: string;

  @Prop({ required: true })
  durationSeconds: number;

  @Prop({ required: true })
  gameType: string;

  @Prop({ default: Date.now })
  timestamp: Date;
}

export const GameHistorySchema = SchemaFactory.createForClass(GameHistory);
