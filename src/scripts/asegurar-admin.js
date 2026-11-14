import 'dotenv/config';
import mongoose from 'mongoose';
import Usuario from '../models/usuario.js';

const email = (process.env.ADMIN_EMAIL || 'elchangox720@gmail.com').trim().toLowerCase();

await mongoose.connect(process.env.MONGODB_URI, {
  dbName: process.env.MONGODB_DB || 'nexolibro',
});

const usuario = await Usuario.findOneAndUpdate(
  { email },
  { $set: { rol: 'admin' } },
  { returnDocument: 'after' }
);

if (usuario) {
  console.log(`Rol de administrador asignado a ${usuario.email}`);
} else {
  console.log(`No existe una cuenta con ${email}; se asignará al registrarse.`);
}

await mongoose.disconnect();
