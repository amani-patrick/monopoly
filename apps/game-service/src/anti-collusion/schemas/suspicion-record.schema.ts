import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'suspicion_records', timestamps: true })
export class SuspicionRecord extends Document {
  @Prop({ required: true })
  userId: string;

  @Prop()
  targetUserId: string;

  @Prop({ required: true })
  contextId: string;

  @Prop({ required: true })
  type: string;

  @Prop({ type: Object })
  metadata: Record<string, unknown>;

  @Prop({ default: false })
  confirmed: boolean;
}

export const SuspicionRecordSchema = SchemaFactory.createForClass(SuspicionRecord);
