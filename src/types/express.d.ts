declare global {
  namespace Express {
    interface Request {
      admin?: { id: string };
    }
  }
}

export {};
