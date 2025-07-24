import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabaseClient } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string | null;
  partnerId: string;
  partnerName: string;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
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
      // Check if user has a cart
      const { data, error } = await supabaseClient
        .from('user_carts')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error loading cart:', error);
        return;
      }
      
      if (data) {
        setCart(data.items || []);
      } else {
        // Create a new cart for the user
        await supabaseClient
          .from('user_carts')
          .insert({
            user_id: currentUser.id,
            items: [],
          });
        
        setCart([]);
      }
    } catch (error) {
      console.error('Error loading cart from Supabase:', error);
    }
  };

  const saveCart = async () => {
    if (!currentUser) return;
    
    try {
      const { error } = await supabaseClient
        .from('user_carts')
        .upsert({
          user_id: currentUser.id,
          items: cart,
          updated_at: new Date(),
        });
      
      if (error) {
        console.error('Error saving cart to Supabase:', error);
      }
    } catch (error) {
      console.error('Error saving cart to Supabase:', error);
    }
  };

  const addToCart = (item: CartItem) => {
    setCart(prevCart => {
      // Check if item already exists in cart
      const existingItemIndex = prevCart.findIndex(cartItem => cartItem.id === item.id);
      
      if (existingItemIndex >= 0) {
        // Update quantity if item exists
        const updatedCart = [...prevCart];
        updatedCart[existingItemIndex].quantity += item.quantity;
        return updatedCart;
      } else {
        // Add new item if it doesn't exist
        return [...prevCart, item];
      }
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    setCart(prevCart => 
      prevCart.map(item => 
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = async () => {
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
          console.error('Error clearing cart in Supabase:', error);
        }
      } catch (error) {
        console.error('Error clearing cart in Supabase:', error);
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