import Ticket from "../models/ticket.js";
import Event from "../models/event.js";
import User from "../models/user.js";
import jwt from "jsonwebtoken";

export const createTicket = async (req, res) => {
  const {
    nome,
    price,
    quantidadeTotal,
    dataInicio,
    dataTermino,
    lote,
    tipoIngresso,
    descricao,
    limitePessoa,
  } = req.body;
  const { eventId } = req.params;

  try {
    const eventExists = await Event.findById(eventId);
    if (!eventExists) {
      return res.status(404).json({ message: "Evento não encontrado" });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(403).json({ error: "Token não fornecido" });
    }

    const token = authHeader.split(" ")[1];
    let decodedToken;
    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(403).json({ error: "Token inválido" });
    }

    const userId = decodedToken.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const eventProfileId = eventExists.producaoEvento;
    if (!user.commercialProfiles.includes(eventProfileId)) {
      return res
        .status(403)
        .json({
          message:
            "Usuário não tem permissão para criar ingressos para este evento",
        });
    }

    const newTicket = new Ticket({
      nome,
      price,
      quantidadeTotal,
      dataInicio,
      dataTermino,
      tipoIngresso,
      lote,
      descricao,
      limitePessoa,
      user: userId,
      event: eventId,
    });

    const savedTicket = await newTicket.save();

    await Event.findByIdAndUpdate(eventId, {
      $push: { tickets: savedTicket._id },
    });

    res.status(201).json(savedTicket);
  } catch (error) {
    console.error("Erro ao criar o ticket:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
};
export const deleteTicket = async (req, res) => {
  const { ticketId, eventId } = req.params;

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Token não fornecido" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Evento não encontrado" });
    }

    if (event.user.toString() !== userId) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket não encontrado" });
    }

    event.tickets.pull(ticketId);
    await event.save();
    await Ticket.findByIdAndDelete(ticketId);

    res.status(200).json({ message: "Ticket excluído com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir o ticket:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
};

export const updateTicket = async (req, res) => {
  const { ticketId, eventId } = req.params;
  const {
    nome,
    price,
    quantidadeTotal,
    dataInicio,
    dataTermino,
    lote,
    tipoIngresso,
    descricao,
    limitePessoa,
  } = req.body;

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Token não fornecido" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Evento não encontrado" });
    }

    if (event.user.toString() !== userId) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket não encontrado" });
    }

    ticket.nome = nome ?? ticket.nome;
    ticket.price = price ?? ticket.price;
    ticket.quantidadeTotal = quantidadeTotal ?? ticket.quantidadeTotal;
    ticket.dataInicio = dataInicio ?? ticket.dataInicio;
    ticket.dataTermino = dataTermino ?? ticket.dataTermino;
    ticket.lote = lote ?? ticket.lote;
    ticket.tipoIngresso = tipoIngresso ?? ticket.tipoIngresso;
    ticket.descricao = descricao ?? ticket.descricao;
    ticket.limitePessoa = limitePessoa ?? ticket.limitePessoa;

    const updatedTicket = await ticket.save();

    res.status(200).json(updatedTicket);
  } catch (error) {
    console.error("Erro ao atualizar o ticket:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
};

export const emitirCortesia = async (req, res) => {
    const { email, event_Id, ticket_Id } = req.body;

    try {
        // Buscar usuário pelo e-mail
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).send('Usuário não encontrado');
        }

        // Buscar o ingresso pelo ticket_Id
        const ticket = await Ticket.findById(ticket_Id);
        if (!ticket) {
            return res.status(404).send('Ingresso não encontrado');
        }

        // Gerar um QR Code para o ingresso de cortesia
        const uniqueTicketId = new mongoose.Types.ObjectId(); // Gerar um ID único para o ingresso
        const qrCodeData = await QRCode.toDataURL(`https://fauvesapi.thiagosouzadev.com/event/${event_Id}/${user._id}/${uniqueTicketId}`);

        // Atualizar o ingresso com o QR Code
        const updatedTicket = await Ticket.findByIdAndUpdate(ticket_Id, {
            $push: { txid: qrCodeData },
        }, { new: true });

        if (!updatedTicket) {
            return res.status(404).send('Erro ao atualizar ingresso com QR Code');
        }

        // Atualizar o usuário com o QR Code, se necessário
        const updatedUser = await User.findByIdAndUpdate(user._id, {
            $push: { QRCode: qrCodeData },
        }, { new: true });

        if (!updatedUser) {
            return res.status(404).send('Erro ao atualizar usuário com QR Code');
        }

        console.log('Ingresso de cortesia criado e QR Code gerado:', updatedTicket._id);
        res.status(200).send('Ingresso de cortesia criado com sucesso');
    } catch (error) {
        console.error('Erro ao gerar ingresso de cortesia:', error);
        res.status(500).send('Erro interno');
    }
};


