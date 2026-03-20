import React, { useState, useRef, createContext, useContext } from "react";
import { useInput } from "ink";
const NavigationContext = createContext(null);
export function useCardNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useCardNavigation must be used within CardNavigator");
  }
  return context;
}
export function CardNavigator({ onExit, children }) {
  const [cardStack, setCardStack] = useState([]);
  const escapeHandledRef = useRef(false);
  const pushCard = (card) => {
    setCardStack((prev) => [...prev, card]);
  };
  const popCard = () => {
    if (cardStack.length > 0) {
      setCardStack((prev) => prev.slice(0, -1));
      return true;
    }
    return false;
  };
  const replaceCard = (card) => {
    if (cardStack.length > 0) {
      setCardStack((prev) => [...prev.slice(0, -1), card]);
    } else {
      setCardStack([card]);
    }
  };
  useInput(
    (input, key) => {
      if (key.escape && !escapeHandledRef.current) {
        escapeHandledRef.current = true;
        setTimeout(() => {
          escapeHandledRef.current = false;
        }, 100);
        const popped = popCard();
        if (!popped && onExit) {
          onExit();
        }
      }
    },
    { isActive: true },
  );
  const contextValue = {
    pushCard,
    popCard,
    replaceCard,
    currentDepth: cardStack.length,
  };
  const currentCard = cardStack[cardStack.length - 1];
  return React.createElement(
    NavigationContext.Provider,
    { value: contextValue },
    currentCard ? currentCard.content : children,
  );
}
//# sourceMappingURL=CardNavigator.js.map
