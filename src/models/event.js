import mongoose from 'mongoose';

const eventoSchema = new mongoose.Schema({
  nomeEvento: String,
  dataInicio: Date,  // Alterado para Date
  dataTermino: Date,  // Alterado para Date
  categoria: String,
  localDoEvento: String,
  description: String,
  producaoEvento: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CommercialProfile",
  },
  emailEvento: String,
  capaEvento: String,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  tickets: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
    },
  ],
  permissionCategory: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      role: {
        type: String,
        enum: ['user', 'observer', 'seller', 'admin', 'checkin'],
        default: 'user',
      },
    },
  ],
});

const Evento = mongoose.model("Evento", eventoSchema);

export default Evento;
