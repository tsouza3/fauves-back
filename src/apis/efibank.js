
import fs from "fs";
import path from "path";
import https from "https";
import axios from "axios";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const certPath = path.resolve(__dirname, "./certs/producaoFauves.p12");
const cert = fs.readFileSync(certPath);

const agent = new https.Agent({
  pfx: cert,
  passphrase: "",
});

const authenticate = async () => {
  try {
    const credentials = Buffer.from(
      `${process.env.GN_CLIENT_ID}:${process.env.GN_CLIENT_SECRET}`,
    ).toString("base64");

    const authResponse = await axios({
      method: "POST",
      url: `${process.env.GN_ENDPOINT}/oauth/token`,
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      httpsAgent: agent,
      data: {
        grant_type: "client_credentials",
      },
    });

    return authResponse.data;
  } catch (error) {
    console.error("Erro ao autenticar:", error.message);
    throw error;
  }
};

export const GNRequest = async () => {
  try {
    const authResponse = await authenticate();
    const accessToken = authResponse.access_token;

    const reqGN = axios.create({
      baseURL: process.env.GN_ENDPOINT,
      httpsAgent: agent,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    return reqGN;
  } catch (error) {
    console.error("Erro ao inicializar a requisição GN:", error.message);
    throw error;
  }
};
