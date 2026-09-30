import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@/core/throttler/throttler.module';
import { StorageModule } from '@/modules/storage/storage.module';
import { AdminTransformationSettingsController } from './admin-transformation-settings.controller';
import { AdminTransformationsController } from './admin-transformations.controller';
import { HistoryService } from './history.service';
import { TransformationSettingsService } from './transformation-settings.service';
import { TransformationsController } from './transformations.controller';

@Module({
  imports: [ThrottlerModule, StorageModule],
  controllers: [
    TransformationsController,
    AdminTransformationsController,
    AdminTransformationSettingsController,
  ],
  providers: [TransformationSettingsService, HistoryService],
})
export class TransformationsModule {}
