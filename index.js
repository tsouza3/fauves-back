import express from "express";
import dotenv from "dotenv";
import db from "./src/config/db.js";
import routes from "./src/routes/index.routes.js";
import cors from "cors";
import bodyParser from "body-parser";
import { GNRequest } from "./src/apis/efibank.js";
import axios from "axios";
import QRCode from "qrcode";
import User from "./src/models/user.js";
import Ticket from "./src/models/ticket.js";
import mongoose from 'mongoose'

const app = express();

dotenv.config();
db();

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));

app.options("*", cors());

const reqGNAlready = GNRequest();

let cobrancaTxid = null;
let user_Id = null;
let event_Id = null;
let quantidadeIngressos = null;

app.post("/pix", async (req, res) => {
    const { price, eventId, userId, quantidadeTickets } = req.body;

    if (!price || !eventId || !userId || quantidadeTickets === undefined) {
        return res.status(400).json({ error: "Parâmetros obrigatórios não fornecidos" });
    }

    const reqGN = await reqGNAlready;

    const dataCob = {
        calendario: { expiracao: 3600 },
        valor: { original: price },
        chave: "f63d7a5e-21ba-4b4e-b3ee-55c8612e90c1",
        solicitacaoPagador: "Fauves Brasil",
    };

    try {
        const cobResponse = await reqGN.post("/v2/cob", dataCob);
        const locationUrl = cobResponse.data.loc.location;

        const qrCodeResponse = await axios.get(`https://${locationUrl}`, {
            responseType: "arraybuffer",
        });

        const qrCodeBuffer = Buffer.from(qrCodeResponse.data, "binary");
        const qrCodeBase64 = qrCodeBuffer.toString("base64");

        cobrancaTxid = cobResponse.data.txid;
        user_Id = mongoose.Types.ObjectId(userId); // Convertendo para ObjectId do Mongoose
        event_Id = mongoose.Types.ObjectId(eventId); // Convertendo para ObjectId do Mongoose
        quantidadeIngressos = quantidadeTickets;

        console.log(user_Id, event_Id, cobrancaTxid, quantidadeIngressos);
        console.log("Cobrança PIX criada:", cobResponse.data);

        res.status(200).json({
            txid: cobrancaTxid,
            cobranca: cobResponse.data,
            qrCode: qrCodeBase64,
            pixCopiaCola: cobResponse.data.pixCopiaECola,
        });
    } catch (error) {
        console.error("Erro ao gerar a cobrança PIX:", error);
        res.status(500).json({ error: "Falha ao gerar a cobrança PIX" });
    }
});

app.post('/paymentwebhook(/pix)?', async (req, res) => {
    const { txid } = req.body.pix[0];

    try {
        console.log('Recebido webhook com txid:', txid);
        console.log('Valores atuais de cobrancaTxid, user_Id e event_Id:', cobrancaTxid, user_Id, event_Id, quantidadeIngressos);

        if (txid === cobrancaTxid) {
            const qrCodes = [];
            try {
                for (let j = 0; j < quantidadeIngressos; j++) {
                    const qrCodeData = await QRCode.toDataURL(`https://fauvesapi.thiagosouzadev.com/event/${event_Id}/${user_Id}`);
                    qrCodes.push(qrCodeData);
                    console.log('QR Code gerado com sucesso para ingresso:', j + 1);
                }
            } catch (error) {
                console.error('Erro ao gerar QR Codes:', error);
                return res.status(500).send('Erro ao gerar QR Codes');
            }

            const updatedUser = await User.findByIdAndUpdate(user_Id, {
                $push: { QRCode: { $each: qrCodes }, txid: txid },
            }, { new: true });

            if (!updatedUser) {
                console.log('Erro ao atualizar usuário com QR Codes e txid');
                return res.status(404).send('Usuário não encontrado');
            }

            const updatedTicket = await Ticket.findOneAndUpdate({ user: user_Id, event: event_Id }, {
                $push: { txid: txid },
            }, { new: true });

            if (!updatedTicket) {
                console.log('Erro ao atualizar ingresso com txid');
                return res.status(404).send('Ingresso não encontrado');
            }

            console.log('Usuário atualizado com QR Codes e txid:', updatedUser);
            console.log('Ingresso atualizado com txid:', updatedTicket);
            console.log('PIX pago');
            res.status(200).send('200');
        } else {
            console.log('Cobrança não encontrada ou pagamento não confirmado');
            res.status(404).send('Cobrança não encontrada ou pagamento não confirmado');
        }
    } catch (error) {
        console.error('Erro ao processar o webhook:', error);
        res.status(500).send('Erro interno');
    }
});

app.use("/api/users", routes);

const port = process.env.PORT || 3006;
app.listen(port, () => {
    console.log(`Servidor iniciado na porta ${port}`);
});
