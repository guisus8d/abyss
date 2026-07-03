import { create } from 'zustand';

export const useCinemaStore = create((set) => ({
  isProyector:         false,
  proyectorGroupId:    null,
  proyectorGroupImage: null,
  proyectorGroup:      null,

  setProyector:   (group, imageUrl) => set({ isProyector: true, proyectorGroupId: group._id, proyectorGroupImage: imageUrl, proyectorGroup: group }),
  clearProyector: ()                => set({ isProyector: false, proyectorGroupId: null, proyectorGroupImage: null, proyectorGroup: null }),
}));
