import dotenv from 'dotenv';
import { createApp } from '../src/app';

// Ensure env vars are available in Vercel functions too
dotenv.config();

const app = createApp();

export default app;

