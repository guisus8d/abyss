export const getActivityStatus = (lastActive) => {
  if (!lastActive) return { text: '', isOnline: false };

  const diff = Math.floor((Date.now() - new Date(lastActive)) / 1000);

  if (diff < 300)    return { text: 'Activo ahora',                          isOnline: true  };
  if (diff < 3600)   return { text: `Hace ${Math.floor(diff / 60)} min`,     isOnline: false };
  if (diff < 86400)  return { text: `Hace ${Math.floor(diff / 3600)}h`,      isOnline: false };
  if (diff < 604800) return { text: `Hace ${Math.floor(diff / 86400)} días`, isOnline: false };
  return { text: '', isOnline: false };
};
