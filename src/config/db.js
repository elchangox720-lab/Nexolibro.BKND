import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI no está definida en las variables de entorno');
  }

  mongoose.connection.on('connected', () => {
    console.log('MongoDB conectado');
  });

  mongoose.connection.on('error', (error) => {
    console.error('Error de conexión a MongoDB:', error.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB desconectado');
  });

  await mongoose.connect(uri);

  return mongoose.connection;
}
