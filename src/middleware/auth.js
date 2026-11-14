import jwt from 'jsonwebtoken';
import Usuario from '../models/usuario.js';

export async function autenticar(req, res, next) {
  try {
    const header = req.headers.authorization ?? '';
    const [tipo, token] = header.split(' ');

    if (tipo !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
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
