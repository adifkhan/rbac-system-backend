import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto, UpdateUserPermissionsDto } from './dto/user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permission } from '../common/decorators/permission.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @Permission('users:create')
  create(@Body() createUserDto: CreateUserDto, @Req() req) {
    return this.userService.create(createUserDto, req.user.id);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permission('users:view')
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permission('users:view')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Permission('users:update')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Post(':id/suspend')
  @UseGuards(PermissionGuard)
  @Permission('users:update')
  suspend(@Param('id') id: string) {
    return this.userService.suspend(id);
  }

  @Post(':id/ban')
  @UseGuards(PermissionGuard)
  @Permission('users:update')
  ban(@Param('id') id: string) {
    return this.userService.ban(id);
  }

  @Post(':id/permissions')
  @UseGuards(PermissionGuard)
  @Permission('users:update')
  updatePermissions(
    @Param('id') id: string,
    @Body() updatePermissionsDto: UpdateUserPermissionsDto,
    @Req() req,
  ) {
    return this.userService.updatePermissions(id, updatePermissionsDto, req.user.id);
  }
}