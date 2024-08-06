import jwt from "jsonwebtoken";
import User from "../models/user.js";

const protect = (requiredPermission) => async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json("Usuário não encontrado, não autorizado.");
      }

      if (requiredPermission && req.user.permissionCategory !== requiredPermission) {
        return res.status(403).json("Acesso negado, permissões insuficientes.");
      }

      next();
    } catch (error) {
      console.error("Erro na verificação do token:", error);
      res.status(400).json("Token inválido, não autorizado.");
    }
  } else {
    console.log("Token não fornecido ou em formato inválido.");
    res.status(400).json("Token não fornecido ou em formato inválido.");
  }
};

export default protect;