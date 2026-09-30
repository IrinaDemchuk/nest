import { Module } from '@nestjs/common';
import { FileStorage } from './file-storage';
import { LocalFileStorage } from './local-file-storage';

@Module({
  providers: [
    LocalFileStorage,
    { provide: FileStorage, useExisting: LocalFileStorage },
  ],
  exports: [FileStorage],
})
export class StorageModule {}
