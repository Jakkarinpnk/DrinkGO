import { app } from './app';
import { db, verifyDatabaseConnection } from './config/db';

const port = Number(process.env.PORT || 3000);

const startServer = async (): Promise<void> => {
  await verifyDatabaseConnection();
  const server = app.listen(port, () => {
    console.log(`DrinkGo API is running on port ${port}`);
  });

  const shutdown = (signal: string): void => {
    console.log(`${signal} received, shutting down`);
    server.close(() => {
      void db.end().finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

startServer().catch((error: unknown) => {
  console.error('Failed to start DrinkGo API', error);
  process.exit(1);
});
