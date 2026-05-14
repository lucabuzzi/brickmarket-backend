import { createContext, useContext, useEffect, useState } from 'react';

const CartContext = createContext();

export function useCart() {
  return useContext(CartContext);
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try {
      const localData = localStorage.getItem('brickmarket_cart');
      return localData ? JSON.parse(localData) : [];
    } catch {
      return [];
    }
  });

  const [cartIsAnimating, setCartIsAnimating] = useState(false);

  useEffect(() => {
    localStorage.setItem('brickmarket_cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (listing) => {
    if (cart.some((item) => item.id === listing.id)) {
      alert('Questo oggetto è già nel tuo carrello!');
      return false; // return false for failure
    }
    setCart((prev) => [...prev, listing]);
    triggerAnimation();
    return true; // return true on success
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  const triggerAnimation = () => {
    setCartIsAnimating(true);
    setTimeout(() => {
      setCartIsAnimating(false);
    }, 300);
  };

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, cartIsAnimating }}>
      {children}
    </CartContext.Provider>
  );
}
