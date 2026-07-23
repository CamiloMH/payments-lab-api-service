import { Controller, Get, Version, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  type HealthCheckResult,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

/**
 * Healthcheck usado por docker-compose y Caddy. `VERSION_NEUTRAL` evita que el
 * versionado global le anteponga `/v1`; Docker/Caddy pegan a `/healthz` a secas.
 */
@ApiTags('health')
@Controller('healthz')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @Version(VERSION_NEUTRAL)
  @HealthCheck()
  @ApiOperation({ summary: 'Estado del servicio y de la base de datos' })
  @ApiResponse({ status: 200, description: 'El servicio y la base de datos están operativos.' })
  @ApiResponse({ status: 503, description: 'La base de datos no responde.' })
  check(): Promise<HealthCheckResult> {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
