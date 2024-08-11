import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = mongoose.Schema({
  name: { type: String },
  email: { type: String, unique: true, match: /.+\@.+\..+/ },
  password: { type: String },
  QRCode: [{ type: String }],
  txid: [{ type: String }],
  commercialProfiles: [{ type: mongoose.Schema.Types.ObjectId, ref: "CommercialProfile" }],
  permissionCategory: [{
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Evento" }, // Referência ao evento
    role: { type: String, enum: ['user', 'observer', 'seller', 'admin'], default: 'user' } // Permissão para o evento
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
