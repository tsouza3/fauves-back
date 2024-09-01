import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = mongoose.Schema({
  name: { type: String },
  email: { type: String, unique: true, match: /.+\@.+\..+/ },
  password: { type: String },
  QRCode: [{
        data: String, // Base64 ou URL do QR code
        uuid: { type: String, unique: true, required: true }, // UUID gerado e associado a cada QR code
        ticketId: { type: mongoose.Schema.Types.ObjectId, ref: "Ticket" }, // Referência ao ingresso
        txid: { type: String }, // ID da transação PIX
        eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Evento" } // Referência ao evento
    }],
  commercialProfiles: [{ type: mongoose.Schema.Types.ObjectId, ref: "CommercialProfile" }],
  permissionCategory: [{
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Evento" }, // Referência ao evento
    role: { type: String, enum: ['user', 'observer', 'seller', 'admin', 'checkin'], default: 'user' } // Permissão para o evento
  }],
  cpf: { type: String },
  celular: { type: String },
  dataNascimento: { type: String },
  cep: { type: String },
  logradouro: { type: String },
  bairro: { type: String },
  cidade: { type: String },
  uf: { type: String },
  numero: { type: Number },
}, { timestamps: true });

// Middleware para garantir que 'user' seja o padrão em permissionCategory
userSchema.pre("save", function(next) {
  if (this.permissionCategory.length === 0) {
    this.permissionCategory.push({ role: 'user' });
  }
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  next();
});

const User = mongoose.model("User", userSchema);

export default User;
