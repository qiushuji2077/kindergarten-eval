import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import './db/seed.js';
import { uploadsDir } from './db/index.js';
import api from './routes/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3789;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir));
app.use('/api', api);

const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).send('请先构建前端：cd client && npm run build');
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`幼儿园评价系统已启动: http://0.0.0.0:${PORT}`);
  console.log(`本机访问: http://localhost:${PORT}`);
});
