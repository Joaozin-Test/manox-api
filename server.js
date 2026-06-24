const express = require("express");
const app = express();

app.use(express.json());

// Apenas exemplo: memória é apagada quando o Render reinicia.
// Para manter dados, use banco de dados.
const manoxUsers = new Map();
const tempAdmins = new Map();

// Registra/atualiza um usuário
app.post("/api/manox/register", (req, res) => {
    const { username, userId } = req.body;

    if (typeof username !== "string" || username.length < 1) {
        return res.status(400).json({
            success: false,
            message: "username inválido"
        });
    }

    manoxUsers.set(username.toLowerCase(), {
        username: username,
        userId: userId || null,
        lastSeen: Date.now()
    });

    res.json({
        success: true
    });
});

// Lista os usuários ativos nos últimos 10 minutos
app.get("/api/manox/users", (req, res) => {
    const now = Date.now();
    const activeUsers = [];

    for (const [key, data] of manoxUsers) {
        if (now - data.lastSeen <= 10 * 60 * 1000) {
            activeUsers.push(data.username);
        } else {
            manoxUsers.delete(key);
        }
    }

    res.json({
        success: true,
        users: activeUsers
    });
});

// Mantém o usuário como ativo
app.post("/api/manox/heartbeat", (req, res) => {
    const { username } = req.body;

    if (typeof username !== "string") {
        return res.status(400).json({
            success: false
        });
    }

    const key = username.toLowerCase();
    const oldData = manoxUsers.get(key);

    if (oldData) {
        oldData.lastSeen = Date.now();
        manoxUsers.set(key, oldData);
    }

    res.json({
        success: true
    });
});

let playerSession = {
    username: "Nenhum",
    placeId: null,
    jobId: null,
    timestamp: null
};

app.post('/api/manox/send-jobid', (req, res) => {
    const { username, placeId, jobId } = req.body;
    
    if (!username || !placeId || !jobId) {
        return res.status(400).json({ error: "Dados incompletos." });
    }

    playerSession = {
        username,
        placeId,
        jobId,
        timestamp: Date.now()
    };

    console.log(`Sessão atualizada para o jogador: ${username}`);
    return res.status(200).json({ success: true, message: "Sessão salva com sucesso!" });
});

app.get('/api/manox/get-jobid', (req, res) => {
    return res.status(200).json(playerSession);
});

// Lista admins temporários ativos
app.get("/api/manox/temp-admins", (req, res) => {
    const now = Date.now();
    const admins = [];

    for (const [key, data] of tempAdmins) {
        if (now < data.expiresAt) {
            admins.push({
                username: data.username,
                expiresAt: data.expiresAt
            });
        } else {
            tempAdmins.delete(key);
        }
    }

    res.json({
        success: true,
        admins: admins
    });
});

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

function checkAdminKey(req, res, next) {
    if (!ADMIN_API_KEY || req.headers["x-manox-key"] !== ADMIN_API_KEY) {
        return res.status(401).json({
            success: false,
            message: "Não autorizado"
        });
    }

    next();
}

// Adiciona admin temporário
app.post("/api/manox/temp-admins/add", checkAdminKey, (req, res) => {
    const { username } = req.body;

    if (typeof username !== "string" || username.trim() === "") {
        return res.status(400).json({
            success: false,
            message: "username inválido"
        });
    }

    const ONE_HOUR = 60 * 60 * 1000;

    tempAdmins.set(username.toLowerCase(), {
        username: username,
        expiresAt: Date.now() + ONE_HOUR
    });

    res.json({
        success: true,
        username: username,
        expiresAt: Date.now() + ONE_HOUR,
        message: "Admin temporário adicionado por 1 hora."
    });
});

app.post("/api/manox/temp-admins/remove", checkAdminKey, (req, res) => {
    const { username } = req.body;

    if (typeof username !== "string") {
        return res.status(400).json({
            success: false
        });
    }

    tempAdmins.delete(username.toLowerCase());

    res.json({
        success: true
    });
});

const globalMessages = [];
const MAX_MESSAGES = 50;
const RATE_LIMIT_MS = 2000;
const lastMessageAt = new Map();
const systemMessages = [];
const MAX_SYSTEM_MESSAGES = 9999999999999999999999999;

app.post("/api/manox/chat", (req, res) => {
    const { username, userId, message } = req.body;

    if (
        typeof username !== "string" ||
        typeof message !== "string" ||
        username.trim() === "" ||
        message.trim() === ""
    ) {
        return res.status(400).json({
            success: false,
            message: "Dados inválidos."
        });
    }

    const cleanMessage = message.trim().slice(0, 200);
    const key = String(userId || username).toLowerCase();
    const now = Date.now();
    const lastTime = lastMessageAt.get(key) || 0;

    if (now - lastTime < RATE_LIMIT_MS) {
        return res.status(429).json({
            success: false,
            message: "Espere um pouco antes de enviar outra mensagem."
        });
    }

    lastMessageAt.set(key, now);

    const chatMessage = {
        id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
        username: username.trim(),
        userId: userId || null,
        message: cleanMessage,
        createdAt: now
    };

    globalMessages.push(chatMessage);

    if (globalMessages.length > MAX_MESSAGES) {
        globalMessages.shift();
    }

    res.json({
        success: true,
        message: chatMessage
    });
});

app.get("/api/manox/get-chat", (req, res) => {
    res.json({
        success: true,
        messages: globalMessages
    });
});

app.post("/api/manox/system-message", checkAdminKey, (req, res) => {
    const { message } = req.body;

    if (typeof message !== "string" || message.trim() === "") {
        return res.status(400).json({
            success: false,
            message: "Mensagem inválida."
        });
    }

    const systemMessage = {
        id: `system-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        message: message.trim().slice(0, 250),
        createdAt: Date.now()
    };

    systemMessages.push(systemMessage);

    if (systemMessages.length > MAX_SYSTEM_MESSAGES) {
        systemMessages.shift();
    }

    res.json({
        success: true,
        message: systemMessage
    });
});

app.get("/api/manox/system-messages", (req, res) => {
    res.json({
        success: true,
        messages: systemMessages
    });
});

// Limpa todo o chat global
app.post("/api/manox/chat/clear", checkAdminKey, (req, res) => {
    globalMessages.length = 0;
    lastMessageAt.clear();

    res.json({
        success: true,
        message: "Chat global limpo."
    });
});

app.get("/", (req, res) => {
    res.send("Manox API online");
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`API online na porta ${port}`);
});
