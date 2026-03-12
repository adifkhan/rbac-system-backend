import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { PermissionService } from './permission.service';
import { CreatePermissionDto } from './dto/permission.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permission } from '../common/decorators/permission.decorator';

@Controller('permissions')
@UseGuards(JwtAuthGuard)
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @Permission('permissions:create')
  create(@Body() createPermissionDto: CreatePermissionDto) {
    return this.permissionService.create(createPermissionDto);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permission('permissions:view')
  findAll() {
    return this.permissionService.findAll();
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permission('permissions:view')
  findOne(@Param('id') id: string) {
    return this.permissionService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @Permission('permissions:delete')
  remove(@Param('id') id: string) {
    return this.permissionService.remove(id);
  }
}
