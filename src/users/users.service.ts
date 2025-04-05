import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import * as bcrypt from 'bcrypt';

/**
 * UsersService - Servicio para la gestión de usuarios
 * 
 * Este servicio implementa la lógica de negocio para:
 * - Crear usuarios
 * - Buscar usuarios (por ID o email)
 * - Actualizar usuarios
 * - Desactivar usuarios (eliminación lógica)
 * - Cambiar contraseñas
 * 
 * Utiliza PrismaService para interactuar con la base de datos
 * y bcrypt para el manejo seguro de contraseñas.
 */
@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crea un nuevo usuario
   * @param createUserDto - Datos del usuario a crear
   * @returns Usuario creado (sin contraseña)
   * @throws ConflictException si el email ya está en uso
   */
  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    // Verifica si el usuario con ese email ya existe
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
        profileImage: createUserDto.profileImage || '',
      },
    });

    return new UserResponseDto(user);
  }

  /**
   * Obtiene todos los usuarios
   * @returns Lista de usuarios (sin contraseñas)
   */
  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.prisma.user.findMany();
    return users.map(user => new UserResponseDto(user));
  }

  /**
   * Busca un usuario por su ID
   * @param id - ID del usuario
   * @returns Usuario encontrado (sin contraseña)
   * @throws NotFoundException si el usuario no existe
   */
  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return new UserResponseDto(user);
  }

  /**
   * Busca un usuario por su email
   * @param email - Email del usuario
   * @returns Usuario completo o null si no existe
   */
  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    return user;
  }

  /**
   * Actualiza un usuario existente
   * @param id - ID del usuario a actualizar
   * @param updateUserDto - Datos a actualizar
   * @returns Usuario actualizado (sin contraseña)
   * @throws NotFoundException si el usuario no existe
   * @throws ConflictException si el nuevo email ya está en uso
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    // Verifica si el usuario existe
    await this.findOne(id);

    // Si se actualiza el email, verifica que no esté en uso
    if (updateUserDto.email) {
      const userWithEmail = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });

      if (userWithEmail && userWithEmail.id !== id) {
        throw new ConflictException('Email already in use');
      }
    }

    // Si se actualiza la contraseña, la encripta
    let data = { ...updateUserDto };
    if (updateUserDto.password) {
      data.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data,
    });

    return new UserResponseDto(updatedUser);
  }

  /**
   * Desactiva un usuario (eliminación lógica)
   * @param id - ID del usuario a desactivar
   * @returns Mensaje de confirmación
   * @throws NotFoundException si el usuario no existe
   * @throws BadRequestException si ocurre un error al desactivar
   */
  async remove(id: string): Promise<{ message: string }> {
    // Verifica si el usuario existe
    await this.findOne(id);

    try {
      await this.prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
      return { message: 'User deactivated successfully' };
    } catch (error) {
      throw new BadRequestException('Cannot deactivate user.');
    }
  }

  /**
   * Cambia la contraseña de un usuario
   * @param id - ID del usuario
   * @param currentPassword - Contraseña actual
   * @param newPassword - Nueva contraseña
   * @returns Mensaje de confirmación
   * @throws NotFoundException si el usuario no existe
   * @throws BadRequestException si la contraseña actual es incorrecta
   */
  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    return { message: 'Password changed successfully' };
  }
}