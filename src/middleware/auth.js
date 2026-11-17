import jwt from 'jsonwebtoken';
import Usuario from '../models/usuario.js';

function verificarToken(token) {
  const secretos = [process.env.JWT_SECRET, process.env.JWT_SECRET_PREVIOUS].filter(Boolean);

  for (const secreto of secretos) {
    try {
      return jwt.verify(token, secreto);
    } catch {}
  }

  return null;
}

export async function autenticar(req, res, next) {
  try {
    const header = req.headers.authorization ?? '';
    const [tipo, token] = header.split(' ');

    if (tipo !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const payload = verificarToken(token);

    if (!payload) {
      return res.status(401).json({ message: 'Token inválido o expirado' });
    }

    const usuario = await Usuario.findById(payload.sub);

    if (!usuario) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    req.usuario = usuario;
    req.usuarioId = usuario._id;
    next();
  } catch {
    res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

export function soloAdmin(req, res, next) {
  if (req.usuario?.rol !== 'admin') {
    return res.status(403).json({ message: 'Se requieren permisos de administrador' });
  }

  next();
}
