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
import { v4 as uuidv4 } from 'uuid';
import { protect } from './src/middlewares/auth.js'


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
    const { price, eventId, userId, quantidadeTickets, ticketId, devedorNome, devedorCpf, devedorCnpj } = req.body;

    // Log dos dados recebidos
    console.log("Dados recebidos para gerar o PIX:", {
        price,
        eventId,
        userId,
        quantidadeTickets,
        ticketId,
        devedorNome,
        devedorCpf,
        devedorCnpj
    });

    if (!price || !eventId || !userId || quantidadeTickets === undefined || !ticketId || (!devedorNome || (!devedorCpf && !devedorCnpj))) {
        return res.status(400).json({ error: "Parâmetros obrigatórios não fornecidos" });
    }

    const reqGN = await reqGNAlready; // Assumindo que reqGNAlready é uma instância de axios configurada para sua API

    const dataCob = {
        calendario: { expiracao: 3600 },
        valor: { original: price },
        chave: "f63d7a5e-21ba-4b4e-b3ee-55c8612e90c1",
        solicitacaoPagador: "Fauves Brasil",
        devedor: devedorCpf ? { cpf: devedorCpf, nome: devedorNome } : { cnpj: devedorCnpj, nome: devedorNome },
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
export const consultarCobranca = async (txid) => {
    try {
        console.log(`Consultando cobrança com TXID: ${txid}`); // Log do TXID
        const reqGN = await GNRequest();
        const response = await reqGN.get(`/v2/cob/${txid}`);
        return response.data;
    } catch (error) {
        if (error.response) {
            // A resposta da solicitação foi recebida com um status code fora da faixa de 2xx
            console.error(`Erro ao consultar a cobrança com TXID: ${txid}. Status: ${error.response.status}. Dados: ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
            // A solicitação foi feita, mas sem resposta
            console.error(`Erro ao consultar a cobrança com TXID: ${txid}. Sem resposta: ${error.request}`);
        } else {
            // Outro erro
            console.error(`Erro ao consultar a cobrança com TXID: ${txid}. Erro: ${error.message}`);
        }
        throw error;
    }
};

app.get('/verificar-pagamento/:txid', async (req, res) => {
    try {
        const { txid } = req.params;
        const dadosCobranca = await consultarCobranca(txid);
        
        // Verifica se o status da cobrança é "CONCLUIDA"
        if (dadosCobranca.status === 'CONCLUIDA') {
            return res.json({ status: 'sucesso' });
        }
        
        // Caso o pagamento não esteja concluído
        return res.json({ status: 'pendente' });
    } catch (error) {
        console.error('Erro ao verificar pagamento:', error);
        return res.status(500).json({ error: 'Erro ao verificar o pagamento.' });
    }
});

// Rota para buscar transações por evento
app.get("/transacoes/:eventId", protect(['admin', 'observer']), async (req, res) => {
    const { eventId } = req.params;

    try {
        console.log(`Buscando tickets para o evento com ID: ${eventId}`); // Log do eventId
        const tickets = await Ticket.find({ event: eventId });

        console.log(`Tickets encontrados: ${JSON.stringify(tickets)}`); // Log dos tickets encontrados

        const cobrancasPagas = await Promise.all(
            tickets.map(async (ticket) => {
                console.log(`Buscando cobranças para o ticket com TXIDs: ${JSON.stringify(ticket.txid)}`); // Log dos TXIDs
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

        console.log(`Cobranças pagas filtradas: ${JSON.stringify(cobrancasPagasFiltradas)}`); // Log das cobranças pagas

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

        console.log('Dados do webhook recebidos:', req.body);
        console.log('Recebido webhook com txid:', txid);
        console.log('Valores armazenados em app.locals:', {
            cobrancaTxid,
            user_Id,
            event_Id,
            quantidadeIngressos,
            ticket_Id
        });

        if (txid === cobrancaTxid) {
            const qrCodes = [];
            try {
                // Criar QR Codes para cada ingresso
                for (let j = 0; j < quantidadeIngressos; j++) {
                    const uniqueId = uuidv4();
                    const qrCodeData = await QRCode.toDataURL(`https://fauvesapi.thiagosouzadev.com/event/${event_Id}/${user_Id}/${ticket_Id}/#${uniqueId}`);
                    
                    // Persistir o QR code, ticketId, txid e eventId no array `QRCode` do usuário
                    qrCodes.push({ data: qrCodeData, uuid: uniqueId, ticketId: ticket_Id, txid: txid, eventId: event_Id });
                    
                    console.log('QR Code gerado com sucesso para ingresso:', j + 1, 'Identificador:', uniqueId);
                }
            } catch (error) {
                console.error('Erro ao gerar QR Codes:', error);
                return res.status(500).send('Erro ao gerar QR Codes');
            }

            // Atualizar usuário com QR Codes
            const updatedUser = await User.findByIdAndUpdate(user_Id, {
                $push: { QRCode: { $each: qrCodes } },
            }, { new: true });

            if (!updatedUser) {
                console.log('Erro ao atualizar usuário com QR Codes');
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

            console.log('Usuário atualizado com QR Codes:', updatedUser);
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
