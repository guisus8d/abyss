import { create } from 'zustand';

export const useAppStore = create((set) => ({
  updateRequired: false,
  setUpdateRequired: () => set({ updateRequired: true }),
}));
