/**
 * remove_welcome_coins.js — resta el bono de bienvenida de 50 coins
 *
 * USO:
 *   node scripts/remove_welcome_coins.js              ← preview, no modifica nada
 *   node scripts/remove_welcome_coins.js --confirm    ← aplica el cambio
 */

require('dotenv').config();
const mongoose = require('mongoose');

const WELCOME_BONUS  = 50;
const ADMIN_USERNAME = 'jesusjm';
const CONFIRM        = process.argv.includes('--confirm');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = require('../src/models/User');

  const filter = {
    coins:    { $gte: WELCOME_BONUS },
    username: { $ne: ADMIN_USERNAME },
  };

  const users = await User.find(filter).select('_id username coins').lean();

  if (!users.length) {
    console.log(`\n❌  Ningún usuario con coins >= ${WELCOME_BONUS} (excluyendo a "${ADMIN_USERNAME}").\n`);
    await mongoose.disconnect();
    return;
  }

  console.log(`\n✅  ${users.length} usuario(s) con coins >= ${WELCOME_BONUS} (excluyendo a "${ADMIN_USERNAME}"):\n`);
  const preview = users.slice(0, 15);
  for (const u of preview) {
    console.log(`  ${u.username.padEnd(24)} coins: ${u.coins}  →  ${Math.max(0, u.coins - WELCOME_BONUS)}`);
  }
  if (users.length > preview.length) {
    console.log(`  ... y ${users.length - preview.length} más`);
  }

  if (!CONFIRM) {
    console.log(`\n⚠️  MODO PREVIEW — no se modificó nada.`);
    console.log(`   Para aplicar el cambio ejecuta:`);
    console.log(`   node scripts/remove_welcome_coins.js --confirm\n`);
    await mongoose.disconnect();
    return;
  }

  const result = await User.updateMany(filter, [
    { $set: { coins: { $max: [0, { $subtract: ['$coins', WELCOME_BONUS] }] } } },
  ]);

  console.log(`\n✅  COINS ACTUALIZADOS:`);
  console.log(`   Usuarios modificados: ${result.modifiedCount}\n`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
