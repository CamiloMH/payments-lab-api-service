import { Module } from '@nestjs/common';

import { RealtimeGateway } from './realtime.gateway';

/**
 * Superficie WebSocket de la API, event-driven. Escucha los eventos de dominio
 * (`AppEvent.*`) y los traduce a push por socket.io. No exporta nada: ningún
 * otro módulo lo inyecta, solo emite eventos que este gateway consume.
 */
@Module({
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
