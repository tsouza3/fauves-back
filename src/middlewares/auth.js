import jwt from "jsonwebtoken";
import User from "../models/user.js";
import Evento from "../models/event.js";

const protect = (requiredRole) => async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        console.log("Usuário não encontrado.");
        return res.status(401).json({ message: "Usuário não encontrado, não autorizado." });
      }

      // Verificação do eventId apenas se fornecido
      const eventId = req.params.eventId || req.body.eventId;
      if (eventId) {
        const evento = await Evento.findById(eventId);

        if (!evento) {
          console.log(`Evento não encontrado para eventId: ${eventId}`);
          return res.status(404).json({ message: "Evento não encontrado." });
        }

        const userPermission = evento.permissionCategory.find(
          (perm) => perm.user.toString() === req.user._id.toString()
        );

        if (!userPermission) {
          console.log(`Usuário ${req.user._id} não encontrado na categoria de permissões do evento.`);
          return res.status(403).json({ message: "Acesso negado, você não faz parte da equipe deste evento." });
        }

        if (userPermission.role !== requiredRole) {
          console.log(`Usuário ${req.user._id} tem a role '${userPermission.role}', mas '${requiredRole}' é necessária.`);
          return res.status(403).json({ message: "Acesso negado, permissões insuficientes." });
        }
      } else {
        console.log("eventId não fornecido, prosseguindo sem verificação de permissões do evento.");
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
