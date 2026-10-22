import { createContext, useContext } from 'react';

// Quién está adentro y su configuración (valor de la hora, luz y gas, margen buscado)
export const StoreContext = createContext(null);
export const useStore = () => useContext(StoreContext);
