import jwt from 'jsonwebtoken';
import Usuario from '../models/usuario.js';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'elchangox720@gmail.com').trim().toLowerCase();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function esAdmin(email) {
  return String(email).trim().toLowerCase() === ADMIN_EMAIL;
}

function firmarToken(usuario) {
  return jwt.sign({ sub: usuario._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function manejarError(res, error) {
  if (error.name === 'ValidationError') {
    const errores = Object.values(error.errors).map((item) => item.message);
    return res.status(400).json({ message: 'Datos inválidos', errores });
  }

  if (error.code === 11000) {
    return res.status(409).json({ message: 'El email ya está registrado' });
  }

  console.error(error);
  return res.status(500).json({ message: 'Error interno del servidor' });
}

export async function registrar(req, res) {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(503).json({ message: 'El registro no está configurado en el servidor' });
    }

    const nombre = String(req.body?.nombre ?? '').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');

    if (!nombre || !email || !password) {
      return res.status(400).json({ message: 'Nombre, email y contraseña son obligatorios' });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'El email no es válido' });
    }

    if (nombre.length < 2 || nombre.length > 80) {
      return res.status(400).json({ message: 'El nombre debe tener entre 2 y 80 caracteres' });
    }

    if (password.length < 8 || password.length > 72) {
      return res
        .status(400)
        .json({ message: 'La contraseña debe tener entre 8 y 72 caracteres' });
    }

    const existe = await Usuario.findOne({ email });
    if (existe) {
      return res.status(409).json({ message: 'El email ya está registrado' });
    }

    const usuario = await Usuario.create({
      nombre,
      email,
      password,
      rol: esAdmin(email) ? 'admin' : 'usuario',
    });
    const token = firmarToken(usuario);

    res.status(201).json({ token, usuario });
  } catch (error) {
    manejarError(res, error);
  }
}

export async function login(req, res) {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(503).json({ message: 'El inicio de sesión no está configurado en el servidor' });
    }

    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Email y contraseña son obligatorios' });
    }

    const usuario = await Usuario.findOne({ email }).select('+password');

    if (!usuario || !(await usuario.compararPassword(password))) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    if (esAdmin(email) && usuario.rol !== 'admin') {
      await Usuario.updateOne({ _id: usuario._id }, { $set: { rol: 'admin' } });
      usuario.rol = 'admin';
    }

    const token = firmarToken(usuario);

    res.json({ token, usuario });
  } catch (error) {
    manejarError(res, error);
  }
}

export function perfil(req, res) {
  res.json({ usuario: req.usuario });
}
