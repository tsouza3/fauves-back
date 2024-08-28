import Evento from "../models/event.js";
import User from "../models/user.js";

import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import fs from 'fs';
import path from 'path'

export const criarEvento = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(403).json({ error: "Token não fornecido" });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decodedToken.id;

    const {
      nomeEvento,
      dataInicio,
      dataTermino,
      categoria,
      localDoEvento,
      emailEvento,
      selectedCommercialProfileId,
    } = req.body;

    // Conversão das datas de string para objeto Date
    const dataInicioFormatada = new Date(dataInicio.replace(" às ", "T"));
    const dataTerminoFormatada = new Date(dataTermino.replace(" às ", "T"));

    // Criação do evento
    const novoEvento = new Evento({
      nomeEvento,
      dataInicio: dataInicioFormatada,
      dataTermino: dataTerminoFormatada,
      categoria,
      localDoEvento,
      emailEvento,
      capaEvento: req.file ? req.file.path : "",
      user: userId,
      producaoEvento: selectedCommercialProfileId,
      permissionCategory: [{ user: userId, role: 'admin' }]  // Adiciona o criador como admin
    });

    const eventoSalvo = await novoEvento.save();

    // Atualização do modelo User para adicionar o evento na permissionCategory
    await User.findByIdAndUpdate(
      userId,
      {
        $push: {
          permissionCategory: {
            eventId: eventoSalvo._id,
            role: 'admin'
          }
        }
      }
    );

    res.status(200).json(eventoSalvo);
  } catch (error) {
    console.error("Erro ao criar evento:", error);
    res.status(400).json({ error: "Erro ao criar evento" });
  }
};


export const listarEventosPorData = async (req, res) => {
  try {
    const { profileId, tipo } = req.query;
    const hoje = new Date();

    let eventos;
    if (tipo === "atuais") {
      // Buscar eventos futuros
      eventos = await Evento.find({
        producaoEvento: profileId,
        dataInicio: { $gte: hoje },
      }).sort({ dataInicio: 1 });
    } else if (tipo === "anteriores") {
      // Buscar eventos passados
      eventos = await Evento.find({
        producaoEvento: profileId,
        dataTermino: { $lt: hoje },
      }).sort({ dataInicio: -1 });
    }

    res.status(200).json(eventos);
  } catch (error) {
    console.error("Erro ao listar eventos:", error);
    res.status(500).json({ message: "Erro ao listar eventos." });
  }
};


export const editarEvento = async (req, res) => {
  try {
    const { eventId } = req.params;
    const {
      nomeEvento,
      dataInicio,
      dataTermino,
      categoria,
      localDoEvento,
      emailEvento,
    } = req.body;

    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Token não fornecido" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const evento = await Evento.findById(eventId);
    if (!evento) {
      return res.status(404).json({ error: "Evento não encontrado" });
    }

    if (evento.user.toString() !== userId) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    console.log("Dados do evento antes da atualização:", evento);

    evento.nomeEvento = nomeEvento || evento.nomeEvento;
    evento.dataInicio = dataInicio || evento.dataInicio;
    evento.dataTermino = dataTermino || evento.dataTermino;
    evento.categoria = categoria || evento.categoria;
    evento.localDoEvento = localDoEvento || evento.localDoEvento;
    evento.emailEvento = emailEvento || evento.emailEvento;

    if (req.file) {
      evento.capaEvento = req.file.path;
    }

    console.log("Dados do evento após a atualização:", evento);

    const eventoAtualizado = await evento.save();

    console.log("Evento atualizado:", eventoAtualizado);

    res.status(200).json(eventoAtualizado);
  } catch (error) {
    console.error("Erro ao editar evento:", error);
    res.status(400).json({ error: "Erro ao editar evento" });
  }
};

export const buscarEventos = async (req, res) => {
  try {
    const eventos = await Evento.find();

    const eventosComId = eventos.map((evento) => ({
      ...evento.toJSON(),
      id: evento._id.toString(),
    }));

    res.status(200).json(eventosComId);
  } catch (error) {
    res.status(400).json({ error: "Erro ao buscar eventos" });
  }
};

export const buscarEventosPorPerfilComercial = async (req, res) => {
  const { profileId } = req.params;

  try {
    const eventos = await Evento.find({ producaoEvento: profileId });

    const eventosComId = eventos.map((evento) => ({
      ...evento.toJSON(),
      id: evento._id.toString(),
    }));

    res.status(200).json(eventosComId);
  } catch (error) {
    console.error("Erro ao buscar eventos por perfil comercial:", error);
    res
      .status(500)
      .json({ error: "Erro interno ao buscar eventos por perfil comercial" });
  }
};

export const deleteEvent = async (req, res) => {
  const { eventId } = req.params;

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Token não fornecido" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const evento = await Evento.findById(eventId);
    if (!evento) {
      return res.status(404).json({ message: "Evento não encontrado." });
    }

    if (evento.user.toString() !== userId) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    const capaEventoPath = path.resolve(evento.capaEvento);

    await Evento.findByIdAndDelete(eventId);

    fs.unlink(capaEventoPath, (err) => {
      if (err) {
        console.error("Erro ao excluir o arquivo de capa:", err);
      }
    });

    res.status(200).json({ message: "Evento excluído com sucesso." });
  } catch (error) {
    console.error("Erro ao deletar o evento:", error);
    res.status(500).json({ message: "Erro interno ao deletar o evento." });
  }
};
export const getEventById = async (req, res) => {
  const { eventId } = req.params;

  try {
    console.log(`Buscando evento com ID: ${eventId}`);
    const event = await Evento.findById(eventId).populate("tickets");
    if (!event) {
      console.log(`Evento com ID ${eventId} não encontrado`);
      return res.status(404).json({ message: "Evento não encontrado" });
    }

    console.log(`Evento encontrado: ${event}`);
    res.status(200).json(event);
  } catch (error) {
    console.error("Erro ao buscar o evento:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
};

export const getEventsByUser = async (req, res) => {
  try {
    const userId = req.user._id; // ID do usuário autenticado
    const user = await User.findById(userId).populate('permissionCategory.eventId'); // Popula os eventos

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    const events = await Evento.find({
      _id: { $in: user.permissionCategory.map(pc => pc.eventId) } // Filtra eventos baseados nos IDs dos eventos permitidos
    });

    // Inclui a função do usuário em relação a cada evento
    const eventsWithRole = events.map(event => {
      const permission = user.permissionCategory.find(pc => pc.eventId.equals(event._id));
      return {
        ...event.toObject(),
        role: permission ? permission.role : 'none'
      };
    });

    res.json(eventsWithRole);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
