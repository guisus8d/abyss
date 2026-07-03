/**
 * fix_duplicate_chats.js
 * Encuentra chats con el mismo par de participants (en cualquier orden)
 * y fusiona los duplicados en el que tiene más mensajes.
 *
 * USO:
 *   node scripts/fix_duplicate_chats.js           → preview sin modificar nada
 *   node scripts/fix_duplicate_chats.js --confirm → pide YES y ejecuta
 */

require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

// ── helpers ──────────────────────────────────────────────────────────────────

function step(msg) {
  process.stdout.write(`  ${msg}… `);
}
function ok(n) {
  console.log(typeof n === 'number' ? `${n} docs` : 'ok');
}

async function askYes(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve, reject) => {
    rl.question(question, ans => {
      rl.close();
      ans.trim() === 'YES' ? resolve() : reject(new Error('cancelled'));
    });
  });
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const confirmed = process.argv.includes('--confirm');

  console.log('\n=== FIX: chats duplicados (mismo par de participants) ===\n');
  console.log('Conectando a MongoDB…');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Conectado\n');

  const Chat = require('../src/models/Chat');

  // ── FASE 1: encontrar duplicados ────────────────────────────────────────────
  // Normaliza el par de participants con $min/$max para que [A,B] == [B,A]

  const groups = await Chat.aggregate([
    {
      $project: {
        _id:          1,
        participants: 1,
        lastMessage:  1,
        createdAt:    1,
        messageCount: { $size: '$messages' },
        lastMsgText:  '$lastMessageText',
        pairKey: {
          $concat: [
            { $toString: { $min: [
              { $toString: { $arrayElemAt: ['$participants', 0] } },
              { $toString: { $arrayElemAt: ['$participants', 1] } },
            ] } },
            '_',
            { $toString: { $max: [
              { $toString: { $arrayElemAt: ['$participants', 0] } },
              { $toString: { $arrayElemAt: ['$participants', 1] } },
            ] } },
          ],
        },
      },
    },
    { $sort: { createdAt: 1 } },
    {
      $group: {
        _id:   '$pairKey',
        chats: { $push: '$$ROOT' },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
  ]);

  if (groups.length === 0) {
    console.log('No se encontraron chats duplicados. Nada que hacer.');
    await mongoose.disconnect();
    return;
  }

  // ── FASE 2: preview ─────────────────────────────────────────────────────────

  let totalDupes    = 0;
  let totalMsgs     = 0;

  const affectedUsers = new Set();
  for (const g of groups) {
    for (const c of g.chats) {
      for (const p of c.participants) affectedUsers.add(p.toString());
    }
  }

  console.log(`Se encontraron ${groups.length} grupo(s) con duplicados:\n`);

  for (const [i, g] of groups.entries()) {
    // keeper = el que tiene más mensajes; desempate por más reciente
    const sorted = [...g.chats].sort((a, b) => {
      if (b.messageCount !== a.messageCount) return b.messageCount - a.messageCount;
      return new Date(b.lastMessage || b.createdAt) - new Date(a.lastMessage || a.createdAt);
    });

    const keeper = sorted[0];
    const dupes  = sorted.slice(1);

    console.log(`── Grupo ${i + 1} (${dupes.length + 1} chats, par: ${g._id}) ──`);
    for (const c of sorted) {
      const isKeeper = c._id.toString() === keeper._id.toString();
      const fecha    = new Date(c.lastMessage || c.createdAt).toISOString().slice(0, 19).replace('T', ' ');
      const tag      = isKeeper ? '[MANTENER]' : '[BORRAR  ]';
      console.log(`  ${tag}  id=${c._id}  mensajes=${c.messageCount}  ultimo=${fecha}`);
    }

    const msgsToMove = dupes.reduce((s, d) => s + d.messageCount, 0);
    console.log(`  → Mensajes a mover: ${msgsToMove}  |  Chats a borrar: ${dupes.length}\n`);

    totalDupes += dupes.length;
    totalMsgs  += msgsToMove;
  }

  console.log('─'.repeat(52));
  console.log('RESUMEN PREVIEW');
  console.log(`  Grupos duplicados  : ${groups.length}`);
  console.log(`  Chats a eliminar   : ${totalDupes}`);
  console.log(`  Mensajes a mover   : ${totalMsgs}`);
  console.log(`  Usuarios afectados : ${affectedUsers.size}`);
  console.log('─'.repeat(52));

  if (!confirmed) {
    console.log('\n⚠️  MODO PREVIEW — no se ha modificado nada.');
    console.log('Para ejecutar, corre:');
    console.log('  node scripts/fix_duplicate_chats.js --confirm\n');
    await mongoose.disconnect();
    return;
  }

  // ── FASE 3: confirmación interactiva ────────────────────────────────────────

  await askYes(
    `\n⚠️  ¿Confirmas ELIMINAR ${totalDupes} chats duplicados y migrar ${totalMsgs} mensajes?\n` +
    `Escribe YES (en mayúsculas) para continuar: `
  );

  console.log('\nEjecutando…\n');

  let deletedCount = 0;
  let movedCount   = 0;

  for (const [i, g] of groups.entries()) {
    const sorted = [...g.chats].sort((a, b) => {
      if (b.messageCount !== a.messageCount) return b.messageCount - a.messageCount;
      return new Date(b.lastMessage || b.createdAt) - new Date(a.lastMessage || a.createdAt);
    });

    const keeper = sorted[0];
    const dupes  = sorted.slice(1);

    for (const dupe of dupes) {
      const fullDupe = await Chat.findById(dupe._id).lean();
      if (!fullDupe) continue;

      const msgs = fullDupe.messages || [];

      // Mover mensajes embebidos al keeper
      if (msgs.length > 0) {
        step(`${i + 1}/${groups.length}  Moviendo ${msgs.length} mensajes de ${dupe._id} → ${keeper._id}`);
        await Chat.updateOne(
          { _id: keeper._id },
          { $push: { messages: { $each: msgs, $sort: { createdAt: 1 } } } },
        );
        ok(msgs.length);
        movedCount += msgs.length;
      }

      // Actualizar lastMessage del keeper si el dupe tenía uno más reciente
      const dupeDate   = new Date(fullDupe.lastMessage || fullDupe.createdAt);
      const keeperDoc  = await Chat.findById(keeper._id).select('lastMessage lastMessageText').lean();
      const keeperDate = new Date(keeperDoc?.lastMessage || 0);
      if (dupeDate > keeperDate && fullDupe.lastMessageText) {
        await Chat.updateOne(
          { _id: keeper._id },
          { $set: { lastMessage: fullDupe.lastMessage, lastMessageText: fullDupe.lastMessageText } },
        );
      }

      // Eliminar el duplicado
      step(`${i + 1}/${groups.length}  Eliminando chat duplicado ${dupe._id}`);
      await Chat.deleteOne({ _id: dupe._id });
      ok(1);
      deletedCount++;
    }
  }

  // ── resumen final ─────────────────────────────────────────────────────────

  console.log('\n✅ Limpieza completada:');
  console.log(`   Grupos procesados  : ${groups.length}`);
  console.log(`   Chats eliminados   : ${deletedCount}`);
  console.log(`   Mensajes migrados  : ${movedCount}`);

  await mongoose.disconnect();
  console.log('\nDesconectado de MongoDB.\n');
}

main().catch(err => {
  if (err.message === 'cancelled') {
    console.log('\nCancelado. No se modificó nada.\n');
    process.exit(0);
  }
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
