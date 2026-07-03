#!/usr/bin/env node
/**
 * fix_duplicate_chats.js
 *
 * Preview:  node scripts/fix_duplicate_chats.js
 * Confirm:  node scripts/fix_duplicate_chats.js --confirm
 *
 * Encuentra chats con el mismo par de participants (en cualquier orden)
 * y, con --confirm, fusiona sus mensajes en el más completo y borra el duplicado.
 *
 * Nota: los mensajes son subdocumentos embebidos en Chat — no hay colección
 * separada, por lo que la fusión usa $push / $each sobre el array messages.
 */

'use strict';

const path     = require('path');
const BACKEND  = path.resolve(__dirname, '../backend');

// Resolvemos dotenv y mongoose desde node_modules del backend
const dotenv   = require(path.join(BACKEND, 'node_modules/dotenv'));
const mongoose = require(path.join(BACKEND, 'node_modules/mongoose'));

dotenv.config({ path: path.join(BACKEND, '.env') });

const CONFIRM = process.argv.includes('--confirm');

// ── Modelo Chat desde el backend (misma instancia de mongoose) ───────────────
const Chat = require(path.join(BACKEND, 'src/models/Chat'));

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Conectado a MongoDB\n');

  // ── 1. Encontrar duplicados ───────────────────────────────────────────────
  // Normaliza el par de participants sorteando los IDs como strings,
  // agrupa por esa clave y devuelve grupos con más de un chat.
  const pipeline = [
    {
      $project: {
        _id:          1,
        participants: 1,
        lastMessage:  1,
        createdAt:    1,
        messageCount: { $size: '$messages' },
        lastMsgText:  '$lastMessageText',
        // clave canónica: par ordenado lexicográficamente
        pairKey: {
          $concat: [
            {
              $toString: {
                $min: [
                  { $toString: { $arrayElemAt: ['$participants', 0] } },
                  { $toString: { $arrayElemAt: ['$participants', 1] } },
                ],
              },
            },
            '_',
            {
              $toString: {
                $max: [
                  { $toString: { $arrayElemAt: ['$participants', 0] } },
                  { $toString: { $arrayElemAt: ['$participants', 1] } },
                ],
              },
            },
          ],
        },
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id:   '$pairKey',
        chats: { $push: '$$ROOT' },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
  ];

  const groups = await Chat.aggregate(pipeline);

  if (groups.length === 0) {
    console.log('No se encontraron chats duplicados.');
    await mongoose.disconnect();
    return;
  }

  // ── 2. Calcular usuarios afectados ───────────────────────────────────────
  const affectedUserIds = new Set();
  for (const g of groups) {
    for (const c of g.chats) {
      for (const p of c.participants) affectedUserIds.add(p.toString());
    }
  }

  // ── 3. Preview ───────────────────────────────────────────────────────────
  console.log(`Se encontraron ${groups.length} grupo(s) de chats duplicados\n`);

  let totalToDelete = 0;
  let totalMsgsToMove = 0;

  for (const [i, g] of groups.entries()) {
    // Determinar cuál se mantiene: más mensajes → más reciente como desempate
    const sorted = [...g.chats].sort((a, b) => {
      if (b.messageCount !== a.messageCount) return b.messageCount - a.messageCount;
      const dateA = new Date(a.lastMessage || a.createdAt);
      const dateB = new Date(b.lastMessage || b.createdAt);
      return dateB - dateA;
    });

    const keeper = sorted[0];
    const dupes  = sorted.slice(1);

    console.log(`── Grupo ${i + 1} (par: ${g._id}) ──`);
    for (const c of sorted) {
      const isKeeper  = c._id.toString() === keeper._id.toString();
      const date      = new Date(c.lastMessage || c.createdAt).toISOString().slice(0, 19).replace('T', ' ');
      const marker    = isKeeper ? '[MANTENER]' : '[BORRAR  ]';
      console.log(`  ${marker} id=${c._id}  mensajes=${c.messageCount}  ultimo=${date}`);
    }

    const msgsToMove = dupes.reduce((s, d) => s + d.messageCount, 0);
    console.log(`  → Mensajes a mover: ${msgsToMove}  |  Chats a borrar: ${dupes.length}\n`);

    totalToDelete  += dupes.length;
    totalMsgsToMove += msgsToMove;
  }

  console.log('─'.repeat(50));
  console.log(`RESUMEN PREVIEW`);
  console.log(`  Grupos duplicados : ${groups.length}`);
  console.log(`  Chats a eliminar  : ${totalToDelete}`);
  console.log(`  Mensajes a mover  : ${totalMsgsToMove}`);
  console.log(`  Usuarios afectados: ${affectedUserIds.size}`);
  console.log('─'.repeat(50));

  if (!CONFIRM) {
    console.log('\nEjecuta con --confirm para aplicar los cambios.\n');
    await mongoose.disconnect();
    return;
  }

  // ── 4. Confirmar: fusionar y borrar ──────────────────────────────────────
  console.log('\nAplicando cambios...\n');

  let deletedCount  = 0;
  let movedMsgCount = 0;

  for (const [i, g] of groups.entries()) {
    const sorted = [...g.chats].sort((a, b) => {
      if (b.messageCount !== a.messageCount) return b.messageCount - a.messageCount;
      const dateA = new Date(a.lastMessage || a.createdAt);
      const dateB = new Date(b.lastMessage || b.createdAt);
      return dateB - dateA;
    });

    const keeper = sorted[0];
    const dupes  = sorted.slice(1);

    for (const dupe of dupes) {
      // Cargar el documento completo del duplicado para obtener sus mensajes embebidos
      const fullDupe = await Chat.findById(dupe._id).lean();
      if (!fullDupe) continue;

      const msgsToMove = fullDupe.messages || [];

      if (msgsToMove.length > 0) {
        // Mover mensajes embebidos al chat que se mantiene
        await Chat.updateOne(
          { _id: keeper._id },
          {
            $push: {
              messages: {
                $each:    msgsToMove,
                $sort:    { createdAt: 1 },
                $position: 0,       // Se reordena con $sort, position 0 es punto de inserción base
              },
            },
          },
        );
        movedMsgCount += msgsToMove.length;
      }

      // Actualizar lastMessage del keeper si el dupe es más reciente
      const dupeDate   = new Date(fullDupe.lastMessage || fullDupe.createdAt);
      const keeperChat = await Chat.findById(keeper._id).select('lastMessage lastMessageText').lean();
      const keeperDate = new Date(keeperChat?.lastMessage || 0);

      if (dupeDate > keeperDate && fullDupe.lastMessageText) {
        await Chat.updateOne(
          { _id: keeper._id },
          { $set: { lastMessage: fullDupe.lastMessage, lastMessageText: fullDupe.lastMessageText } },
        );
      }

      // Borrar el duplicado
      await Chat.deleteOne({ _id: dupe._id });
      deletedCount++;

      console.log(`  Grupo ${i + 1}: movidos ${msgsToMove.length} mensajes de ${dupe._id} → ${keeper._id}, chat duplicado eliminado`);
    }
  }

  console.log('\n' + '─'.repeat(50));
  console.log('RESUMEN FINAL');
  console.log(`  Grupos procesados : ${groups.length}`);
  console.log(`  Chats eliminados  : ${deletedCount}`);
  console.log(`  Mensajes migrados : ${movedMsgCount}`);
  console.log('─'.repeat(50));

  await mongoose.disconnect();
  console.log('\nDesconectado. Listo.\n');
}

main().catch(err => {
  console.error('Error:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
