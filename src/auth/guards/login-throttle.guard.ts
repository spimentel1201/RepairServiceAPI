import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ExecutionContext } from '@nestjs/common';

/**
 * LoginThrottlerGuard - Guard para limitar intentos de inicio de sesión
 * 
 * Este guard extiende ThrottlerGuard para implementar limitación de tasa (rate limiting)
 * específicamente en los endpoints de inicio de sesión, ayudando a prevenir ataques
 * de fuerza bruta.
 * 
 * La limitación se aplica por combinación de dirección IP y correo electrónico,
 * lo que permite un control más granular.
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  /**
   * Obtiene el identificador único para el seguimiento de limitación de tasa
   * @param req - Objeto de solicitud HTTP
   * @returns Promesa que resuelve a una cadena única que combina IP y correo electrónico
   */
  protected getTracker(req: Record<string, any>): Promise<string> {
    // Usa la dirección IP y el correo electrónico intentado para el seguimiento
    // Esto hace que el límite de tasa sea específico para cada combinación de IP + correo
    return Promise.resolve(`${req.ip}-${req.body.email}`);
  }

  /**
   * Determina si la solicitud puede activarse o debe ser limitada
   * @param context - Contexto de ejecución de NestJS
   * @returns true si la solicitud puede proceder, false si debe ser limitada
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const isLogin = req.path.includes('/auth/login') && req.method === 'POST';
    
    // Solo aplica limitación de tasa al endpoint de inicio de sesión
    if (isLogin) {
      return super.canActivate(context);
    }
    
    return true;
  }
}