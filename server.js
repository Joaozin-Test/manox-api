const express = require("express");
const app = express();

app.use(express.json());

// Apenas exemplo: memória é apagada quando o Render reinicia.
// Para manter dados, use banco de dados.
const manoxUsers = new Map();

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

app.get("/", (req, res) => {
    res.send("Manox API online");
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`API online na porta ${port}`);
});
