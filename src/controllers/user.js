import Evento from "../models/event.js";
import User from "../models/user.js";
import Ticket from "../models/ticket.js"; // Modelo de ingresso
import asyncHandler from 'express-async-handler';
import generateToken from "../utils/generateToken.js";
import CommercialProfile from "../models/commercialProfile.js";
import mongoose from 'mongoose'

export async function create(req, res) {
  const { name, email, password } = req.body;

  const userExists = await User.findOne({ email });

  if (userExists) {
    return res.status(400).json({ error: "Usuário já existe." });
  }

  try {
    const user = await User.create({
      name,
      email,
      password,
    });

    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: "Erro ao criar o usuário." });
  }
}



export async function login(req, res) {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const isPasswordValid = await user.matchPassword(password);

    if (!isPasswordValid) {
      return res.status(400).json({ error: "E-mail ou senha inválidos" });
    }

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor." });
  }
}

export async function getProfileDataByUser(req, res) {
  try {
    const profileId = req.params.profileId;

    const commercialProfile = await CommercialProfile.findById(profileId);

    if (!commercialProfile) {
      return res.status(404).json({ error: "Perfil comercial não encontrado" });
    }

    const profileData = {
      _id: commercialProfile._id,
      nomeEmpresa: commercialProfile.nomeEmpresa,
      nomeUsuario: commercialProfile.nomeUsuario,
      categoria: commercialProfile.categoria,
      instagram: commercialProfile.instagram,
      telefone: commercialProfile.telefone,
      empresa: commercialProfile.empresa,
      descricao: commercialProfile.descricao,
      cpfoucnpj: commercialProfile.cpfoucnpj,
      profilePhoto: commercialProfile.profilePhoto,
    };

    res.status(200).json(profileData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao obter o perfil comercial" });
  }
}

export async function getProfileData(req, res) {
  try {
    const userId = req.user._id;

    console.log("User ID:", userId);  // Adicione este log para verificar o ID do usuário

    const user = await User.findById(userId);

    if (!user) {
      console.log("Usuário não encontrado");  // Adicione este log para verificar se o usuário foi encontrado
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const commercialProfiles = await CommercialProfile.find({ userId });

    const profileData = {
      name: user.name,
      userId: userId,
      QRCode: user.QRCode,
      commercialProfiles: commercialProfiles.map((profile) => ({
        _id: profile._id,
        nomeEmpresa: profile.nomeEmpresa,
        nomeUsuario: profile.nomeUsuario,
        categoria: profile.categoria,
        instagram: profile.instagram,
        telefone: profile.telefone,
        empresa: profile.empresa,
        descricao: profile.descricao,
        cpfoucnpj: profile.cpfoucnpj,
        profilePhoto: profile.profilePhoto,
      })),
    };

    console.log("Profile Data:", profileData);  

    res.json(profileData);
  } catch (error) {
    console.error("Erro ao buscar os dados do perfil:", error);
    res.status(500).json({ error: "Erro ao buscar os dados do perfil" });
  }
}


export async function createProductorProfile(req, res) {
  try {
    const { _id: userId } = req.user;
    const {
      nomeEmpresa,
      nomeUsuario,
      categoria,
      instagram,
      telefone,
      empresa,
      descricao,
      cpfoucnpj,
    } = req.body;

    const existingProfile = await CommercialProfile.findOne({ nomeUsuario });
    if (existingProfile) {
      return res.status(400).json({ error: "Nome de usuário já está em uso" });
    }

    const newProfile = new CommercialProfile({
      userId,
      profilePhoto: req.file.path,
      nomeEmpresa,
      nomeUsuario,
      categoria,
      instagram,
      telefone,
      empresa,
      descricao,
      cpfoucnpj,
    });

    const savedProfile = await newProfile.save();

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $push: { commercialProfiles: savedProfile._id } },
      { new: true },
    );

    res.status(201).json(savedProfile);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Erro ao criar perfil comercial" });
  }
}

export async function getCommercialProfilesByUser(req, res) {
  const userId = req.params.userId;

  try {
    const profiles = await CommercialProfile.find({ userId });

    if (!profiles || profiles.length === 0) {
      return res
        .status(404)
        .json({ error: "Perfis comerciais não encontrados" });
    }

    res.json(profiles);
  } catch (error) {
    console.error("Erro ao buscar perfis comerciais:", error);
    res.status(500).json({ error: "Erro ao buscar perfis comerciais" });
  }
}

export const editUserProfile = async (req, res) => {
  try {
    const userId = req.user._id; // Assumindo que o ID do usuário está no token JWT
    const {
      name,
      celular,
      cpf,
      dataNascimento,
      cep,
      logradouro,
      bairro,
      cidade,
      uf,
      numero,
    } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        name,
        celular,
        cpf,
        dataNascimento,
        cep,
        logradouro,
        bairro,
        cidade,
        uf,
        numero,
      },
      { new: true } // Retorna o documento atualizado
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Erro ao atualizar perfil do usuário:", error);
    res.status(500).json({ message: "Erro ao atualizar perfil do usuário" });
  }
};

export const updateUserPermission = async (req, res) => {
  console.log("Atualização de permissão iniciada.");

  try {
    const { email, eventId, role } = req.body;

    if (!email || !eventId || !role) {
      console.log("Campos obrigatórios ausentes:", { email, eventId, role });
      return res.status(400).json({ message: "Email, eventId e role são obrigatórios." });
    }

    const validRoles = ['user', 'observer', 'seller', 'admin', 'checkin'];
    if (!validRoles.includes(role)) {
      console.log("Role inválido:", role);
      return res.status(400).json({ message: "Role inválido." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log("Usuário não encontrado com email:", email);
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    const evento = await Evento.findById(eventId);
    if (!evento) {
      console.log("Evento não encontrado com ID:", eventId);
      return res.status(404).json({ message: "Evento não encontrado." });
    }

    // Verifique se o usuário já possui uma permissão para o evento
    let userEventPermission = user.permissionCategory.find(
      (perm) => perm && perm.eventId && perm.eventId.toString() === eventId.toString()
    );

    if (userEventPermission) {
      if (userEventPermission.role === role) {
        console.log("Usuário já possui a permissão com o mesmo cargo.");
        return res.status(400).json({ message: "O usuário já possui a permissão com o mesmo cargo." });
      } else {
        console.log("Atualizando permissão do usuário.");
        userEventPermission.role = role;
      }
    } else {
      console.log("Adicionando nova permissão ao usuário.");
      user.permissionCategory.push({ eventId, role });
    }

    await user.save();

    // Verifique se o evento já possui uma permissão para o usuário
    let eventUserPermission = evento.permissionCategory.find(
      (perm) => perm && perm.user && perm.user.toString() === user._id.toString()
    );

    if (eventUserPermission) {
      if (eventUserPermission.role === role) {
        console.log("Usuário já possui a permissão com o mesmo cargo no evento.");
        return res.status(400).json({ message: "O usuário já possui a permissão com o mesmo cargo no evento." });
      } else {
        console.log("Atualizando permissão do usuário no evento.");
        eventUserPermission.role = role;
      }
    } else {
      console.log("Adicionando nova permissão ao evento.");
      evento.permissionCategory.push({ user: user._id, role });
    }

    await evento.save();

    res.status(200).json({ message: "Permissão atualizada com sucesso." });
  } catch (error) {
    console.error("Erro ao atualizar a permissão:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

export const transferTicket = asyncHandler(async (req, res) => {
    const { email, uniqueTicketId, ticketId } = req.body;

    // Encontre o usuário que receberá o ingresso
    const recipientUser = await User.findOne({ email });
    if (!recipientUser) {
        res.status(404);
        throw new Error('Usuário destinatário não encontrado');
    }

    // Encontre o usuário que está transferindo o ingresso
    const currentUser = await User.findById(req.user._id);
    if (!currentUser) {
        res.status(404);
        throw new Error('Usuário atual não encontrado');
    }

    // Encontre o QRCode do ingresso a ser transferido
    const ticketQRCode = currentUser.QRCode.find(qr => qr.uuid === uniqueTicketId && qr.ticketId?.toString() === ticketId);

    if (!ticketQRCode) {
        res.status(404);
        throw new Error('Ingresso não encontrado ou UUID inválido');
    }

    // Verifique se o ingresso realmente pertence ao usuário atual
    const ticket = await Ticket.findById(ticketId);
    if (!ticket || !ticket.owner || ticket.owner.toString() !== currentUser._id.toString()) {
        res.status(403);
        throw new Error('Você não tem permissão para transferir este ingresso');
    }

    // Remova o QRCode do usuário atual
    currentUser.QRCode = currentUser.QRCode.filter(qr => qr.uuid !== uniqueTicketId);
    await currentUser.save();

    // Adicione o QRCode ao usuário destinatário
    recipientUser.QRCode.push({
        data: ticketQRCode.data,
        uuid: uniqueTicketId,
        ticketId: ticketId,
        txid: ticketQRCode.txid,
        eventId: ticketQRCode.eventId,
    });

    await recipientUser.save();

    // Transfira a posse do ingresso
    ticket.owner = recipientUser._id;
    await ticket.save();

    res.status(200).json({ message: 'Ingresso transferido com sucesso' });
});
export const getUsersByRole = async (req, res) => {
  const { eventId } = req.params;

  try {
    const evento = await Evento.findById(eventId).populate('permissionCategory.user', 'name email');

    if (!evento) {
      return res.status(404).json({ message: 'Evento não encontrado.' });
    }

    const usersWithRoles = evento.permissionCategory.map(permission => ({
      userId: permission.user._id,
      name: permission.user.name,
      email: permission.user.email,
      role: permission.role
    }));

    console.log('Users with Roles:', usersWithRoles); // Verifique os dados que estão sendo enviados
    return res.status(200).json(usersWithRoles);
  } catch (error) {
    console.error("Erro ao buscar usuários do evento:", error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};
