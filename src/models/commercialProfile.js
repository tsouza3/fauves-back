import mongoose from "mongoose";

const commercialProfileSchema = mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    profilePhoto: {
      type: String,
    },
    nomeEmpresa: {
      type: String,
    },
    nomeUsuario: {
      type: String,
      unique: true,
    },
    categoria: {
      type: String,
    },
    instagram: {
      type: String,
    },
    telefone: {
      type: String,
    },
    empresa: {
      type: String,
    },
    descricao: {
      type: String,
    },
    cpfoucnpj: {
      type: String,
      unique: true,
    },
  },
  {
    timestamps: true,
  },
);

const CommercialProfile = mongoose.model(
  "CommercialProfile",
  commercialProfileSchema,
);

export default CommercialProfile;
