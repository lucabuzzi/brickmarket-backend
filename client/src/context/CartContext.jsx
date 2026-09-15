import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { apiFetch } from '../api';

const CartContext = createContext();
const GUEST_CART_KEY = 'cardbrix_cart';

export function useCart() {
  return useContext(CartContext);
}

function readGuestCart() {
  try {
    const localData = localStorage.getItem(GUEST_CART_KEY);
    return localData ? JSON.parse(localData) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [cart, setCart] = useState(readGuestCart);
  const [cartIsAnimating, setCartIsAnimating] = useState(false);

  // Once true, addToCart/removeFromCart/clearCart talk to the server
  // (POST/DELETE /api/cart) instead of localStorage. Flips to true right
  // after the login-merge below finishes, and back to false on logout.
  const serverModeRef = useRef(false);
  // Guards the merge-on-login effect so it runs once per login, not on
  // every render while `user` stays the same object reference.
  const mergedForUserIdRef = useRef(null);

  // Guest cart (not logged in, or auth not resolved yet) still persists to
  // localStorage exactly as before — this is what lets someone add to cart
  // before logging in, and have it merged into their account on login.
  useEffect(() => {
    if (serverModeRef.current) return;
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
  }, [cart]);

  // On login: fetch the server cart, upload any guest-cart items it doesn't
  // already have (best-effort per item — a since-deleted listing shouldn't
  // block the rest), then switch to server mode and clear the now-migrated
  // guest cart. On logout: drop back to an empty cart (never show one
  // account's items to whoever uses the device next) and re-arm the guard
  // so a different account's login merges correctly too.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      if (serverModeRef.current || mergedForUserIdRef.current !== null) {
        serverModeRef.current = false;
        mergedForUserIdRef.current = null;
        Promise.resolve().then(() => setCart(readGuestCart()));
      }
      return;
    }
    if (mergedForUserIdRef.current === user.id) return;
    mergedForUserIdRef.current = user.id;

    (async () => {
      const guestCart = readGuestCart();
      let serverItems = [];
      try {
        const data = await apiFetch('/api/cart');
        serverItems = Array.isArray(data?.items) ? data.items : [];
      } catch (err) {
        console.error('Error fetching cart:', err);
      }

      const serverIds = new Set(serverItems.map((i) => i.id));
      const toUpload = guestCart.filter((i) => !serverIds.has(i.id));

      if (toUpload.length > 0) {
        await Promise.all(
          toUpload.map((item) =>
            apiFetch('/api/cart', { method: 'POST', body: { listingId: item.id } }).catch((err) => {
              console.error('Error migrating cart item', item.id, err);
            })
          )
        );
        try {
          const data = await apiFetch('/api/cart');
          serverItems = Array.isArray(data?.items) ? data.items : [];
        } catch (err) {
          console.error('Error re-fetching cart after merge:', err);
        }
      }

      serverModeRef.current = true;
      localStorage.removeItem(GUEST_CART_KEY);
      setCart(serverItems);
    })();
  }, [user, authLoading]);

  const triggerAnimation = () => {
    setCartIsAnimating(true);
    setTimeout(() => setCartIsAnimating(false), 300);
  };

  const addToCart = (listing) => {
    if (cart.some((item) => item.id === listing.id)) {
      alert('Questo oggetto è già nel tuo carrello!');
      return false;
    }
    setCart((prev) => [...prev, listing]);
    triggerAnimation();
    if (serverModeRef.current) {
      apiFetch('/api/cart', { method: 'POST', body: { listingId: listing.id } }).catch((err) => {
        console.error('Error adding to cart:', err);
      });
    }
    return true;
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
    if (serverModeRef.current) {
      apiFetch(`/api/cart/${id}`, { method: 'DELETE' }).catch((err) => {
        console.error('Error removing from cart:', err);
      });
    }
  };

  const clearCart = () => {
    setCart([]);
    if (serverModeRef.current) {
      apiFetch('/api/cart', { method: 'DELETE' }).catch((err) => {
        console.error('Error clearing cart:', err);
      });
    }
  };

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, cartIsAnimating }}>
      {children}
    </CartContext.Provider>
  );
}
