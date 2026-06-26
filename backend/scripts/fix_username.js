/**
 * fix_username.js — preview/fix de username con caracteres especiales
 *
 * USO:
 *   node scripts/fix_username.js              ← solo muestra, no modifica nada
 *   node scripts/fix_username.js --confirm    ← aplica el cambio
 */

require('dotenv').config();
const mongoose = require('mongoose');

const SEARCH      = 'Monica';
const NEW_USERNAME = 'Monica_abyss';
const CONFIRM     = process.argv.includes('--confirm');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = require('../src/models/User');

  const users = await User.find({ username: { $regex: SEARCH, $options: 'i' } })
    .select('_id username email createdAt')
    .lean();

  if (!users.length) {
    console.log(`\n❌  Ningún usuario encontrado con username que contenga "${SEARCH}"`);
    await mongoose.disconnect();
    return;
  }

  console.log(`\n✅  ${users.length} usuario(s) encontrado(s):\n`);
  for (const u of users) {
    console.log('═'.repeat(56));
    console.log(`  _id      : ${u._id}`);
    console.log(`  username : "${u.username}"`);
    console.log(`  email    : ${u.email}`);
    console.log(`  createdAt: ${u.createdAt}`);
  }
  console.log('═'.repeat(56));

  if (!CONFIRM) {
    console.log(`\n⚠️  MODO PREVIEW — no se modificó nada.`);
    console.log(`   Para aplicar el cambio ejecuta:`);
    console.log(`   node scripts/fix_username.js --confirm\n`);
    await mongoose.disconnect();
    return;
  }

  // Verificar que el nuevo username no esté en uso
  const conflict = await User.findOne({ username: NEW_USERNAME }).lean();
  if (conflict) {
    console.error(`\n❌  El username "${NEW_USERNAME}" ya está en uso por _id ${conflict._id}.`);
    console.error(`   Elige otro nombre y edita NEW_USERNAME en el script.\n`);
    await mongoose.disconnect();
    process.exit(1);
  }

  if (users.length > 1) {
    console.error(`\n❌  Se encontraron ${users.length} usuarios — el script solo puede renombrar uno.`);
    console.error(`   Afina SEARCH para que coincida con un solo usuario.\n`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const target = users[0];
  const result = await User.findByIdAndUpdate(
    target._id,
    { $set: { username: NEW_USERNAME } },
    { new: true }
  ).select('_id username');

  console.log(`\n✅  USERNAME ACTUALIZADO:`);
  console.log(`   Antes : "${target.username}"`);
  console.log(`   Ahora : "${result.username}"`);
  console.log(`   _id   : ${result._id}\n`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
