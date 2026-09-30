import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../rbac/guards/roles.guard';
import { RequireRoles } from '../rbac/decorators/require-roles.decorator';
import { ConvertSettingsService } from './convert-settings.service';
import { UpdateConvertSettingsDto } from './dto/update-convert-settings.dto';

@Controller('admin/convert')
@UseGuards(RolesGuard)
@RequireRoles('admin')
export class AdminConvertController {
  constructor(private readonly settings: ConvertSettingsService) {}

  @Get('settings')
  getSettings() {
    return this.settings.getAll();
  }

  @Put('settings')
  updateSettings(@Body() dto: UpdateConvertSettingsDto) {
    return this.settings.updateMaxBytes(dto);
  }
}
