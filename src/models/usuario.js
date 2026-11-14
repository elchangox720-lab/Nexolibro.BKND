import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const usuarioSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 120,
    },
    password: { type: String, required: true, minlength: 8, maxlength: 72, select: false },
    rol: { type: String, enum: ['usuario', 'admin'], default: 'usuario' },
  },
  { timestamps: true }
);

usuarioSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 10);
});

usuarioSchema.methods.compararPassword = function (password) {
  return bcrypt.compare(password, this.password);
};

usuarioSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.password;
    return ret;
  },
});

export default mongoose.model('Usuario', usuarioSchema);
