import jwt from "jsonwebtoken";
import User from "../models/user.js";
import Evento from "../models/event.js";

const protect = (requiredPermission) => async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json({ message: "Usuário não encontrado, não autorizado." });
      }

      // Verifica permissões baseadas no evento somente se o eventId estiver presente
      const eventId = req.params.eventId || req.body.eventId;
      if (eventId) {
        const evento = await Evento.findById(eventId).populate('permissionCategory.user', 'permissionCategory.role');
  
        if (!evento) {
          return res.status(404).json({ message: "Evento não encontrado." });
        }
  
        const userPermission = evento.permissionCategory.find(
          (perm) => perm.user.toString() === req.user._id.toString()
        );
  
        if (!userPermission && requiredPermission !== 'user') {
          return res.status(403).json({ message: "Acesso negado, você não faz parte da equipe deste evento." });
        }
  
        if (userPermission) {
          const userPermissionLevel = getPermissionLevel(userPermission.role);
          const requiredPermissionLevel = getPermissionLevel(requiredPermission);
  
          if (userPermissionLevel < requiredPermissionLevel) {
            return res.status(403).json({ message: "Acesso negado, permissões insuficientes." });
          }
        }
      } else {
        // Se a rota não estiver relacionada a um evento específico, faça a verificação da permissão global do usuário
        const userPermissionLevel = getPermissionLevel(req.user.role);
        const requiredPermissionLevel = getPermissionLevel(requiredPermission);

        if (userPermissionLevel < requiredPermissionLevel) {
          return res.status(403).json({ message: "Acesso negado, permissões insuficientes." });
        }
      }

      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
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
