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
import mongoose from "mongoose";

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

app.post("/pix", async (req, res) => {
    const { price, eventId, userId, quantidadeTickets, ticketId } = req.body;

    if (!price || !eventId || !userId || quantidadeTickets === undefined || !ticketId) {
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

        const cobrancaTxid = cobResponse.data.txid;
        const user_Id = new mongoose.Types.ObjectId(userId);
        const event_Id = new mongoose.Types.ObjectId(eventId);
        const quantidadeIngressos = quantidadeTickets;
        const ticket_Id = new mongoose.Types.ObjectId(ticketId);

        console.log(user_Id, event_Id, cobrancaTxid, quantidadeIngressos, ticket_Id);
        console.log("Cobrança PIX criada:", cobResponse.data);

        // Armazenar os IDs necessários em app.locals para acesso no webhook
        app.locals.cobrancaTxid = cobrancaTxid;
        app.locals.user_Id = user_Id;
        app.locals.event_Id = event_Id;
        app.locals.quantidadeIngressos = quantidadeIngressos;
        app.locals.ticket_Id = ticket_Id;

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
        // Recuperar os IDs armazenados em app.locals
        const cobrancaTxid = app.locals.cobrancaTxid;
        const user_Id = app.locals.user_Id;
        const event_Id = app.locals.event_Id;
        const quantidadeIngressos = app.locals.quantidadeIngressos;
        const ticket_Id = app.locals.ticket_Id;

        console.log('Recebido webhook com txid:', txid);
        console.log('Valores atuais de cobrancaTxid, user_Id e event_Id:', cobrancaTxid, user_Id, event_Id, quantidadeIngressos, ticket_Id);

        if (txid === cobrancaTxid) {
            const qrCodes = [];
            try {
                // Criar QR Codes para cada ingresso, utilizando o ticket_Id específico
                for (let j = 0; j < quantidadeIngressos; j++) {
                    // Usar o ticket_Id para criar a URL do QR Code
                    const qrCodeData = await QRCode.toDataURL(`https://fauvesapi.thiagosouzadev.com/event/${event_Id}/${user_Id}/${ticket_Id}`);
                    qrCodes.push(qrCodeData);
                    console.log('QR Code gerado com sucesso para ingresso:', j + 1);
                }
            } catch (error) {
                console.error('Erro ao gerar QR Codes:', error);
                return res.status(500).send('Erro ao gerar QR Codes');
            }

            // Atualizar usuário com QR Codes e txid
            const updatedUser = await User.findByIdAndUpdate(user_Id, {
                $push: { QRCode: { $each: qrCodes }, txid: txid },
            }, { new: true });

            if (!updatedUser) {
                console.log('Erro ao atualizar usuário com QR Codes e txid');
                return res.status(404).send('Usuário não encontrado');
            }

            // Atualizar ingresso com txid
            const updatedTicket = await Ticket.findByIdAndUpdate(
                ticket_Id, 
                { $push: { txid: txid } },
                { new: true }
            );

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
```

### Mudanças Realizadas:

1. **Substituição do `uniqueTicketId`**: Em vez de gerar um novo ID para cada QR Code, a função usa o `ticket_Id` obtido do evento para criar a URL do QR Code.

2. **URL do QR Code**: A URL gerada para o QR Code agora inclui o `ticket_Id` diretamente.

Isso garante que o QR Code gerado esteja corretamente relacionado ao `ticket_Id` específico do evento. Se cada ingresso tem um `ticket_Id` único, você precisará garantir que o `ticket_Id` correto é atribuído aos QR Codes. Se houver múltiplos ingressos e cada um deve ter um `ticket_Id` diferente, será necessário ajustar o processo para garantir que cada QR Code tenha um `ticket_Id` exclusivo.
app.use("/api/users", routes);

const port = process.env.PORT || 3006;
app.listen(port, () => {
    console.log(`Servidor iniciado na porta ${port}`);
});
