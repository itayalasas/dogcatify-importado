import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabaseClient } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { logger } from '../utils/datadogLogger';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string | null;
  partnerId: string;
  partnerName: string;
  iva_rate?: number;
  discount_percentage: number;
  original_price: number;
  currency?: string;
  currency_code_dgi?: string;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: CartItem, maxStock?: number) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number, maxStock?: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const { currentUser } = useAuth();

  // Load cart from Supabase when user logs in
  useEffect(() => {
    if (currentUser) {
      loadCart();
    } else {
      setCart([]);
    }
  }, [currentUser]);

  // Save cart to Supabase whenever it changes
  useEffect(() => {
    if (currentUser && cart.length > 0) {
      saveCart();
    }
  }, [cart, currentUser]);

  const loadCart = async () => {
    if (!currentUser) return;

    try {
      logger.debug('Loading cart from Supabase', { userId: currentUser.id });

      // Check if user has a cart
      const { data, error } = await supabaseClient
        .from('user_carts')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Error loading cart', error as Error, { userId: currentUser.id });
        return;
      }

      if (data) {
        logger.info('Cart loaded successfully', { userId: currentUser.id, itemCount: data.items?.length || 0 });
        setCart(data.items || []);
      } else {
        // Create a new cart for the user
        await supabaseClient
          .from('user_carts')
          .insert({
            user_id: currentUser.id,
            items: [],
          });

        logger.info('New cart created', { userId: currentUser.id });
        setCart([]);
      }
    } catch (error) {
      logger.error('Error loading cart from Supabase', error as Error, { userId: currentUser.id });
    }
  };

  const saveCart = async () => {
    if (!currentUser) return;

    try {
      logger.debug('Saving cart to Supabase', { userId: currentUser.id, itemCount: cart.length });

      const { error } = await supabaseClient
        .from('user_carts')
        .upsert({
          user_id: currentUser.id,
          items: cart,
          updated_at: new Date(),
        });

      if (error) {
        logger.error('Error saving cart to Supabase', error as Error, { userId: currentUser.id });
      }
    } catch (error) {
      logger.error('Error saving cart to Supabase', error as Error, { userId: currentUser.id });
    }
  };

  const addToCart = (item: CartItem, maxStock?: number) => {
    logger.info('Adding item to cart', {
      itemId: item.id,
      itemName: item.name,
      quantity: item.quantity,
      price: item.price,
      partnerId: item.partnerId
    });

    setCart(prevCart => {
      // Check if item already exists in cart
      const existingItemIndex = prevCart.findIndex(cartItem => cartItem.id === item.id);

      if (existingItemIndex >= 0) {
        // Update quantity if item exists
        const updatedCart = [...prevCart];
        const newQuantity = updatedCart[existingItemIndex].quantity + item.quantity;

        // Si hay un límite de stock, validarlo
        if (maxStock !== undefined && newQuantity > maxStock) {
          logger.warn('Cannot add item - exceeds stock', {
            itemId: item.id,
            maxStock,
            currentQuantity: updatedCart[existingItemIndex].quantity,
            requestedQuantity: newQuantity
          });
          return prevCart; // No agregar si excede el stock
        }

        logger.debug('Updated cart item quantity', { itemId: item.id, newQuantity });
        updatedCart[existingItemIndex].quantity = newQuantity;
        return updatedCart;
      } else {
        // Add new item if it doesn't exist
        logger.debug('Added new item to cart', { itemId: item.id });
        return [...prevCart, item];
      }
    });
  };

  const removeFromCart = (itemId: string) => {
    logger.info('Removing item from cart', { itemId });
    setCart(prevCart => prevCart.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number, maxStock?: number) => {
    logger.debug('Updating cart item quantity', { itemId, quantity, maxStock });

    // Validar que la cantidad no exceda el stock
    if (maxStock !== undefined && quantity > maxStock) {
      logger.warn('Cannot update quantity - exceeds stock', { itemId, maxStock, requestedQuantity: quantity });
      return;
    }

    setCart(prevCart =>
      prevCart.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = async () => {
    logger.info('Clearing cart', { userId: currentUser?.id, previousItemCount: cart.length });
    setCart([]);

    if (currentUser) {
      try {
        const { error } = await supabaseClient
          .from('user_carts')
          .update({
            items: [],
            updated_at: new Date(),
          })
          .eq('user_id', currentUser.id);

        if (error) {
          logger.error('Error clearing cart in Supabase', error as Error, { userId: currentUser.id });
        }
      } catch (error) {
        logger.error('Error clearing cart in Supabase', error as Error, { userId: currentUser.id });
      }
    }
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getCartCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  return (
    <CartContext.Provider value={{
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getCartTotal,
      getCartCount
    }}>
      {children}
    </CartContext.Provider>
  );
};
