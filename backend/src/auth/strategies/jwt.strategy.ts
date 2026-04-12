import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  email: string;
  displayName: string;
  roles: Array<{ code: string; councilId: string | null }>;
  clearanceLevel: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'changeme'),
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return payload;
  }
}
