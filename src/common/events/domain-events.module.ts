import { Global, Module } from '@nestjs/common';

import { DomainEventPublisher } from './domain-event.publisher';

/**
 * Expone `DomainEventPublisher` de forma global para que cualquier servicio
 * pueda publicar eventos de dominio sin re-declararlo. `EventEmitterModule`
 * (registrado en `AppModule`) provee el `EventEmitter2` que envuelve.
 */
@Global()
@Module({
  providers: [DomainEventPublisher],
  exports: [DomainEventPublisher],
})
export class DomainEventsModule {}
