import { Module } from '@nestjs/common';
import { ConvertSettingsService } from './convert-settings.service';
import { CsvCodec } from './codecs/csv.codec';
import { JsonCodec } from './codecs/json.codec';
import { XmlCodec } from './codecs/xml.codec';
import { YamlCodec } from './codecs/yaml.codec';
import { CodecRegistry, FORMAT_CODECS } from './codecs/codec-registry';
import { StorageModule } from '@/modules/storage/storage.module';
import { ConvertService } from './convert.service';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConvertController } from './convert.controller';
import { AdminConvertController } from './admin-convert.controller';

const codecs = [JsonCodec, CsvCodec, XmlCodec, YamlCodec];

@Module({
  imports: [ThrottlerModule, StorageModule],
  controllers: [ConvertController, AdminConvertController],
  providers: [
    ConvertService,
    ConvertSettingsService,
    ...codecs,
    {
      provide: FORMAT_CODECS,
      useFactory: (
        json: JsonCodec,
        csv: CsvCodec,
        xml: XmlCodec,
        yaml: YamlCodec,
      ) => [json, csv, xml, yaml],
      inject: [JsonCodec, CsvCodec, XmlCodec, YamlCodec],
    },
    CodecRegistry,
  ],
  exports: [ConvertSettingsService, CodecRegistry, ConvertService],
})
export class ConvertModule {}
