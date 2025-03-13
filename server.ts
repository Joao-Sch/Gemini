import express from 'express';
import mongoose from 'mongoose';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port = 3000;

// Substitua <username>, <password> e <dbname> pelos valores reais
const mongoURI = 'mongodb+srv://jpoll:mitologia1@cluster0.dxg21.mongodb.net/';

// Conectar ao MongoDB Atlas
mongoose.connect(mongoURI);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB Atlas');
});

// Definir o esquema e o modelo
const messageSchema = new mongoose.Schema({
  role: String,
  content: String,
});

const Message = mongoose.model('Message', messageSchema);

app.prepare().then(() => {
  const server = express();

  // Middleware para analisar JSON
  server.use(express.json());

  // Endpoint para obter mensagens
  server.get('/api/messages', async (req, res) => {
    const messages = await Message.find();
    res.json(messages);
  });

  // Endpoint para adicionar uma mensagem
  server.post('/api/messages', async (req, res) => {
    const message = new Message(req.body);
    await message.save();
    res.json(message);
  });

  // Todas as outras requisições são tratadas pelo Next.js
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.listen(port, (err?: any) => {
    if (err) throw err;
    console.log(`Server is running on http://localhost:${port}`);
  });
});     