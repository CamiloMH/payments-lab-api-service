import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Product } from '../products/entities/product.entity';
import { ProductRepository } from '../products/repositories/product.repository';
import { CartItemRepository } from './repositories/cart-item.repository';
import { CartController } from './cart.controller';
import { CartRepository } from './repositories/cart.repository';
import { CartService } from './cart.service';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Cart, CartItem, Product])],
  controllers: [CartController],
  providers: [CartService, CartRepository, CartItemRepository, ProductRepository],
  exports: [CartService],
})
export class CartModule {}
