db = db.getSiblingDB('mvpdb');
db.createUser({
  user: 'mvp_user',
  pwd: 'mvp_password',
  roles: [{ role: 'readWrite', db: 'mvpdb' }]
});
db.createCollection('users');
db.createCollection('posts');
db.createCollection('chats');
db.createCollection('badges');
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.badges.insertMany([
  { name: "Fundador", icon: "🏆", type: "seniority", condition: { members_before: 100 } },
  { name: "Participante", icon: "✍️", type: "participation", condition: { posts_required: 1 } },
  { name: "Activo", icon: "🔥", type: "participation", condition: { posts_required: 10 } }
]);
print('✅ MongoDB inicializado');
