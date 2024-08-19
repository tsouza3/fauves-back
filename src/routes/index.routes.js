import express from "express";
import multer from "multer";
import path from "path";
import {
  create,
  login,
  update,
  getProfileData,
  createProductorProfile,
  getProfileDataByUser,
  updateUserPermission,
  getUsersByRole
} from "../controllers/user.js";
import {
  criarEvento,
  buscarEventos,
  getEventById,
  buscarEventosDoUsuario,
  deleteEvent,
  buscarEventosPorPerfilComercial,
  editarEvento,
listarEventosPorData

} from "../controllers/events.js";
import {
  createTicket,
  deleteTicket,
  updateTicket,
  emitirCortesia,
} from "../controllers/ticket.js";
import { protect } from "../middlewares/auth.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads");
  },
  filename: function (req, file, cb) {
    cb(
      null,
      `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`,
    );
  },
});

const upload = multer({ storage });

// Rotas de perfil do produtor
router.post(
  "/productorprofile",
  protect(['user']), // Permissão para criar perfil de produtor
  upload.single("profilePhoto"),
  createProductorProfile
);

// Rotas de autenticação
router.post("/register", create);
router.post("/login", login);

// Rotas de perfil
router.put("/:id", protect(['user', 'admin']), update); // Permissão para atualizar perfil
router.get("/profile", protect(['user', 'admin']), getProfileData); // Permissão para acessar perfil

// Rotas de evento
router.post(
  "/eventos",
  protect(['user', 'admin']), // Permissão para criar eventos
  upload.single("capaEvento"),
  criarEvento
);

router.get("/eventos", protect(['user', 'admin']), buscarEventos); // Permissão para listar eventos
router.get("/eventos/:profileId", protect(['user', 'admin']), buscarEventosPorPerfilComercial);

router.put(
  "/eventos/:eventId",
  protect(['admin']), // Permissão para editar eventos
  editarEvento
);

router.get("/event/:eventId", protect(['user', 'admin', 'checkin']), getEventById);

router.get("/role/:eventId", protect(['user', 'admin']), getUsersByRole);


router.delete(
  "/event/:eventId",
  protect(['admin']), // Permissão para deletar eventos
  deleteEvent
);

router.post(
  "/events/:eventId/tickets",
  protect(['admin']), // Permissão para criar tickets
  createTicket
);

router.delete(
  "/events/:eventId/tickets/:ticketId",
  protect(['admin']), // Permissão para deletar tickets
  deleteTicket
);

router.post(
  "/emitircortesia",
  protect(['admin']), // Permissão para atualizar tickets
  emitirCortesia
);

router.get("/events", protect(['user, admin']), buscarEventosDoUsuario);

router.get("/listareventos", protect(['user']), listarEventosPorData);


router.get("/profile/:profileId", protect(['user, admin']), getProfileDataByUser);

// Rota para atualizar a categoria de permissão do usuário
router.post("/update-permission", protect(['admin']), updateUserPermission);

router.use("/uploads", express.static(path.resolve("uploads")));

export default router;
