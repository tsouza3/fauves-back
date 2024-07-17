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
} from "../controllers/user.js";
import {
  criarEvento,
  buscarEventos,
  getEventById,
  buscarEventosDoUsuario,
  deleteEvent,
  buscarEventosPorPerfilComercial,
  editarEvento,
} from "../controllers/events.js";
import {
  createTicket,
  deleteTicket,
  updateTicket,
} from "../controllers/ticket.js";
import protect from "../middlewares/auth.js";

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

router.post(
  "/productorprofile",
  protect,
  upload.single("profilePhoto"),
  createProductorProfile,
);

router.post("/register", create);

router.post("/login", login);

router.put("/:id", protect, update);

router.get("/profile", protect, getProfileData);

router.post("/eventos", protect, upload.single("capaEvento"), criarEvento);

router.get("/eventos", protect, buscarEventos);
router.get("/eventos/:profileId", protect, buscarEventosPorPerfilComercial);

router.put("/eventos/:eventId", protect, editarEvento);

router.get("/event/:eventId", protect, getEventById);

router.delete("/event/:eventId", protect, deleteEvent);

router.post("/events/:eventId/tickets", protect, createTicket);

router.delete("/events/:eventId/tickets/:ticketId", protect, deleteTicket);

router.put("/events/:eventId/tickets/:ticketId", protect, updateTicket);

router.get("/events", protect, buscarEventosDoUsuario);

router.get("/profile/:profileId", protect, getProfileDataByUser);

router.use("/uploads", express.static(path.resolve("uploads")));

export default router;
