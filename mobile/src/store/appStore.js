import { create } from 'zustand';

export const useAppStore = create((set) => ({
  updateRequired: false,
  setUpdateRequired: () => set({ updateRequired: true }),

  // ── Badge de chats no leídos ───────────────────────────────────────────────
  // Set de IDs (chat o grupo) que tienen al menos un mensaje sin leer.
  // unreadChatsCount se deriva de su tamaño para que no haya doble-conteo.
  _unreadChatIds:   new Set(),
  unreadChatsCount: 0,

  addUnreadChatId: (id) => set(state => {
    if (!id || state._unreadChatIds.has(id)) return state;
    const next = new Set(state._unreadChatIds);
    next.add(id);
    return { _unreadChatIds: next, unreadChatsCount: next.size };
  }),

  markChatRead: (id) => set(state => {
    if (!id || !state._unreadChatIds.has(id)) return state;
    const next = new Set(state._unreadChatIds);
    next.delete(id);
    return { _unreadChatIds: next, unreadChatsCount: next.size };
  }),

  // Llamado desde ChatsScreen cuando carga la lista completa — fuente de verdad.
  resetUnreadFromIds: (ids) => set(() => {
    const next = new Set(ids.filter(Boolean));
    return { _unreadChatIds: next, unreadChatsCount: next.size };
  }),
}));
