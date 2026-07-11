export const logger = {
  info: (msg: string, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 📘 [INFO] ${msg}`, ...args);
  },
  warn: (msg: string, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] ⚠️ [WARN] ${msg}`, ...args);
  },
  error: (msg: string, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ❌ [ERROR] ${msg}`, ...args);
  }
};

export default logger;
