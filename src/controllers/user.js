import User from "../models/user.js";
import Evento from "../models/event.js";

export const updatePermission = async (req, res) => {
  try {
    const { email, eventId, role } = req.body;

    if (!email || !eventId || !role) {
      return res.status(400).json({ message: "Email, eventId e role são obrigatórios." });
    }

    // Log para verificar o corpo da requisição
    console.log("Requisição recebida com dados:", { email, eventId, role });

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    // Log para verificar o usuário encontrado
    console.log("Usuário encontrado:", user);

    const evento = await Evento.findById(eventId);
    if (!evento) {
      return res.status(404).json({ message: "Evento não encontrado." });
    }

    // Log para verificar o evento encontrado
    console.log("Evento encontrado:", evento);

    // Atualizar ou adicionar a permissão do evento no modelo do usuário
    let userEventPermission = user.permissionCategory.find(
      (perm) => perm.eventId.toString() === eventId.toString()
    );

    // Log para verificar a permissão existente
    console.log("Permissão encontrada no usuário:", userEventPermission);

    if (userEventPermission) {
      userEventPermission.role = role;
    } else {
      user.permissionCategory.push({ eventId, role });
    }

    // Log antes de salvar o usuário
    console.log("Atualizando permissão no usuário:", user);

    await user.save();

    // Atualizar ou adicionar a permissão do usuário no modelo do evento
    let eventUserPermission = evento.permissionCategory.find(
      (perm) => perm.user.toString() === user._id.toString()
    );

    // Log para verificar a permissão existente no evento
    console.log("Permissão encontrada no evento:", eventUserPermission);

    if (eventUserPermission) {
      eventUserPermission.role = role;
    } else {
      evento.permissionCategory.push({ user: user._id, role });
    }

    // Log antes de salvar o evento
    console.log("Atualizando permissão no evento:", evento);

    await evento.save();

    res.status(200).json({ message: "Permissão atualizada com sucesso." });
  } catch (error) {
    console.error("Erro ao atualizar a permissão:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};
