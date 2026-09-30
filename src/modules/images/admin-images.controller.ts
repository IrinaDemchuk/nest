import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../rbac/guards/roles.guard';
import { RequireRoles } from '../rbac/decorators/require-roles.decorator';
import { ImageSettingsService } from './image-settings.service';
import { UpdateImageSettingsDto } from './dto/update-image-settings.dto';

@Controller('admin/images')
@UseGuards(RolesGuard)
@RequireRoles('admin')
export class AdminImagesController {
  constructor(private readonly settings: ImageSettingsService) {}

  @Get('settings')
  getSettings() {
    return this.settings.getAll();
  }

  @Put('settings')
  updateSettings(@Body() dto: UpdateImageSettingsDto) {
    return this.settings.updateSettings(dto);
  }
}
