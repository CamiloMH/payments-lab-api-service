import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { DemoSession } from '../session/entities/demo-session.entity';
import { CurrentSession } from '../session/session.decorator';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.schema';
import { CartItemResponse } from './dto/cart-item.response';
import { CartResponse } from './dto/cart.response';
import { SetCartItemQuantityDto } from './dto/set-cart-item-quantity.schema';

/**
 * Carrito server-side de la sesión: es el input directo del checkout, así
 * que cada mutación valida contra el catálogo real antes de aplicarse.
 */
@ApiTags('cart')
@Controller({ path: 'cart', version: '1' })
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({
    summary: 'Carrito activo de la sesión',
    description:
      'Devuelve el carrito `active` de la sesión, creando uno vacío si todavía no existe.',
  })
  @ApiResponse({
    status: 200,
    description: 'Carrito activo (nuevo o existente).',
    type: CartResponse,
  })
  async getCart(@CurrentSession() session: DemoSession): Promise<CartResponse> {
    return CartResponse.from(await this.cartService.getActiveCart(session.id));
  }

  @Post('items')
  @ApiOperation({
    summary: 'Agrega un producto al carrito',
    description:
      'Suma `quantity` al ítem si el producto ya estaba en el carrito, o crea uno nuevo.',
  })
  @ApiResponse({ status: 201, description: 'Ítem agregado o actualizado.', type: CartItemResponse })
  @ApiResponse({ status: 400, description: 'La cantidad no es un entero positivo.' })
  @ApiResponse({ status: 404, description: 'El producto no existe en el catálogo.' })
  async addItem(
    @CurrentSession() session: DemoSession,
    @Body() dto: AddCartItemDto,
  ): Promise<CartItemResponse> {
    const item = await this.cartService.addItem(session.id, dto.productId, dto.quantity);
    return CartItemResponse.from(item);
  }

  @Patch('items/:productId')
  @ApiOperation({
    summary: 'Fija la cantidad de un ítem',
    description:
      'Reemplaza la cantidad exacta del ítem. Enviar `quantity: 0` lo elimina del carrito.',
  })
  @ApiParam({ name: 'productId', description: 'Id del producto cuyo ítem se actualiza.' })
  @ApiResponse({
    status: 200,
    description: 'Ítem actualizado, o `null` si la cantidad enviada fue 0 (se eliminó).',
    type: CartItemResponse,
  })
  @ApiResponse({ status: 404, description: 'El producto no está en el carrito.' })
  async setItemQuantity(
    @CurrentSession() session: DemoSession,
    @Param('productId') productId: string,
    @Body() dto: SetCartItemQuantityDto,
  ): Promise<CartItemResponse | null> {
    const item = await this.cartService.setItemQuantity(session.id, productId, dto.quantity);
    return item ? CartItemResponse.from(item) : null;
  }

  @Delete('items/:productId')
  @ApiOperation({ summary: 'Quita un producto del carrito' })
  @ApiParam({ name: 'productId', description: 'Id del producto a quitar.' })
  @ApiResponse({ status: 200, description: 'Ítem eliminado.' })
  @ApiResponse({ status: 404, description: 'El producto no está en el carrito.' })
  removeItem(
    @CurrentSession() session: DemoSession,
    @Param('productId') productId: string,
  ): Promise<void> {
    return this.cartService.removeItem(session.id, productId);
  }
}
