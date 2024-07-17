import mongoose from "mongoose";

const eventoSchema = new mongoose.Schema({
  nomeEvento: String,
  dataInicio: String,
  dataTermino: String,
  categoria: String,
  localDoEvento: String,
  producaoEvento: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CommercialProfile", 
  },
  emailEvento: String,
  capaEvento: String,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user", 
  },
  tickets: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
    },
  ],
});

const Evento = mongoose.model("Evento", eventoSchema);

export default Evento;
