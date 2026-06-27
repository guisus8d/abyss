import { create } from 'zustand';

export const useCinemaStore = create((set) => ({
  isProyector:    false,
  proyectorGroup: null,   // grupo completo para navegar de vuelta
  screenFocused:  true,   // GroupRoomScreen reporta su estado de foco

  setProyector:     (group) => set({ isProyector: true, proyectorGroup: group, screenFocused: true }),
  setScreenFocused: (v)     => set({ screenFocused: v }),
  clearProyector:   ()      => set({ isProyector: false, proyectorGroup: null, screenFocused: true }),
}));
