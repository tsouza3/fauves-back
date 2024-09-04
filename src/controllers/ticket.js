import Ticket from "../models/ticket.js";
import Event from "../models/event.js";
import User from "../models/user.js";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode'



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


export const validateQRCode = async (req, res) => {
  try {
    const { uuid, ticketId, eventId } = req.body;
    
    console.log('Parâmetros recebidos:', { uuid, ticketId, eventId });

    if (!uuid || !ticketId || !eventId) {
      console.log('Dados insuficientes para validar o QR Code.');
      return res.status(400).json({ message: 'Dados insuficientes para validar o QR Code.' });
    }

    const user = await User.findOne({
      'QRCode.uuid': uuid,
      'QRCode.ticketId': ticketId,
      'QRCode.eventId': eventId,
    }).populate({
      path: 'QRCode.ticketId',
      model: 'Ticket',
      select: 'nome',
    });

    console.log('Resultado da consulta ao banco de dados:', user);

    if (!user) {
      console.log('QR code não encontrado ou inválido.');
      return res.status(404).json({ message: 'QR code não encontrado ou inválido.' });
    }

    const qrCode = user.QRCode.find(qr => qr.uuid === uuid);

    if (!qrCode) {
      console.log('QR code não encontrado no array.');
      return res.status(404).json({ message: 'QR code não encontrado.' });
    }

    const ticket = await Ticket.findById(qrCode.ticketId);

    console.log('Ticket encontrado:', ticket);

    if (!ticket) {
      console.log('Ticket não encontrado.');
      return res.status(404).json({ message: 'Ticket não encontrado.' });
    }

    return res.status(200).json({
      userName: user.name,
      ticketName: ticket.nome,
    });

  } catch (error) {
    console.error('Erro ao validar o QR code:', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
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

  console.log('Iniciando a emissão de cortesia...');
  console.log(`Parâmetros recebidos - email: ${email}, event_Id: ${event_Id}, ticket_Id: ${ticket_Id}`);

  try {
    // Buscar usuário pelo e-mail
    console.log('Buscando usuário pelo e-mail...');
    const user = await User.findOne({ email });
    if (!user) {
      console.error('Usuário não encontrado:', email);
      return res.status(404).send('Usuário não encontrado');
    }
    console.log('Usuário encontrado:', user._id);

    // Buscar o ingresso pelo ticket_Id
    console.log('Buscando ingresso pelo ticket_Id...');
    const ticket = await Ticket.findById(ticket_Id);
    if (!ticket) {
      console.error('Ingresso não encontrado:', ticket_Id);
      return res.status(404).send('Ingresso não encontrado');
    }
    console.log('Ingresso encontrado:', ticket._id);

    // Gerar um identificador único para o QR Code
    const uniqueId = uuidv4();
    console.log('Identificador único gerado para o QR Code:', uniqueId);

    // Criar a URL do QR Code incluindo o event_Id, user_Id, ticket_Id e uniqueId
    const qrCodeUrl = `https://fauvesapi.thiagosouzadev.com/event/${event_Id}/${user._id}/${ticket_Id}/#${uniqueId}`;
    console.log('URL do QR Code gerada:', qrCodeUrl);

    // Gerar o QR Code
    const qrCodeData = await QRCode.toDataURL(qrCodeUrl);
    console.log('QR Code gerado com sucesso');

    // Atualizar o ingresso com o QR Code gerado
    console.log('Atualizando ingresso com o QR Code...');
    const updatedTicket = await Ticket.findByIdAndUpdate(ticket_Id, {
      $push: { txid: qrCodeData },
    }, { new: true });

    if (!updatedTicket) {
      console.error('Erro ao atualizar ingresso com QR Code:', ticket_Id);
      return res.status(404).send('Erro ao atualizar ingresso com QR Code');
    }
    console.log('Ingresso atualizado com sucesso:', updatedTicket._id);

    // Atualizar o usuário com o QR Code gerado
    console.log('Atualizando usuário com o QR Code...');
    const updatedUser = await User.findByIdAndUpdate(user._id, {
      $push: { QRCode: qrCodeData },
    }, { new: true });

    if (!updatedUser) {
      console.error('Erro ao atualizar usuário com QR Code:', user._id);
      return res.status(404).send('Erro ao atualizar usuário com QR Code');
    }
    console.log('Usuário atualizado com sucesso:', updatedUser._id);

    console.log('Ingresso de cortesia criado e QR Code gerado:', updatedTicket._id);
    res.status(200).send('Ingresso de cortesia criado com sucesso');
  } catch (error) {
    console.error('Erro ao gerar ingresso de cortesia:', error.message);
    res.status(500).send('Erro interno');
  }
};
