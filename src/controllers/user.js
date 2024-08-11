import User from "../models/user.js";
import generateToken from "../utils/generateToken.js";
import CommercialProfile from "../models/commercialProfile.js";
import Evento from "../models/event.js";


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

export async function updateUserPermission(req, res) {
  const { email, permissionCategory, eventId } = req.body;

  if (!email || !permissionCategory || !eventId) {
    return res.status(400).json("Email, evento e categoria de permissão são obrigatórios.");
  }

  try {
    // Encontrar o usuário pelo email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json("Usuário não encontrado.");
    }

    // Verificar se o evento existe
    const evento = await Evento.findById(eventId);
    if (!evento) {
      return res.status(404).json("Evento não encontrado.");
    }

    // Verificar se o usuário já tem uma permissão associada ao evento
    const existingPermission = user.permissionCategory.find(
      (perm) => perm.eventId.toString() === eventId
    );

    if (existingPermission) {
      // Atualizar a permissão existente
      existingPermission.role = permissionCategory;
    } else {
      // Adicionar nova permissão ao usuário para o evento específico
      user.permissionCategory.push({ eventId, role: permissionCategory });
    }

    // Salvar as alterações no usuário
    await user.save();

    // Atualizar também o modelo Evento
    const eventPermission = evento.permissionCategory.find(
      (perm) => perm.user.toString() === user._id.toString()
    );

    if (eventPermission) {
      eventPermission.role = permissionCategory;
    } else {
      evento.permissionCategory.push({ user: user._id, role: permissionCategory });
    }

    await evento.save();

    res.status(200).json({ message: "Categoria de permissão atualizada com sucesso." });
  } catch (error) {
    console.error("Erro ao atualizar a categoria de permissão:", error);
    res.status(500).json("Erro ao atualizar a categoria de permissão.");
  }
};
