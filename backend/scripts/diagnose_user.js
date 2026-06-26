/**
 * diagnose_user.js  — solo lectura, no modifica nada
 *
 * USO:
 *   node scripts/diagnose_user.js Monica
 */

require('dotenv').config();
const mongoose = require('mongoose');

const SEARCH = process.argv[2];
if (!SEARCH) {
  console.error('Uso: node scripts/diagnose_user.js <username_parcial>');
  process.exit(1);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const User = require('../src/models/User');
  const Post = require('../src/models/Post');

  // ── 1. Buscar por regex case-insensitive ──────────────────────────────────
  const users = await User.find({ username: { $regex: SEARCH, $options: 'i' } })
    .select('-passwordHash')
    .lean();

  if (!users.length) {
    console.log(`\n❌  Ningún usuario encontrado con username que contenga "${SEARCH}"`);
    await mongoose.disconnect();
    return;
  }

  console.log(`\n✅  ${users.length} usuario(s) encontrado(s) con regex /${SEARCH}/i\n`);

  for (const u of users) {
    const postCount = await Post.countDocuments({ author: u._id });

    console.log('═'.repeat(64));
    console.log(`  USERNAME   : ${u.username}`);
    console.log(`  _id        : ${u._id}`);
    console.log(`  email      : ${u.email}`);
    console.log(`  verified   : ${u.emailVerified}`);
    console.log(`  banned     : ${u.banned}  (razón: ${u.bannedReason || '—'})`);
    console.log(`  role       : ${u.role}`);
    console.log('─'.repeat(64));
    console.log(`  avatarUrl  : ${u.avatarUrl ?? '⚠️  NULL/UNDEFINED'}`);
    console.log(`  banner     : ${u.profileBanner || '(vacío)'}`);
    console.log(`  coins      : ${u.coins}`);
    console.log(`  xp         : ${u.xp}`);
    console.log('─'.repeat(64));
    console.log(`  followers  : ${u.followers?.length ?? '⚠️  NULL'}`);
    console.log(`  following  : ${u.following?.length ?? '⚠️  NULL'}`);
    console.log(`  posts (DB) : ${postCount}`);
    console.log('─'.repeat(64));
    console.log(`  createdAt  : ${u.createdAt}`);
    console.log(`  lastActive : ${u.lastActive}`);

    // ── 2. Detectar campos críticos null/undefined ────────────────────────
    const critical = {
      username:      u.username,
      email:         u.email,
      emailVerified: u.emailVerified,
      role:          u.role,
      banned:        u.banned,
      coins:         u.coins,
      xp:            u.xp,
      followers:     u.followers,
      following:     u.following,
      createdAt:     u.createdAt,
    };

    const broken = Object.entries(critical).filter(([, v]) => v === null || v === undefined);
    if (broken.length) {
      console.log('\n⚠️   CAMPOS CRÍTICOS CON VALOR NULL/UNDEFINED:');
      broken.forEach(([k]) => console.log(`    - ${k}`));
    } else {
      console.log('\n  ✅  Campos críticos OK');
    }

    // ── 3. Documento completo (sin passwordHash) ─────────────────────────
    console.log('\n  DOCUMENTO COMPLETO:');
    console.log(JSON.stringify(u, null, 2));
    console.log('═'.repeat(64) + '\n');
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
