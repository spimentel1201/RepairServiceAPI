import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  HttpCode,
  HttpStatus,
  Query,
  ForbiddenException
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { UserResponseDto } from './dto/user-response.dto';

/**
 * UsersController - Controlador para la gestión de usuarios
 * 
 * Este controlador maneja todas las operaciones CRUD relacionadas con usuarios:
 * - Creación de usuarios
 * - Obtención de usuarios (individual o lista)
 * - Actualización de usuarios
 * - Desactivación de usuarios
 * - Cambio de contraseña
 * 
 * Todas las rutas están protegidas por defecto por los guards globales
 * (JwtAuthGuard + RolesGuard registrados en AppModule); @Roles define el
 * permiso requerido en cada endpoint.
 */
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Crea un nuevo usuario
   * @param createUserDto - Datos del usuario a crear
   * @returns Usuario creado
   * @access Solo administradores
   */
  @Post()
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(createUserDto);
  }

  /**
   * Obtiene todos los usuarios
   * @returns Lista de usuarios
   * @access Solo administradores
   */
  @Get()
  @Roles(Role.ADMIN)
  findAll(): Promise<UserResponseDto[]> {
    return this.usersService.findAll();
  }

  /**
   * Obtiene un usuario por su ID
   * @param id - ID del usuario
   * @returns Usuario encontrado
   * @access Solo administradores
   */
  @Get(':id')
  @Roles(Role.ADMIN)
  findOne(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  /**
   * Actualiza un usuario existente
   * @param id - ID del usuario a actualizar
   * @param updateUserDto - Datos a actualizar
   * @returns Usuario actualizado
   * @access Solo administradores
   */
  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    return this.usersService.update(id, updateUserDto);
  }

  /**
   * Desactiva un usuario (eliminación lógica)
   * @param id - ID del usuario a desactivar
   * @returns Mensaje de confirmación
   * @access Solo administradores
   */
  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.usersService.remove(id);
  }

  /**
   * Cambia la contraseña de un usuario
   * @param id - ID del usuario
   * @param changePasswordDto - Contraseña actual (si aplica) y nueva contraseña
   * @param currentUser - Usuario autenticado que realiza la petición
   * @returns Mensaje de confirmación
   * @access El propio usuario (debe enviar su contraseña actual)
   *         o un administrador (puede resetear sin conocerla)
   */
  @Post(':id/change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(
    @Param('id') id: string,
    @Body() changePasswordDto: ChangePasswordDto,
    @CurrentUser() currentUser: { id: string; role: Role },
  ): Promise<{ message: string }> {
    const isSelf = currentUser?.id === id;
    const isAdmin = currentUser?.role === Role.ADMIN;

    if (!isSelf && !isAdmin) {
      throw new ForbiddenException(
        'No tienes permiso para cambiar la contraseña de este usuario',
      );
    }

    return this.usersService.changePassword(id, changePasswordDto, {
      // Solo el dueño del cuenta debe demostrar la contraseña actual.
      requireCurrentPassword: isSelf,
    });
  }
}