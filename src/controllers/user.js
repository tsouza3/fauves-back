import Evento from "../models/event.js";
import User from "../models/user.js";
import generateToken from "../utils/generateToken.js";
import CommercialProfile from "../models/commercialProfile.js";

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

export async function update(req, res) {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const fieldsToUpdate = [
      "name",
      "email",
      "cpf",
      "celular",
      "dataNascimento",
      "cep",
      "logradouro",
      "bairro",
      "cidade",
      "uf",
      "numero",
    ];

    fieldsToUpdate.forEach((field) => {
      if (req.body[field]) {
        user[field] = req.body[field];
      }
    });

    const updatedUser = await user.save();
    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor." });
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

export async function updateUser(req, res) {
  const userId = req.params.id;
  const { nome } = req.body;
}

export const updateUserPermission = async (req, res) => {
  console.log("Atualização de permissão iniciada."); // Verifique se a função está sendo chamada

  try {
    const { email, eventId, role } = req.body;

    // Verifique se todos os campos necessários estão presentes
    if (!email || !eventId || !role) {
      console.log("Campos obrigatórios ausentes:", { email, eventId, role });
      return res.status(400).json({ message: "Email, eventId e role são obrigatórios." });
    }

    // Log para verificar o corpo da requisição
    console.log("Requisição recebida com dados:", { email, eventId, role });

    // Encontre o usuário pelo email
    const user = await User.findOne({ email });
    if (!user) {
      console.log("Usuário não encontrado com email:", email);
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    // Log para verificar o usuário encontrado
    console.log("Usuário encontrado:", user);

    // Encontre o evento pelo ID
    const evento = await Evento.findById(eventId);
    if (!evento) {
      console.log("Evento não encontrado com ID:", eventId);
      return res.status(404).json({ message: "Evento não encontrado." });
    }

    // Log para verificar o evento encontrado
    console.log("Evento encontrado:", evento);

    // Atualize ou adicione a permissão do evento no modelo do usuário
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

    // Atualize ou adicione a permissão do usuário no modelo do evento
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
    // Captura de erro mais detalhada
    console.error("Erro ao atualizar a permissão:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

