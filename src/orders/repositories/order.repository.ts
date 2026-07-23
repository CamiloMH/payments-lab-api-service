import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderStatus } from '@/domain';
import { LessThan } from 'typeorm';
import type { EntityManager, Repository } from 'typeorm';

import { Order } from '../entities/order.entity';

/** Encapsula el acceso a TypeORM para `Order`. */
@Injectable()
export class OrderRepository {
  constructor(@InjectRepository(Order) private readonly repo: Repository<Order>) {}

  /** Orden por id, sin cargar sus items (usar cuando no se necesita el detalle de líneas). */
  findById(id: string): Promise<Order | null> {
    return this.repo.findOne({ where: { id } });
  }

  /** Orden por id con sus items cargados, o lanza si no existe. */
  findByIdOrFail(id: string): Promise<Order> {
    return this.repo.findOneOrFail({ where: { id } });
  }

  /** Orden por id con sus items y el producto de cada línea (para la imagen y el detalle completo). */
  findByIdWithItems(id: string): Promise<Order | null> {
    return this.repo.findOne({ where: { id }, relations: { items: { product: true } } });
  }

  /** Órdenes de una sesión con sus items y el producto de cada línea, más recientes primero. */
  findBySessionWithItems(sessionId: string): Promise<Order[]> {
    return this.repo.find({
      where: { sessionId },
      relations: { items: { product: true } },
      order: { createdAt: 'DESC' },
    });
  }

  /** Una página de órdenes de la sesión (más recientes primero) con items+producto, junto al total. */
  findBySessionPage(sessionId: string, offset: number, limit: number): Promise<[Order[], number]> {
    return this.repo.findAndCount({
      where: { sessionId },
      relations: { items: { product: true } },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });
  }

  /** Órdenes `pending_payment` cuya reserva ya venció (`expiresAt < now`), candidatas a expirar. */
  findExpirablePendingPayment(now: Date): Promise<Order[]> {
    return this.repo.find({
      where: { status: OrderStatus.PendingPayment, expiresAt: LessThan(now) },
    });
  }

  /**
   * Persiste la orden. Acepta un `manager` opcional para participar en una
   * transacción externa; el checkout guarda la orden y reserva stock en la
   * misma transacción, ya que la FK `stock_reservations → orders` exige que la
   * orden exista antes de insertar sus reservas.
   */
  save(order: Order, manager?: EntityManager): Promise<Order> {
    return manager ? manager.save(Order, order) : this.repo.save(order);
  }
}
