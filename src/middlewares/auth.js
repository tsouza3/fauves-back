import jwt from "jsonwebtoken";
import User from "../models/user.js";

const getPermissionLevel = (permission) => {
  const levels = {
    user: 1,
    observer: 2,
    seller: 3,
    admin: 4,
  };
  return levels[permission] || 0; // Retorna 0 se a permissão não for encontrada
};

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

      const userPermissionLevel = getPermissionLevel(req.user.role);
      const requiredPermissionLevel = getPermissionLevel(requiredPermission);

      if (userPermissionLevel < requiredPermissionLevel) {
        return res.status(403).json({ message: "Acesso negado, permissões insuficientes." });
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

export default protect;
