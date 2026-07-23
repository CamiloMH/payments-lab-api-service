import { Product } from '../products/entities/product.entity';
import { ProductNotFoundException } from '../products/exceptions/product.exceptions';
import { ProductRepository } from '../products/repositories/product.repository';
import { CartItemNotFoundException, InvalidQuantityException } from './exceptions/cart.exceptions';
import { CartItemRepository } from './repositories/cart-item.repository';
import { CartRepository } from './repositories/cart.repository';
import { CartService } from './cart.service';
import { Cart, CartStatus } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';

function mockCartRepo(
  overrides: Partial<Record<keyof CartRepository, jest.Mock>> = {},
): CartRepository {
  return {
    findActiveBySession: jest.fn(),
    create: jest.fn((partial: Partial<Cart>) => partial as Cart),
    save: jest.fn(async (entity: unknown) => entity),
    markCheckedOut: jest.fn(),
    ...overrides,
  } as unknown as CartRepository;
}

function mockCartItemRepo(
  overrides: Partial<Record<keyof CartItemRepository, jest.Mock>> = {},
): CartItemRepository {
  return {
    findByCartAndProduct: jest.fn(),
    create: jest.fn((partial: Partial<CartItem>) => partial as CartItem),
    save: jest.fn(async (entity: unknown) => entity),
    deleteById: jest.fn(),
    ...overrides,
  } as unknown as CartItemRepository;
}

function mockProductRepo(
  overrides: Partial<Record<keyof ProductRepository, jest.Mock>> = {},
): ProductRepository {
  return {
    findById: jest.fn(),
    ...overrides,
  } as unknown as ProductRepository;
}

function buildProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Mouse',
    description: 'x',
    priceClp: 9990,
    stockTotal: 10,
    stockReserved: 0,
    imageUrl: null,
    isSeed: true,
    createdBySessionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as Product;
}

describe('CartService', () => {
  describe('getActiveCart', () => {
    it('crea un carrito activo si la sesión no tiene uno', async () => {
      const carts = mockCartRepo({ findActiveBySession: jest.fn().mockResolvedValue(null) });
      const cartItems = mockCartItemRepo();
      const products = mockProductRepo();
      const service = new CartService(carts, cartItems, products);

      const cart = await service.getActiveCart('session-1');

      expect(carts.create).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'session-1', status: CartStatus.Active }),
      );
      expect(cart.sessionId).toBe('session-1');
    });

    it('reutiliza el carrito activo existente de la sesión', async () => {
      const existing = {
        id: 'cart-1',
        sessionId: 'session-1',
        status: CartStatus.Active,
        items: [],
      } as unknown as Cart;
      const carts = mockCartRepo({ findActiveBySession: jest.fn().mockResolvedValue(existing) });
      const service = new CartService(carts, mockCartItemRepo(), mockProductRepo());

      const cart = await service.getActiveCart('session-1');

      expect(cart).toBe(existing);
      expect(carts.create).not.toHaveBeenCalled();
    });
  });

  describe('addItem', () => {
    it('crea un ítem nuevo si el producto no está en el carrito', async () => {
      const cart = {
        id: 'cart-1',
        sessionId: 'session-1',
        status: CartStatus.Active,
        items: [],
      } as unknown as Cart;
      const carts = mockCartRepo({ findActiveBySession: jest.fn().mockResolvedValue(cart) });
      const cartItems = mockCartItemRepo({
        findByCartAndProduct: jest.fn().mockResolvedValue(null),
      });
      const products = mockProductRepo({ findById: jest.fn().mockResolvedValue(buildProduct()) });
      const service = new CartService(carts, cartItems, products);

      await service.addItem('session-1', 'p1', 2);

      expect(cartItems.create).toHaveBeenCalledWith(
        expect.objectContaining({ cartId: 'cart-1', productId: 'p1', quantity: 2 }),
      );
    });

    it('suma la cantidad si el producto ya estaba en el carrito', async () => {
      const cart = {
        id: 'cart-1',
        sessionId: 'session-1',
        status: CartStatus.Active,
        items: [],
      } as unknown as Cart;
      const carts = mockCartRepo({ findActiveBySession: jest.fn().mockResolvedValue(cart) });
      const existingItem = {
        id: 'item-1',
        cartId: 'cart-1',
        productId: 'p1',
        quantity: 1,
      } as unknown as CartItem;
      const cartItems = mockCartItemRepo({
        findByCartAndProduct: jest.fn().mockResolvedValue(existingItem),
      });
      const products = mockProductRepo({ findById: jest.fn().mockResolvedValue(buildProduct()) });
      const service = new CartService(carts, cartItems, products);

      await service.addItem('session-1', 'p1', 2);

      expect(cartItems.save).toHaveBeenCalledWith(expect.objectContaining({ quantity: 3 }));
    });

    it('lanza NotFoundException si el producto no existe', async () => {
      const cart = {
        id: 'cart-1',
        sessionId: 'session-1',
        status: CartStatus.Active,
        items: [],
      } as unknown as Cart;
      const carts = mockCartRepo({ findActiveBySession: jest.fn().mockResolvedValue(cart) });
      const products = mockProductRepo({ findById: jest.fn().mockResolvedValue(null) });
      const service = new CartService(carts, mockCartItemRepo(), products);

      await expect(service.addItem('session-1', 'missing', 1)).rejects.toThrow(
        ProductNotFoundException,
      );
    });

    it('rechaza cantidades no positivas', async () => {
      const service = new CartService(mockCartRepo(), mockCartItemRepo(), mockProductRepo());

      await expect(service.addItem('session-1', 'p1', 0)).rejects.toThrow(InvalidQuantityException);
    });
  });

  describe('setItemQuantity', () => {
    it('fija la cantidad exacta del ítem', async () => {
      const cart = {
        id: 'cart-1',
        sessionId: 'session-1',
        status: CartStatus.Active,
        items: [],
      } as unknown as Cart;
      const carts = mockCartRepo({ findActiveBySession: jest.fn().mockResolvedValue(cart) });
      const existingItem = {
        id: 'item-1',
        cartId: 'cart-1',
        productId: 'p1',
        quantity: 3,
      } as unknown as CartItem;
      const cartItems = mockCartItemRepo({
        findByCartAndProduct: jest.fn().mockResolvedValue(existingItem),
      });
      const service = new CartService(carts, cartItems, mockProductRepo());

      await service.setItemQuantity('session-1', 'p1', 5);

      expect(cartItems.save).toHaveBeenCalledWith(expect.objectContaining({ quantity: 5 }));
    });

    it('elimina el ítem si la cantidad es 0', async () => {
      const cart = {
        id: 'cart-1',
        sessionId: 'session-1',
        status: CartStatus.Active,
        items: [],
      } as unknown as Cart;
      const carts = mockCartRepo({ findActiveBySession: jest.fn().mockResolvedValue(cart) });
      const existingItem = {
        id: 'item-1',
        cartId: 'cart-1',
        productId: 'p1',
        quantity: 3,
      } as unknown as CartItem;
      const cartItems = mockCartItemRepo({
        findByCartAndProduct: jest.fn().mockResolvedValue(existingItem),
      });
      const service = new CartService(carts, cartItems, mockProductRepo());

      await service.setItemQuantity('session-1', 'p1', 0);

      expect(cartItems.deleteById).toHaveBeenCalledWith('item-1');
    });

    it('lanza NotFoundException si el ítem no existe en el carrito', async () => {
      const cart = {
        id: 'cart-1',
        sessionId: 'session-1',
        status: CartStatus.Active,
        items: [],
      } as unknown as Cart;
      const carts = mockCartRepo({ findActiveBySession: jest.fn().mockResolvedValue(cart) });
      const cartItems = mockCartItemRepo({
        findByCartAndProduct: jest.fn().mockResolvedValue(null),
      });
      const service = new CartService(carts, cartItems, mockProductRepo());

      await expect(service.setItemQuantity('session-1', 'p1', 2)).rejects.toThrow(
        CartItemNotFoundException,
      );
    });
  });

  describe('removeItem', () => {
    it('elimina el ítem del carrito', async () => {
      const cart = {
        id: 'cart-1',
        sessionId: 'session-1',
        status: CartStatus.Active,
        items: [],
      } as unknown as Cart;
      const carts = mockCartRepo({ findActiveBySession: jest.fn().mockResolvedValue(cart) });
      const existingItem = {
        id: 'item-1',
        cartId: 'cart-1',
        productId: 'p1',
        quantity: 1,
      } as unknown as CartItem;
      const cartItems = mockCartItemRepo({
        findByCartAndProduct: jest.fn().mockResolvedValue(existingItem),
      });
      const service = new CartService(carts, cartItems, mockProductRepo());

      await service.removeItem('session-1', 'p1');

      expect(cartItems.deleteById).toHaveBeenCalledWith('item-1');
    });

    it('lanza NotFoundException si el producto no está en el carrito', async () => {
      const cart = {
        id: 'cart-1',
        sessionId: 'session-1',
        status: CartStatus.Active,
        items: [],
      } as unknown as Cart;
      const carts = mockCartRepo({ findActiveBySession: jest.fn().mockResolvedValue(cart) });
      const cartItems = mockCartItemRepo({
        findByCartAndProduct: jest.fn().mockResolvedValue(null),
      });
      const service = new CartService(carts, cartItems, mockProductRepo());

      await expect(service.removeItem('session-1', 'p1')).rejects.toThrow(
        CartItemNotFoundException,
      );
    });
  });

  describe('markCheckedOut', () => {
    it('marca el carrito como CheckedOut', async () => {
      const carts = mockCartRepo();
      const service = new CartService(carts, mockCartItemRepo(), mockProductRepo());

      await service.markCheckedOut('cart-1');

      expect(carts.markCheckedOut).toHaveBeenCalledWith('cart-1');
    });
  });
});
