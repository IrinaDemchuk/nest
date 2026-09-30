import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { RequireRoles } from '../rbac/decorators/require-roles.decorator';
import { RolesGuard } from '../rbac/guards/roles.guard';
import { UpdateTransformationSettingsDto } from './dto/update-transformation-settings.dto';
import { TransformationSettingsService } from './transformation-settings.service';

@Controller('admin/transformations')
@UseGuards(RolesGuard)
@RequireRoles('admin')
export class AdminTransformationSettingsController {
  constructor(private readonly settings: TransformationSettingsService) {}

  @Get('settings')
  getSettings() {
    return this.settings.getAll();
  }

  @Put('settings')
  updateSettings(@Body() dto: UpdateTransformationSettingsDto) {
    return this.settings.updateRetentionDays(dto.retentionDays);
  }
}
