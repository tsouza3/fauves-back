import mongoose from "mongoose";

const ticketSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Evento",
    },
    QRCode: {
      type: String,
    },
    
    txid: {
      type: String,
      unique: true,
    },

    nome: {
      type: String,
      required: true,
    },

    price: {
      type: String,
    },

    quantidadeTotal: {
      type: String,
    },
    lote: {
      type: String,
    },
    tipoIngresso: {
      type: String,
    },

    limitePessoa: {
      type: String,
    },

    dataInicio: {
      type: String,
    },

    dataTermino: {
      type: String,
    },

    descricao: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

const Ticket = mongoose.model("Ticket", ticketSchema);

export default Ticket;
