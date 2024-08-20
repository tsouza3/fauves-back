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

    const reqGN = await reqGNAlready; // Assumindo que reqGNAlready é uma instância de axios configurada para sua API

    const dataCob = {
        calendario: { expiracao: 3600 },
        valor: { original: price },
        chave: "f63d7a5e-21ba-4b4e-b3ee-55c8612e90c1",
        solicitacaoPagador: "Fauves Brasil",
    };

    try {
        // Faz a solicitação para criar a cobrança PIX
        const cobResponse = await reqGN.post("/v2/cob", dataCob);

        // Obtém o URL do QR code da resposta
        const locationUrl = `https://${cobResponse.data.loc.location}`;
        const pixCopiaECola = cobResponse.data.pixCopiaECola;

        // Faz a requisição para obter o QR code como um arquivo
        const qrCodeResponse = await axios.get(locationUrl, {
            responseType: 'arraybuffer', // Mantendo como arraybuffer para verificar o conteúdo exato
        });

        // Converte o arraybuffer para texto, assumindo que o conteúdo é base64
        const qrCodeBase64 = Buffer.from(qrCodeResponse.data, 'binary').toString('base64');

        // Log do URL do QR Code e conteúdo base64
        console.log("URL do QR Code:", locationUrl);
        console.log("Conteúdo do QR Code em Base64:", qrCodeBase64);

        // Armazenar os IDs necessários em app.locals para acesso no webhook
        app.locals.cobrancaTxid = cobResponse.data.txid;
        app.locals.user_Id = new mongoose.Types.ObjectId(userId);
        app.locals.event_Id = new mongoose.Types.ObjectId(eventId);
        app.locals.quantidadeIngressos = quantidadeTickets;
        app.locals.ticket_Id = new mongoose.Types.ObjectId(ticketId);

        // Retorna a resposta com o QR code em base64
        res.status(200).json({
            txid: cobResponse.data.txid,
            cobranca: cobResponse.data,
            qrCode: `data:image/png;base64,${qrCodeBase64}`, // Retorna o QR code em base64 diretamente
            pixCopiaCola: pixCopiaECola,
        });
    } catch (error) {
        console.error("Erro ao gerar a cobrança PIX:", error.message);
        res.status(500).json({ error: "Falha ao gerar a cobrança PIX" });
    }
});

const consultarCobranca = async (txid) => {
    try {
        const reqGN = await GNRequest();
        const response = await reqGN.get(`/v2/cob/${txid}`);
        return response.data;
    } catch (error) {
        console.error(`Erro ao consultar a cobrança com TXID: ${txid}`, error.message);
        throw error;
    }
};

router.get("/transacoes/:eventId", async (req, res) => {
    const { eventId } = req.params;

    try {
        const tickets = await Ticket.find({ event: eventId });

        const cobrancasPagas = await Promise.all(
            tickets.map(async (ticket) => {
                const transacoes = await Promise.all(
                    ticket.txid.map(async (txid) => {
                        const cobranca = await consultarCobranca(txid);
                        return cobranca;
                    })
                );
                return transacoes;
            })
        );

        // Filtrando apenas as cobranças que estão pagas
        const cobrancasPagasFiltradas = cobrancasPagas.flat().filter(cobranca => cobranca.status === 'CONCLUIDA');

        res.status(200).json({ cobrancasPagas: cobrancasPagasFiltradas });
    } catch (error) {
        console.error("Erro ao buscar transações:", error.message);
        res.status(500).json({ error: "Falha ao buscar transações" });
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
                    // Gerar um identificador único para cada QR Code
                    const uniqueId = uuidv4();
                    // Usar o ticket_Id e o uniqueId para criar a URL do QR Code
                    const qrCodeData = await QRCode.toDataURL(`https://fauvesapi.thiagosouzadev.com/event/${event_Id}/${user_Id}/${ticket_Id}#${uniqueId}`);
                    qrCodes.push(qrCodeData);
                    console.log('QR Code gerado com sucesso para ingresso:', j + 1, 'Identificador:', uniqueId);
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
    }});

app.use("/api/users", routes);

const port = process.env.PORT || 3006;
app.listen(port, () => {
    console.log(`Servidor iniciado na porta ${port}`);
});
