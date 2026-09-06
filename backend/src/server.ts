import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json()); // เปิดให้รับ Request Body เป็นแบบ JSON

// เชื่อมต่อ Routes หลักของระบบเข้ากับ Server
app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});