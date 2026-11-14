import jwt from 'jsonwebtoken';
import Usuario from '../models/usuario.js';

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

    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ message: 'Nombre, email y contraseña son obligatorios' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const existe = await Usuario.findOne({ email: String(email).toLowerCase() });
    if (existe) {
      return res.status(409).json({ message: 'El email ya está registrado' });
    }

    const usuario = await Usuario.create({ nombre, email, password });
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

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email y contraseña son obligatorios' });
    }

    const usuario = await Usuario.findOne({ email: String(email).toLowerCase() }).select(
      '+password'
    );

    if (!usuario || !(await usuario.compararPassword(password))) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
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
