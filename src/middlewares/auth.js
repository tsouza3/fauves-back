const protect = (requiredRole) => async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(403).json({ error: "Token não fornecido" });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decodedToken.id;

    req.user = await User.findById(userId).select('-password');

    if (requiredRole === 'admin') {
      const eventId = req.params.eventId || req.body.eventId;
      if (!eventId) {
        return res.status(400).json({ error: "ID do evento não fornecido" });
      }

      const evento = await Evento.findById(eventId);
      if (!evento) {
        return res.status(404).json({ error: "Evento não encontrado" });
      }

      const isAdmin = evento.members.some(
        (member) => member.user.toString() === userId && member.role === 'admin'
      );

      if (!isAdmin) {
        return res.status(403).json({ error: "Acesso negado" });
      }
    } else if (req.user.permissionCategory !== requiredRole) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    next();
  } catch (error) {
    console.error("Erro na autenticação:", error);
    res.status(401).json({ error: "Não autorizado" });
  }
};

export default protect;
