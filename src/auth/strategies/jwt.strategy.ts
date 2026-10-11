import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      return null;
    }

    // Revocación backward-compatible: los tokens emitidos antes de `tokenVersion`
    // no traen `tv` y se aceptan (frontend existente sigue funcionando).
    // Solo se rechaza cuando el token trae `tv` y no coincide con la BD
    // (logout o revocación posterior a su emisión).
    if (payload.tv !== undefined && payload.tv !== (user.tokenVersion ?? 0)) {
      return null;
    }

    // El rol SIEMPRE se lee de la base de datos, nunca del token:
    // así un ADMIN degradado a TECHNICIAN pierde permisos de inmediato,
    // sin esperar a que venza el JWT.
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }
}
