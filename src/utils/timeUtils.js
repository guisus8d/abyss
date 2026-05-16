export const getActivityStatus = (lastActive) => {
  if (!lastActive) return { text: 'Activo ahora', isOnline: true };

  const diff = Math.floor((Date.now() - new Date(lastActive)) / 1000);

  if (diff < 300)    return { text: 'Activo ahora',                              isOnline: true  };
  if (diff < 600)    return { text: 'Activo hace 5 minutos',                     isOnline: true  };
  if (diff < 1800)   return { text: 'Activo hace 15 minutos',                    isOnline: true  };
  if (diff < 3600)   return { text: 'Activo hace 1 hora',                        isOnline: true  };
  if (diff < 7200)   return { text: 'Activo hace 2 horas',                       isOnline: false };
  if (diff < 21600)  return { text: `Activo hace ${Math.floor(diff/3600)} horas`, isOnline: false };
  if (diff < 86400)  return { text: 'Activo hoy',                                isOnline: false };
  if (diff < 172800) return { text: 'Activo ayer',                               isOnline: false };
  if (diff < 604800) return { text: `Activo hace ${Math.floor(diff/86400)} días`, isOnline: false };
  if (diff < 1209600) return { text: 'Activo hace 1 semana',                     isOnline: false };
  return { text: 'Activo hace mucho tiempo', isOnline: false };
};
