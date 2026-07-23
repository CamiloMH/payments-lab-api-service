import { Injectable } from '@nestjs/common';
import { ReservationStatus } from '@/domain';
import type { EntityManager } from 'typeorm';

import { StockReservation } from '../entities/stock-reservation.entity';

/**
 * Encapsula el acceso a TypeORM para `StockReservation`. A diferencia de los
 * demás repositorios, todos sus métodos reciben el `EntityManager` de la
 * transacción en curso: `StockReservationService` es el único llamador y
 * siempre opera dentro de `dataSource.transaction(...)`; no existe un modo
 * "suelto" para esta entidad porque cada lectura/escritura debe ser atómica
 * junto con el `Product` que reserva.
 */
@Injectable()
export class StockReservationRepository {
  /** Reservas Active de una orden puntual (usado por `extendExpiry`/`release`/`consume`). */
  findActiveByOrderId(orderId: string, manager: EntityManager): Promise<StockReservation[]> {
    return manager.find(StockReservation, { where: { orderId, status: ReservationStatus.Active } });
  }

  /** Todas las reservas Active del sistema (el sweep filtra en memoria las que ya vencieron). */
  findAllActive(manager: EntityManager): Promise<StockReservation[]> {
    return manager.find(StockReservation, { where: { status: ReservationStatus.Active } });
  }

  saveWithManager(
    reservation: StockReservation,
    manager: EntityManager,
  ): Promise<StockReservation> {
    return manager.save(StockReservation, reservation);
  }
}
