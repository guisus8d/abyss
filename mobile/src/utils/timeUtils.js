export const getActivityStatus = (lastActive) => {
  if (!lastActive) return { text: 'Activo ahora', isOnline: true };

  const diff = Math.floor((Date.now() - new Date(lastActive)) / 1000);

  if (diff < 300)     return { text: 'Activo ahora',                              isOnline: true  };
  if (diff < 600)     return { text: 'Hace 5 min',                                isOnline: true  };
  if (diff < 1800)    return { text: 'Hace 15 min',                               isOnline: true  };
  if (diff < 3600)    return { text: 'Hace 1 hora',                               isOnline: true  };
  if (diff < 7200)    return { text: 'Hace 2 horas',                              isOnline: false };
  if (diff < 21600)   return { text: `Hace ${Math.floor(diff / 3600)}h`,          isOnline: false };
  if (diff < 86400)   return { text: 'Hoy',                                       isOnline: false };
  if (diff < 172800)  return { text: 'Ayer',                                      isOnline: false };
  if (diff < 604800)  return { text: `Hace ${Math.floor(diff / 86400)} días`,     isOnline: false };
  if (diff < 1209600) return { text: 'Hace 1 semana',                             isOnline: false };
  return { text: 'Hace mucho', isOnline: false };
};
