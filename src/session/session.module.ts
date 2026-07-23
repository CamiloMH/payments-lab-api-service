import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DemoSession } from './entities/demo-session.entity';
import { DemoSessionRepository } from './repositories/demo-session.repository';
import { SessionController } from './session.controller';
import { SessionMiddleware } from './session.middleware';
import { SessionService } from './session.service';

const ALL_ROUTES = '{*splat}';

/** Sesión anónima: entidad, servicio y middleware que la resuelve en cada request. */
@Module({
  imports: [TypeOrmModule.forFeature([DemoSession])],
  controllers: [SessionController],
  providers: [SessionService, DemoSessionRepository],
  exports: [SessionService],
})
export class SessionModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessionMiddleware).forRoutes(ALL_ROUTES);
  }
}
