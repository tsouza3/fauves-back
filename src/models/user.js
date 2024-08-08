const eventoSchema = mongoose.Schema({
  nomeEvento: { type: String, required: true },
  dataInicio: { type: Date, required: true },
  dataTermino: { type: Date, required: true },
  categoria: { type: String, required: true },
  localDoEvento: { type: String, required: true },
  emailEvento: { type: String, required: true },
  capaEvento: { type: String },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  producaoEvento: { type: mongoose.Schema.Types.ObjectId, ref: "CommercialProfile" },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    role: { type: String, enum: ['admin', 'observer', 'seller', 'checkin'], default: 'user' },
  }],
}, {
  timestamps: true,
});

const Evento = mongoose.model("Evento", eventoSchema);

export default Evento;
