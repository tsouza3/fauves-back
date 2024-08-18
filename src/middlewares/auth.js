import jwt from "jsonwebtoken";
import User from "../models/user.js";
import Evento from "../models/event.js";

// Define a hierarquia das roles
const roleHierarchy = {
  admin: 4,
  seller: 3,
  checkIn: 2,
  observer: 1,
  user: 0
};

const protect = (requiredRoles) => async (req, res, next) => {
  let token;

  // Verifica se o token foi fornecido no cabeçalho da requisição
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        console.log("Usuário não encontrado.");
        return res.status(401).json({ message: "Usuário não encontrado, não autorizado." });
      }

      console.log(`Usuário ${req.user._id} encontrado com a role ${req.user.role}`);

      // Verifica permissões baseadas no evento somente se o eventId estiver presente
      const eventId = req.params.eventId || req.body.eventId;
      if (eventId) {
        console.log(`Verificando permissões para o evento ${eventId}`);
        
        const evento = await Evento.findById(eventId).populate('permissionCategory.user', 'permissionCategory.role');

        if (!evento) {
          console.log("Evento não encontrado.");
          return res.status(404).json({ message: "Evento não encontrado." });
        }

        console.log(`Permissões encontradas para o evento ${eventId}:`, evento.permissionCategory);

        // Encontra as permissões do usuário dentro do array permissionCategory
        const userPermission = evento.permissionCategory.find(
          (perm) => perm.user.toString() === req.user._id.toString()
        );

        if (!userPermission) {
          console.log(`Usuário ${req.user._id} não tem permissões associadas para o evento ${eventId}`);
          if (!requiredRoles.includes('user')) {
            console.log("Acesso negado, você não faz parte da equipe deste evento.");
            return res.status(403).json({ message: "Acesso negado, você não faz parte da equipe deste evento." });
          }
        } else {
          console.log(`Permissões do usuário ${req.user._id}:`, userPermission.role);
          
          // Permissões do usuário podem ser uma string ou um array de strings
          const userPermissions = Array.isArray(userPermission.role) ? userPermission.role : [userPermission.role];
          
          // Verifica se o usuário tem pelo menos uma das permissões requeridas
          const hasPermission = userPermissions.some((role) =>
            requiredRoles.some((requiredRole) => roleHierarchy[role] <= roleHierarchy[requiredRole])
          );

          if (!hasPermission) {
            console.log("Acesso negado, permissões insuficientes.");
            return res.status(403).json({ message: "Acesso negado, permissões insuficientes." });
          }
        }
      } else {
        console.log("Nenhum eventId fornecido, verificação de permissões de evento pulada.");
      }

      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        console.log("Token expirado.");
        return res.status(401).json({ message: "Token expirado, por favor faça login novamente." });
      }

      console.error("Erro na verificação do token:", error);
      return res.status(400).json({ message: "Token inválido, não autorizado." });
    }
  } else {
    console.log("Token não fornecido ou em formato inválido.");
    return res.status(400).json({ message: "Token não fornecido ou em formato inválido." });
  }
};

export default protect;
