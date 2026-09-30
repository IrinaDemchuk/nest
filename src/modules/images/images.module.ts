import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@/core/throttler/throttler.module';
import { StorageModule } from '@/modules/storage/storage.module';
import { AdminImagesController } from './admin-images.controller';
import { ImageSettingsService } from './image-settings.service';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';

@Module({
  imports: [ThrottlerModule, StorageModule],
  controllers: [ImagesController, AdminImagesController],
  providers: [ImageSettingsService, ImagesService],
  exports: [ImageSettingsService, ImagesService],
})
export class ImagesModule {}
