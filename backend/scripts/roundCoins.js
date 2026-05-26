/**
 * Migration: round User.coins and User.coinsReservadas to 2 decimal places.
 * Run once: node scripts/roundCoins.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const r2 = v => Math.round(v * 100) / 100;

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const db   = mongoose.connection.db;
  const coll = db.collection('users');

  const cursor = coll.find({}, { projection: { coins: 1, coinsReservadas: 1 } });
  let fixed = 0;

  for await (const doc of cursor) {
    const newCoins    = r2(doc.coins ?? 0);
    const newReserved = r2(doc.coinsReservadas ?? 0);

    if (newCoins !== doc.coins || newReserved !== (doc.coinsReservadas ?? 0)) {
      await coll.updateOne(
        { _id: doc._id },
        { $set: { coins: newCoins, coinsReservadas: newReserved } }
      );
      fixed++;
    }
  }

  console.log(`Done. Fixed ${fixed} user document(s).`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
