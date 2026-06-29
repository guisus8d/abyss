import { create } from 'zustand';

export const useCinemaStore = create((set) => ({
  isProyector:         false,
  proyectorGroupId:    null,
  proyectorGroupImage: null,

  setProyector:   (groupId, imageUrl) => set({ isProyector: true, proyectorGroupId: groupId, proyectorGroupImage: imageUrl }),
  clearProyector: ()                  => set({ isProyector: false, proyectorGroupId: null, proyectorGroupImage: null }),
}));
